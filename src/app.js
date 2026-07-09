require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const { createServer } = require('http');
const cookieParser = require('cookie-parser');

// Config
const database = require('./config/database');
const redis = require('./config/redis');

// Middleware
const { errorHandler } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const maintenanceModeMiddleware = require('./middleware/maintenanceMode');

// Routes
const routes = require('./routes');

// WebSocket
const WebSocketManager = require('./websocket');

// Jobs
const OverdueInspectionChecker = require('./jobs/overdueInspectionCheck');
const OverloadDetector = require('./jobs/overloadDetection');

class App {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.port = process.env.PORT || 3000;
    this.isTestRuntime = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
    
    this.setupMiddleware();
    this.setupSwagger();
    this.setupRoutes();
    if (!this.isTestRuntime) {
      this.setupWebSocket();
      this.setupJobs();
    }
    this.setupErrorHandling();
  }
  
  /**
   * Setup all middleware
   */
  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", process.env.CLIENT_URL]
        }
      }
    }));
    
    // CORS
    this.app.use(cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Disposition']
    }));

    // Cookie parsing
    this.app.use(cookieParser());
    
    // Compression
    this.app.use(compression({
      level: 6,
      threshold: 100 * 1024, // 100KB
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
    
    // Logging with custom format
    this.app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms', {
      stream: {
        write: (message) => {
          // Only log in development or if log level is set
          if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
            console.log(message.trim());
          }
        }
      }
    }));
    
    // Body parsing with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));
    
    // Rate limiting (applied to all routes except health)
    this.app.use('/api', rateLimiter);
    
    // Static files with caching
    this.app.use('/uploads', express.static('uploads', {
      maxAge: '7d',
      etag: true,
      lastModified: true
    }));
    
    // Health check endpoint (no authentication)
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: require('../package.json').version,
        services: {
          database: database.isConnected ? 'connected' : 'disconnected',
          redis: redis.isConnected ? 'connected' : 'disconnected',
          websocket: this.wsManager ? 'running' : 'stopped'
        }
      };
      
      const statusCode = database.isConnected && redis.isConnected ? 200 : 503;
      res.status(statusCode).json(health);
    });
    
    // API root endpoint
    this.app.get('/api', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'kVAssetTracker API v2.0',
        version: require('../package.json').version,
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          transformers: '/api/transformers',
          inspections: '/api/inspections',
          maintenance: '/api/maintenance',
          faults: '/api/faults',
          installations: '/api/installations',
          dashboard: '/api/dashboard',
          reports: '/api/reports',
          import: '/api/import',
          notifications: '/api/notifications',
          timeline: '/api/timeline',
          sync: '/api/sync',
          admin: '/api/admin'
        },
        documentation: '/api-docs',
        health: '/health'
      });
    });
  }

  /**
   * Setup Swagger documentation
   */
  setupSwagger() {
    try {
      const swaggerPath = path.join(__dirname, '../swagger.yaml');
      
      if (fs.existsSync(swaggerPath)) {
        const swaggerDocument = YAML.load(swaggerPath);
        
        // Add server info dynamically
        swaggerDocument.servers = [
          {
            url: `http://localhost:${this.port}`,
            description: 'Development server'
          },
          {
            url: process.env.API_URL || `https://api.kVAssetTracker.com`,
            description: 'Production server'
          }
        ];
        
        // Swagger UI options
        const swaggerOptions = {
          explorer: true,
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'kVAssetTracker API Documentation',
          swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            tryItOutEnabled: true
          }
        };
        
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
        console.log('✅ Swagger documentation available at /api-docs');
      } else {
        console.warn('⚠️ swagger.yaml file missing. Documentation not available.');
      }
    } catch (error) {
      console.error('❌ Failed to setup Swagger documentation:', error.message);
    }
  }
  
  /**
   * Setup all routes
   */
  setupRoutes() {
    this.app.use('/api', maintenanceModeMiddleware);

    // routes/index.js already mounts all sub-routes internally and exports one router
    this.app.use('/api', routes);

    // 404 handler for unmatched routes
    this.app.use('/{*wildcard}', (req, res) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        method: req.method,
        timestamp: new Date().toISOString(),
        available_endpoints: '/api for list of all endpoints'
      });
    });
  }
  
  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    try {
      this.wsManager = new WebSocketManager(this.server);
      
      // Make WebSocket manager available to services
      this.app.set('wsManager', this.wsManager);
      
      // Also make it available globally for services
      global.wsManager = this.wsManager;
      
      console.log('✅ WebSocket server initialized');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error.message);
    }
  }
  
  /**
   * Setup scheduled jobs
   */
  setupJobs() {
    try {
      // Start overdue inspection checker
      OverdueInspectionChecker.start();
      console.log('✅ Overdue inspection checker started');
      
      // Start overload detector
      OverloadDetector.start();
      console.log('✅ Overload detector started');
      
      // Additional jobs can be started here
    } catch (error) {
      console.error('❌ Failed to start scheduled jobs:', error.message);
    }
  }
  
  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use(errorHandler);

    if (this.isTestRuntime) {
      return;
    }
    
    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      // Gracefully shutdown if critical
      if (error.code === 'EADDRINUSE') {
        console.error('Port already in use. Exiting...');
        process.exit(1);
      }
    });
    
    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit, but log appropriately
    });
  }
  
  /**
   * Start the application
   */
  async start() {
    try {
      // Connect to databases
      console.log('🔌 Connecting to MongoDB...');
      await database.connect();
      console.log('✅ MongoDB connected successfully');
      
      console.log('🔌 Connecting to Redis...');
      await redis.connect();
      console.log('✅ Redis connected successfully');
      
      // Start server
      this.server.listen(this.port, () => {
        console.log('='.repeat(60));
        console.log(`🚀 kVAssetTracker Server`);
        console.log('='.repeat(60));
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 Server URL: http://localhost:${this.port}`);
        console.log(`📚 API Docs: http://localhost:${this.port}/api-docs`);
        console.log(`💚 Health Check: http://localhost:${this.port}/health`);
        console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
        console.log('='.repeat(60));
        console.log('✅ Server is ready to accept connections');
      });
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
  
  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
      
      const shutdownTimeout = setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
      
      try {
        // Close WebSocket connections
        if (this.wsManager) {
          console.log('📡 Closing WebSocket connections...');
          this.wsManager.closeAll();
        }
        
        // Close HTTP server
        console.log('🌐 Closing HTTP server...');
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        
        // Close database connections
        console.log('🗄️ Closing database connections...');
        await database.disconnect();
        await redis.disconnect();
        
        clearTimeout(shutdownTimeout);
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };
    
    // Register signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle cleanup on exit
    process.on('exit', (code) => {
      console.log(`Process exiting with code: ${code}`);
    });
  }
  
  /**
   * Get the WebSocket manager instance
   */
  getWebSocketManager() {
    return this.wsManager;
  }
  
  /**
   * Get the express app instance
   */
  getApp() {
    return this.app;
  }
  
  /**
   * Get the server instance
   */
  getServer() {
    return this.server;
  }
}

const app = new App();

if (require.main === module) {
  app.start();
}

module.exports = app;
