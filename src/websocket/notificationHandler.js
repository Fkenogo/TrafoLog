const Notification = require('../models/Notification');
const User = require('../models/User');
const { logger } = require('../utils/logger');

class NotificationHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
  }
  
  /**
   * Send notification to user
   */
  async sendNotification(userId, type, title, message, data = {}, priority = 'normal') {
    try {
      // Save notification to database
      const notification = new Notification({
        user_id: userId,
        type,
        title,
        message,
        data,
        priority,
        is_read: false,
        created_at: new Date()
      });
      
      await notification.save();
      
      // Send real-time notification via WebSocket
      const sent = this.wsManager.sendToUser(userId, 'notification', {
        id: notification._id,
        type,
        title,
        message,
        data,
        priority,
        created_at: notification.created_at
      });
      
      // Also send unread count update
      const unreadCount = await this.getUnreadCount(userId);
      this.wsManager.sendToUser(userId, 'unread-count-update', { count: unreadCount });
      
      return {
        notification,
        delivered: sent
      };
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }
  
  /**
   * Send notification to multiple users
   */
  async sendBulkNotifications(userIds, type, title, message, data = {}, priority = 'normal') {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await this.sendNotification(
          userId,
          type,
          title,
          message,
          data,
          priority
        );
        results.push({
          userId,
          success: true,
          notificationId: result.notification._id,
          delivered: result.delivered
        });
      } catch (error) {
        results.push({
          userId,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Send fault alert notification
   */
  async sendFaultAlert(fault, transformer, priority = 'high') {
    const title = `⚡ Fault Alert: ${fault.fault_type}`;
    const message = `${fault.severity} fault reported on ${transformer.asset_id} at ${transformer.location_administrative?.site_name}`;
    
    const data = {
      faultId: fault._id,
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      severity: fault.severity,
      faultType: fault.fault_type
    };
    
    // Determine which users to notify
    const users = await this.getUsersToNotify(transformer, priority);
    
    return await this.sendBulkNotifications(
      users,
      'FAULT_ALERT',
      title,
      message,
      data,
      priority
    );
  }
  
  /**
   * Send inspection alert notification
   */
  async sendInspectionAlert(inspection, transformer, action) {
    const title = `📋 Inspection Alert: ${action} Required`;
    const message = `${action} recommended for ${transformer.asset_id} at ${transformer.location_administrative?.site_name}`;
    
    const data = {
      inspectionId: inspection._id,
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      condition: inspection.physical?.overall_condition || 'Unknown',
      action
    };
    
    const users = await this.getUsersToNotify(transformer, 'high');
    
    return await this.sendBulkNotifications(
      users,
      'INSPECTION_ALERT',
      title,
      message,
      data,
      'high'
    );
  }
  
  /**
   * Send overload alert notification
   */
  async sendOverloadAlert(transformer, loadPercentage, readings) {
    const title = `⚡ Overload Alert: ${transformer.asset_id}`;
    const message = `Transformer at ${loadPercentage}% capacity (${transformer.display_rating}) at ${transformer.location_administrative?.site_name}`;
    
    const data = {
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      loadPercentage,
      readings
    };
    
    const users = await this.getUsersToNotify(transformer, 'medium');
    
    return await this.sendBulkNotifications(
      users,
      'OVERLOAD_ALERT',
      title,
      message,
      data,
      'medium'
    );
  }
  
  /**
   * Send fault assignment notification
   */
  async sendFaultAssignment(fault, transformer, assignedUser) {
    const title = `📌 Fault Assigned: ${fault.fault_type}`;
    const message = `Fault assigned to ${assignedUser.name} for ${transformer.asset_id}`;
    
    const data = {
      faultId: fault._id,
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      assignedTo: assignedUser._id
    };
    
    // Send to assigned user
    const result = await this.sendNotification(
      assignedUser._id,
      'FAULT_ASSIGNED',
      title,
      message,
      data,
      'high'
    );
    
    // Also notify managers
    const managers = await this.getManagersToNotify(transformer);
    await this.sendBulkNotifications(
      managers,
      'FAULT_ASSIGNED',
      `Fault Assigned: ${fault.fault_type}`,
      `Fault assigned to ${assignedUser.name} for ${transformer.asset_id}`,
      data,
      'normal'
    );
    
    return result;
  }
  
  /**
   * Send fault resolution notification
   */
  async sendFaultResolution(fault, transformer) {
    const title = `✅ Fault Resolved: ${fault.fault_type}`;
    const message = `Fault resolved on ${transformer.asset_id} (Downtime: ${fault.downtime_hours || 'N/A'} hours)`;
    
    const data = {
      faultId: fault._id,
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      downtimeHours: fault.downtime_hours
    };
    
    // Notify all users in territory
    const users = await this.getUsersToNotify(transformer, 'normal');
    
    return await this.sendBulkNotifications(
      users,
      'FAULT_RESOLVED',
      title,
      message,
      data,
      'normal'
    );
  }
  
  /**
   * Send maintenance notification
   */
  async sendMaintenanceNotification(maintenance, transformer, type = 'scheduled') {
    const title = type === 'scheduled' 
      ? `🔧 Scheduled Maintenance: ${transformer.asset_id}`
      : `🔧 Maintenance Completed: ${transformer.asset_id}`;
    
    const message = type === 'scheduled'
      ? `Maintenance scheduled for ${transformer.asset_id} on ${new Date(maintenance.maintenance_date).toLocaleDateString()}`
      : `Maintenance completed on ${transformer.asset_id}`;
    
    const data = {
      maintenanceId: maintenance._id,
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      type: maintenance.maintenance_type
    };
    
    const users = await this.getUsersToNotify(transformer, 'normal');
    
    return await this.sendBulkNotifications(
      users,
      'MAINTENANCE_ALERT',
      title,
      message,
      data,
      'normal'
    );
  }
  
  /**
   * Send overdue inspection notification
   */
  async sendOverdueInspection(transformer, daysOverdue) {
    const title = `📅 Overdue Inspection: ${transformer.asset_id}`;
    const message = `Transformer at ${transformer.location_administrative?.site_name} overdue by ${daysOverdue} days`;
    
    const data = {
      transformerId: transformer._id,
      assetId: transformer.asset_id,
      daysOverdue
    };
    
    const urgency = daysOverdue > 180 ? 'high' : 'normal';
    const users = await this.getUsersToNotify(transformer, urgency);
    
    return await this.sendBulkNotifications(
      users,
      'OVERDUE_INSPECTION',
      title,
      message,
      data,
      urgency
    );
  }
  
  /**
   * Send system alert
   */
  async sendSystemAlert(userId, message, data = {}, priority = 'normal') {
    return await this.sendNotification(
      userId,
      'SYSTEM_ALERT',
      '⚠️ System Alert',
      message,
      data,
      priority
    );
  }
  
  /**
   * Get users to notify based on transformer and priority
   */
  async getUsersToNotify(transformer, priority = 'normal') {
    const roles = ['Super Admin'];
    
    if (priority === 'high' || priority === 'critical') {
      roles.push('Territory Manager', 'Engineer');
    } else {
      roles.push('Territory Manager');
    }
    
    const query = {
      is_active: true,
      role: { $in: roles }
    };
    
    // If transformer has territory, filter by that territory
    if (transformer.location_operational?.territory_id) {
      const users = await User.find({
        ...query,
        $or: [
          { territory_id: transformer.location_operational.territory_id },
          { role: 'Super Admin' }
        ]
      }).select('_id');
      
      return users.map(u => u._id);
    }
    
    const users = await User.find(query).select('_id');
    return users.map(u => u._id);
  }
  
  /**
   * Get managers to notify
   */
  async getManagersToNotify(transformer) {
    const users = await User.find({
      is_active: true,
      role: { $in: ['Super Admin', 'Territory Manager'] },
      $or: [
        { territory_id: transformer.location_operational?.territory_id },
        { role: 'Super Admin' }
      ]
    }).select('_id');
    
    return users.map(u => u._id);
  }
  
  /**
   * Get unread count for user
   */
  async getUnreadCount(userId) {
    return await Notification.countDocuments({
      user_id: userId,
      is_read: false
    });
  }
  
  /**
   * Get user notifications
   */
  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      Notification.find({ user_id: userId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ user_id: userId })
    ]);
    
    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount: await this.getUnreadCount(userId)
    };
  }
  
  /**
   * Mark notification as read
   */
  async markAsRead(userId, notificationId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user_id: userId },
      { 
        is_read: true, 
        read_at: new Date() 
      },
      { new: true }
    );
    
    if (notification) {
      // Update unread count via WebSocket
      const unreadCount = await this.getUnreadCount(userId);
      this.wsManager.sendToUser(userId, 'unread-count-update', { count: unreadCount });
    }
    
    return notification;
  }
  
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    await Notification.updateMany(
      { user_id: userId, is_read: false },
      { 
        is_read: true, 
        read_at: new Date() 
      }
    );
    
    // Update unread count via WebSocket
    this.wsManager.sendToUser(userId, 'unread-count-update', { count: 0 });
    
    return { success: true };
  }
  
  /**
   * Delete notification
   */
  async deleteNotification(userId, notificationId) {
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      user_id: userId
    });
    
    if (result) {
      // Update unread count via WebSocket
      const unreadCount = await this.getUnreadCount(userId);
      this.wsManager.sendToUser(userId, 'unread-count-update', { count: unreadCount });
    }
    
    return result;
  }
  
  /**
   * Clear all notifications
   */
  async clearAllNotifications(userId) {
    await Notification.deleteMany({ user_id: userId });
    
    this.wsManager.sendToUser(userId, 'unread-count-update', { count: 0 });
    this.wsManager.sendToUser(userId, 'notifications-cleared', { timestamp: new Date().toISOString() });
    
    return { success: true };
  }
}

module.exports = NotificationHandler;