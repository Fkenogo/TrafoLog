const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class WebSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });
    
    this.userSockets = new Map();
    this.setupAuthentication();
    this.setupHandlers();
  }
  
  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || !user.is_active) {
          return next(new Error('Invalid user'));
        }
        
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }
  
  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.id}`);
      
      // Store user socket mapping
      this.userSockets.set(socket.user.id, socket.id);
      
      // Join user's rooms based on role
      this.joinUserRooms(socket);
      
      socket.on('disconnect', () => {
        this.userSockets.delete(socket.user.id);
        console.log(`User disconnected: ${socket.user.id}`);
      });
    });
  }
  
  joinUserRooms(socket) {
    // Territory managers join their territory room
    if (socket.user.territory_id) {
      socket.join(`territory:${socket.user.territory_id}`);
    }
    
    // All users join their role room for broadcast messages
    socket.join(`role:${socket.user.role}`);
    
    // Engineers and technicians join their service area
    if (socket.user.service_area_id) {
      socket.join(`service_area:${socket.user.service_area_id}`);
    }
  }
  
  /**
   * Send notification to specific user
   */
  sendToUser(userId, event, data) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }
  
  /**
   * Broadcast to all users in a territory
   */
  sendToTerritory(territoryId, event, data) {
    this.io.to(`territory:${territoryId}`).emit(event, data);
  }
  
  /**
   * Broadcast to all users in a service area
   */
  sendToServiceArea(serviceAreaId, event, data) {
    this.io.to(`service_area:${serviceAreaId}`).emit(event, data);
  }
  
  /**
   * Broadcast to all users with a specific role
   */
  sendToRole(role, event, data) {
    this.io.to(`role:${role}`).emit(event, data);
  }
}

module.exports = WebSocketManager;