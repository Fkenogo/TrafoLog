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

// Routes
const routes = require('./routes');
// 🌟 Direct import for authRoutes to completely bypass any packaging errors in routes/index.js
const authRoutes = require('./routes/authRoutes'); 

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
    
    this.setupMiddleware();
    this.setupSwagger(); // Initialized before core API routes
    this.setupRoutes();
    this.setupWebSocket();
    this.setupJobs();
    this.setupErrorHandling();
  }
  
  setupMiddleware() {
    // Security
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Cookie parsing
    this.app.use(cookieParser());
    
    // Compression
    this.app.use(compression());
    
    // Logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => console.log(message.trim())
      }
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use('/uploads', express.static('uploads'));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }

  setupSwagger() {
    try {
      // Correct path resolution mapping back to root level swagger.yaml
      const swaggerPath = path.join(__dirname, '../swagger.yaml');
      
      if (fs.existsSync(swaggerPath)) {
        const swaggerDocument = YAML.load(swaggerPath);
        
        // Expose interactive interface
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
      } else {
        console.warn('⚠️ swagger.yaml file missing at root folder. Documentation fallback bypassed.');
      }
    } catch (error) {
      console.error('❌ Failed to parse or hook up Swagger documentation:', error);
    }
  }
  
  setupRoutes() {
    // API routes
    // 🌟 Using the safely imported authRoutes module directly here
    this.app.use('/api/auth', authRoutes); 
    
    this.app.use('/api/transformers', routes.transformerRoutes);
    this.app.use('/api/inspections', routes.inspectionRoutes);
    this.app.use('/api/maintenance', routes.maintenanceRoutes);
    this.app.use('/api/faults', routes.faultRoutes);
    this.app.use('/api/installations', routes.installationRoutes);
    this.app.use('/api/dashboard', routes.dashboardRoutes);
    this.app.use('/api/reports', routes.reportRoutes);
    this.app.use('/api/import', routes.importRoutes);
    this.app.use('/api/notifications', routes.notificationRoutes);
    this.app.use('/api/timeline', routes.timelineRoutes);
    this.app.use('/api/sync', routes.syncRoutes);
    this.app.use('/api/admin', routes.adminRoutes);
    
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });
  }
  
  setupWebSocket() {
    this.wsManager = new WebSocketManager(this.server);
  }
  
  setupJobs() {
    // Start scheduled jobs
    OverdueInspectionChecker.start();
    OverloadDetector.start();
  }
  
  setupErrorHandling() {
    this.app.use(errorHandler);
  }
  
  async start() {
    try {
      // Connect to databases
      await database.connect();
      await redis.connect();
      
      // Start server
      this.server.listen(this.port, () => {
        console.log(`Server running on port ${this.port}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Swagger Docs available at http://localhost:${this.port}/api-docs`);
      });
      
      // Graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
  
  setupGracefulShutdown() {
    const shutdown = async () => {
      console.log('Received shutdown signal, closing gracefully...');
      
      // Close server
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      
      // Close database connections
      await database.disconnect();
      await redis.disconnect();
      
      console.log('Server closed');
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

// Start the application
const app = new App();
app.start();

module.exports = app;