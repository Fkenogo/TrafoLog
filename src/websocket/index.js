const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const NotificationHandler = require('./notificationHandler');
const SyncHandler = require('./syncHandler');
const { logger } = require('../utils/logger');

class WebSocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    this.userSockets = new Map();
    this.userRooms = new Map();
    
    // Initialize handlers
    this.notificationHandler = new NotificationHandler(this);
    this.syncHandler = new SyncHandler(this);
    
    this.setupAuthentication();
    this.setupHandlers();
    this.setupErrorHandling();
    
    logger.info('WebSocket server initialized');
  }
  
  /**
   * Setup authentication middleware
   */
  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id)
          .select('id name email role territory_id service_area_id is_active');
        
        if (!user || !user.is_active) {
          return next(new Error('Invalid or inactive user'));
        }
        
        socket.user = user;
        socket.userId = user.id;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }
  
  /**
   * Setup all socket handlers
   */
  setupHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.user.id;
      logger.info(`User connected: ${userId} (${socket.user.email})`);
      
      // Store user socket mapping
      this.userSockets.set(userId, socket.id);
      this.userRooms.set(userId, new Set());
      
      // Join user's rooms
      this.joinUserRooms(socket);
      
      // Send welcome message
      socket.emit('welcome', {
        message: 'Connected to kVAssetTracker WebSocket',
        userId: userId,
        role: socket.user.role,
        timestamp: new Date().toISOString()
      });
      
      // Setup event handlers
      this.setupEventHandlers(socket);
      
      // Setup disconnect handler
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });
      
      // Setup error handler
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userId}:`, error);
        socket.emit('error', {
          message: 'An error occurred',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      });
    });
  }
  
  /**
   * Setup event handlers for a socket
   */
  setupEventHandlers(socket) {
    const userId = socket.user.id;
    
    // Join room
    socket.on('join-room', (room) => {
      this.joinRoom(socket, room);
    });
    
    // Leave room
    socket.on('leave-room', (room) => {
      this.leaveRoom(socket, room);
    });
    
    // Notification events
    socket.on('mark-notification-read', async (notificationId) => {
      try {
        await this.notificationHandler.markAsRead(userId, notificationId);
        socket.emit('notification-updated', { notificationId, status: 'read' });
      } catch (error) {
        logger.error('Error marking notification as read:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });
    
    socket.on('mark-all-notifications-read', async () => {
      try {
        await this.notificationHandler.markAllAsRead(userId);
        socket.emit('notifications-updated', { status: 'all-read' });
      } catch (error) {
        logger.error('Error marking all notifications as read:', error);
        socket.emit('error', { message: 'Failed to mark all notifications as read' });
      }
    });
    
    socket.on('get-unread-count', async () => {
      try {
        const count = await this.notificationHandler.getUnreadCount(userId);
        socket.emit('unread-count', { count });
      } catch (error) {
        logger.error('Error getting unread count:', error);
        socket.emit('error', { message: 'Failed to get unread count' });
      }
    });
    
    socket.on('get-notifications', async (data) => {
      try {
        const { page = 1, limit = 20 } = data || {};
        const notifications = await this.notificationHandler.getUserNotifications(userId, page, limit);
        socket.emit('notifications', notifications);
      } catch (error) {
        logger.error('Error getting notifications:', error);
        socket.emit('error', { message: 'Failed to get notifications' });
      }
    });
    
    socket.on('delete-notification', async (notificationId) => {
      try {
        await this.notificationHandler.deleteNotification(userId, notificationId);
        socket.emit('notification-deleted', { notificationId });
      } catch (error) {
        logger.error('Error deleting notification:', error);
        socket.emit('error', { message: 'Failed to delete notification' });
      }
    });
    
    socket.on('clear-all-notifications', async () => {
      try {
        await this.notificationHandler.clearAllNotifications(userId);
        socket.emit('notifications-cleared', { timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error('Error clearing notifications:', error);
        socket.emit('error', { message: 'Failed to clear notifications' });
      }
    });
    
    // Sync events
    socket.on('sync-request', async (data) => {
      try {
        const result = await this.syncHandler.handleSyncRequest(userId, data);
        socket.emit('sync-response', result);
      } catch (error) {
        logger.error('Error processing sync request:', error);
        socket.emit('error', { message: 'Failed to process sync request' });
      }
    });
    
    socket.on('get-pending-syncs', async () => {
      try {
        const pending = await this.syncHandler.getPendingSyncs(userId);
        socket.emit('pending-syncs', pending);
      } catch (error) {
        logger.error('Error getting pending syncs:', error);
        socket.emit('error', { message: 'Failed to get pending syncs' });
      }
    });
    
    socket.on('get-sync-status', async () => {
      try {
        const status = await this.syncHandler.getSyncStatus(userId);
        socket.emit('sync-status', status);
      } catch (error) {
        logger.error('Error getting sync status:', error);
        socket.emit('error', { message: 'Failed to get sync status' });
      }
    });
    
    socket.on('resolve-conflict', async (data) => {
      try {
        const { conflictId, resolution, resolvedData } = data;
        const result = await this.syncHandler.resolveConflict(
          userId,
          conflictId,
          resolution,
          resolvedData
        );
        socket.emit('conflict-resolved', result);
      } catch (error) {
        logger.error('Error resolving conflict:', error);
        socket.emit('error', { message: 'Failed to resolve conflict' });
      }
    });
    
    socket.on('get-sync-history', async (data) => {
      try {
        const { page = 1, limit = 20 } = data || {};
        const history = await this.syncHandler.getSyncHistory(userId, page, limit);
        socket.emit('sync-history', history);
      } catch (error) {
        logger.error('Error getting sync history:', error);
        socket.emit('error', { message: 'Failed to get sync history' });
      }
    });
    
    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }
  
  /**
   * Join user rooms based on role
   */
  joinUserRooms(socket) {
    const user = socket.user;
    
    // User-specific room
    socket.join(`user:${user.id}`);
    this.addUserRoom(user.id, `user:${user.id}`);
    
    // Role room
    socket.join(`role:${user.role}`);
    this.addUserRoom(user.id, `role:${user.role}`);
    
    // Territory room
    if (user.territory_id) {
      socket.join(`territory:${user.territory_id}`);
      this.addUserRoom(user.id, `territory:${user.territory_id}`);
    }
    
    // Service area room
    if (user.service_area_id) {
      socket.join(`service_area:${user.service_area_id}`);
      this.addUserRoom(user.id, `service_area:${user.service_area_id}`);
    }
  }
  
  /**
   * Join a specific room
   */
  joinRoom(socket, room) {
    if (!room || typeof room !== 'string') {
      socket.emit('error', { message: 'Invalid room name' });
      return;
    }
    
    socket.join(room);
    this.addUserRoom(socket.user.id, room);
    socket.emit('room-joined', { room });
  }
  
  /**
   * Leave a specific room
   */
  leaveRoom(socket, room) {
    if (!room || typeof room !== 'string') {
      socket.emit('error', { message: 'Invalid room name' });
      return;
    }
    
    socket.leave(room);
    this.removeUserRoom(socket.user.id, room);
    socket.emit('room-left', { room });
  }
  
  /**
   * Add room to user's rooms
   */
  addUserRoom(userId, room) {
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId).add(room);
  }
  
  /**
   * Remove room from user's rooms
   */
  removeUserRoom(userId, room) {
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId).delete(room);
    }
  }
  
  /**
   * Handle disconnect
   */
  handleDisconnect(socket, reason) {
    const userId = socket.user.id;
    this.userSockets.delete(userId);
    this.userRooms.delete(userId);
    logger.info(`User disconnected: ${userId}, Reason: ${reason}`);
    this.broadcastUserStatus(userId, 'offline');
  }
  
  /**
   * Broadcast user status
   */
  broadcastUserStatus(userId, status) {
    this.io.emit('user-status', {
      userId,
      status,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Setup error handling
   */
  setupErrorHandling() {
    this.io.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
    
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, closing WebSocket server...');
      this.closeAll();
    });
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
   * Send to multiple users
   */
  sendToUsers(userIds, event, data) {
    let sent = 0;
    for (const userId of userIds) {
      if (this.sendToUser(userId, event, data)) {
        sent++;
      }
    }
    return sent;
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
  
  /**
   * Broadcast to all connected users
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }
  
  /**
   * Get connected users
   */
  getConnectedUsers() {
    return Array.from(this.userSockets.keys());
  }
  
  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.userSockets.has(userId);
  }
  
  /**
   * Get connection count
   */
  getConnectionCount() {
    return this.userSockets.size;
  }
  
  /**
   * Close all connections
   */
  closeAll() {
    this.io.close();
    this.userSockets.clear();
    this.userRooms.clear();
    
    if (this.syncHandler) {
      this.syncHandler.stopSyncInterval();
    }
    
    logger.info('All WebSocket connections closed');
  }
  
  /**
   * Get notification handler instance
   */
  getNotificationHandler() {
    return this.notificationHandler;
  }
  
  /**
   * Get sync handler instance
   */
  getSyncHandler() {
    return this.syncHandler;
  }
}

module.exports = WebSocketManager;