const Notification = require('../models/Notification');
const User = require('../models/User');
const BaseService = require('./baseService');
const { sendEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

// WebSocket manager reference (will be set in app.js)
let wsManager = null;

class NotificationService extends BaseService {
  constructor() {
    super(Notification, 'Notification');
  }

  /**
   * Set WebSocket manager
   */
  setWebSocketManager(manager) {
    wsManager = manager;
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, type, message, data = {}) {
    const NOTIFICATION_TITLES = {
      FAULT_ALERT: 'Fault Alert',
      FAULT_ASSIGNED: 'Fault Assigned',
      FAULT_RESOLVED: 'Fault Resolved',
      FAULT_ESCALATED: 'Fault Escalated',
      FAULT_REOPENED: 'Fault Reopened',
      INSPECTION_ALERT: 'Inspection Alert',
      OVERLOAD_ALERT: 'Overload Alert',
      OVERDUE_INSPECTION: 'Overdue Inspection',
      MAINTENANCE_ALERT: 'Maintenance Alert',
      MAINTENANCE_SCHEDULED: 'Maintenance Scheduled',
      SYSTEM_ALERT: 'System Alert',
      USER_ACTION_REQUIRED: 'Action Required',
      TRANSFORMER_VERIFIED: 'Transformer Verified',
      TRANSFORMER_DECOMMISSIONED: 'Transformer Decommissioned',
      IMPORT_COMPLETED: 'Import Completed',
      REPORT_READY: 'Report Ready'
    };

    try {
      const notification = new this.model({
        user_id: userId,
        type: type,
        title: NOTIFICATION_TITLES[type] || type,
        message: message,
        data: data,
        is_read: false
      });

      await notification.save();

      // Send real-time notification via WebSocket
      if (wsManager) {
        wsManager.sendToUser(userId, 'notification', {
          id: notification._id,
          type: type,
          message: message,
          data: data,
          created_at: notification.created_at
        });
      }

      return notification;
    } catch (error) {
      logger.warn('Error sending notification (non-fatal):', error.message);
      throw error;
    }
  }

  /**
   * Send fault alert notification
   */
  async sendFaultAlert({ fault, transformer, priority = 'normal' }) {
    try {
      const users = await this.getUsersForAlert(transformer, priority);

      const message = `
        ⚠️ FAULT ALERT: ${fault.severity} fault reported on ${transformer.asset_id}
        Type: ${fault.fault_type}
        Location: ${transformer.location_administrative.site_name}
        Description: ${fault.fault_description}
      `;

      const data = {
        fault_id: fault._id,
        transformer_id: transformer._id,
        severity: fault.severity,
        fault_type: fault.fault_type
      };

      for (const user of users) {
        await this.sendNotification(
          user._id,
          'FAULT_ALERT',
          message,
          data
        );

        // Send email for critical alerts
        if (priority === 'critical' || fault.severity === 'Critical' || fault.severity === 'Complete Outage') {
          await sendEmail({
            to: user.email,
            subject: `🚨 ${fault.severity} Fault Alert - ${transformer.asset_id}`,
            html: this.generateFaultEmailHTML(fault, transformer)
          });
        }

        // Send SMS for complete outages
        if (fault.severity === 'Complete Outage') {
          await sendSMS({
            to: user.phone,
            message: `URGENT: Complete outage at ${transformer.asset_id}. ${fault.fault_type}. Please check immediately.`
          });
        }
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendFaultAlert failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Send inspection alert
   */
  async sendInspectionAlert({ transformer, inspection, action }) {
    try {
      const users = await this.getUsersForAlert(transformer, 'high');

      const message = `
        📋 INSPECTION ALERT: ${action} recommended for ${transformer.asset_id}
        Condition: ${inspection.physical.overall_condition}
        Location: ${transformer.location_administrative.site_name}
      `;

      const data = {
        inspection_id: inspection._id,
        transformer_id: transformer._id,
        action: action
      };

      for (const user of users) {
        await this.sendNotification(
          user._id,
          'INSPECTION_ALERT',
          message,
          data
        );

        if (action === 'Urgent Repair' || action === 'Replace') {
          await sendEmail({
            to: user.email,
            subject: `⚠️ ${action} Required - ${transformer.asset_id}`,
            html: this.generateInspectionEmailHTML(transformer, inspection, action)
          });
        }
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendInspectionAlert failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Send overload alert
   */
  async sendOverloadAlert({ transformer, inspection, loadPercentage }) {
    try {
      const users = await this.getUsersForAlert(transformer, 'medium');

      const message = `
        ⚡ OVERLOAD ALERT: ${transformer.asset_id} at ${loadPercentage}% capacity
        Rating: ${transformer.display_rating}
        Location: ${transformer.location_administrative.site_name}
        Load: ${inspection.electrical.load_current_a}A / ${inspection.electrical.load_current_b}A / ${inspection.electrical.load_current_c}A
      `;

      const data = {
        transformer_id: transformer._id,
        load_percentage: loadPercentage,
        phase_readings: {
          a: inspection.electrical.load_current_a,
          b: inspection.electrical.load_current_b,
          c: inspection.electrical.load_current_c
        }
      };

      for (const user of users) {
        await this.sendNotification(
          user._id,
          'OVERLOAD_ALERT',
          message,
          data
        );
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendOverloadAlert failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Send assignment notification
   */
  async sendAssignmentNotification({ fault, transformer, assignedTo }) {
    try {
      const message = `
        📌 FAULT ASSIGNED: ${fault.fault_type} assigned to ${assignedTo.name}
        Transformer: ${transformer.asset_id}
        Severity: ${fault.severity}
      `;

      const data = {
        fault_id: fault._id,
        transformer_id: transformer._id,
        assigned_to: assignedTo._id
      };

      // Send to assigned user
      await this.sendNotification(
        assignedTo._id,
        'FAULT_ASSIGNED',
        message,
        data
      );

      // Send email
      try {
        await sendEmail({
          to: assignedTo.email,
          subject: `📌 Fault Assigned - ${fault.fault_type}`,
          html: this.generateAssignmentEmailHTML(fault, transformer, assignedTo)
        });
      } catch (emailError) {
        logger.warn('Assignment email delivery failed after in-app notification was created (non-fatal):', emailError.message);
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendAssignmentNotification failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Send resolution notification
   */
  async sendResolutionNotification({ fault, transformer }) {
    try {
      const users = await this.getUsersForAlert(transformer, 'normal');

      const message = `
        ✅ FAULT RESOLVED: ${fault.fault_type} on ${transformer.asset_id}
        Downtime: ${fault.downtime_hours} hours
        Resolution: ${fault.resolution_description}
      `;

      const data = {
        fault_id: fault._id,
        transformer_id: transformer._id,
        downtime_hours: fault.downtime_hours
      };

      for (const user of users) {
        await this.sendNotification(
          user._id,
          'FAULT_RESOLVED',
          message,
          data
        );
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendResolutionNotification failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification({ fault, transformer, reason }) {
    try {
      const users = await this.getUsersForAlert(transformer, 'high');

      const message = `
        ⬆️ FAULT ESCALATED: ${fault.fault_type} on ${transformer.asset_id}
        Reason: ${reason}
        Current Status: ${fault.fault_status}
      `;

      const data = {
        fault_id: fault._id,
        transformer_id: transformer._id,
        reason: reason
      };

      for (const user of users) {
        await this.sendNotification(
          user._id,
          'FAULT_ESCALATED',
          message,
          data
        );
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendEscalationNotification failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Send overdue inspection notification
   */
  async sendOverdueInspectionAlert(transformer, urgency = 'normal') {
    try {
      const users = await this.getUsersForAlert(transformer, urgency === 'urgent' ? 'high' : 'normal');

      const message = `
        📅 OVERDUE INSPECTION: ${transformer.asset_id} overdue by ${this.getDaysOverdue(transformer.last_inspection_date)} days
        Location: ${transformer.location_administrative.site_name}
        ${urgency === 'urgent' ? '⚠️ URGENT - Over 180 days overdue' : ''}
      `;

      const data = {
        transformer_id: transformer._id,
        days_overdue: this.getDaysOverdue(transformer.last_inspection_date),
        urgency: urgency
      };

      for (const user of users) {
        await this.sendNotification(
          user._id,
          'OVERDUE_INSPECTION',
          message,
          data
        );
      }

      return { success: true };
    } catch (error) {
      logger.warn('NotificationService.sendOverdueInspectionAlert failed (non-fatal):', error);
      throw error;
    }
  }

  /**
   * Get users for alert
   */
  async getUsersForAlert(transformer, priority = 'normal') {
    try {
      const roles = ['Super Admin'];

      if (priority === 'critical' || priority === 'high') {
        roles.push('Territory Manager', 'Engineer');
      } else {
        roles.push('Territory Manager');
      }

      const query = {
        is_active: true,
        role: { $in: roles }
      };

      // If transformer has territory, filter users by that territory
      if (transformer.location_operational?.territory_id) {
        const users = await User.find({
          ...query,
          $or: [
            { territory_id: transformer.location_operational.territory_id },
            { role: 'Super Admin' }
          ]
        });
        return users;
      }

      return await User.find(query);
    } catch (error) {
      logger.warn('NotificationService.getUsersForAlert failed:', error);
      return [];
    }
  }

  /**
   * Get days overdue
   */
  getDaysOverdue(lastInspectionDate) {
    if (!lastInspectionDate) return 999;
    const now = new Date();
    const diffTime = now - lastInspectionDate;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate fault email HTML
   */
  generateFaultEmailHTML(fault, transformer) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f8f9fa; }
            .severity-critical { color: #dc3545; font-weight: bold; }
            .severity-major { color: #fd7e14; font-weight: bold; }
            .severity-minor { color: #ffc107; font-weight: bold; }
            .footer { margin-top: 20px; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Fault Reported</h1>
            </div>
            <div class="content">
              <h2>Transformer: ${transformer.asset_id}</h2>
              <p><strong>Site:</strong> ${transformer.location_administrative.site_name}</p>
              <p><strong>Location:</strong> ${transformer.location_administrative.village}, ${transformer.location_administrative.parish}</p>
              <p><strong>Rating:</strong> ${transformer.display_rating}</p>
              <hr>
              <p><strong>Fault Type:</strong> ${fault.fault_type}</p>
              <p><strong>Severity:</strong> <span class="severity-${fault.severity.toLowerCase()}">${fault.severity}</span></p>
              <p><strong>Description:</strong> ${fault.fault_description}</p>
              <p><strong>Reported:</strong> ${new Date(fault.fault_date).toLocaleString()}</p>
              <p><strong>Customers Affected:</strong> ${fault.customers_affected || 'Not specified'}</p>
              <p><strong>Area Affected:</strong> ${fault.area_affected || 'Not specified'}</p>
              <hr>
              <p><a href="${process.env.CLIENT_URL}/faults/${fault._id}" style="display: inline-block; padding: 10px 20px; background: #1a3c6e; color: white; text-decoration: none; border-radius: 4px;">View Fault Details</a></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} kVAssetTracker. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate inspection email HTML
   */
  generateInspectionEmailHTML(transformer, inspection, action) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ffc107; color: #333; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f8f9fa; }
            .footer { margin-top: 20px; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 ${action} Required</h1>
            </div>
            <div class="content">
              <h2>Transformer: ${transformer.asset_id}</h2>
              <p><strong>Site:</strong> ${transformer.location_administrative.site_name}</p>
              <p><strong>Rating:</strong> ${transformer.display_rating}</p>
              <hr>
              <p><strong>Action Required:</strong> <span style="color: #dc3545; font-weight: bold;">${action}</span></p>
              <p><strong>Condition:</strong> ${inspection.physical.overall_condition}</p>
              <p><strong>Load:</strong> ${inspection.electrical.load_percentage}%</p>
              <p><strong>Recommendation:</strong> ${inspection.condition_narrative}</p>
              <hr>
              <p><a href="${process.env.CLIENT_URL}/transformers/${transformer.asset_id}" style="display: inline-block; padding: 10px 20px; background: #1a3c6e; color: white; text-decoration: none; border-radius: 4px;">View Transformer</a></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} kVAssetTracker. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate assignment email HTML
   */
  generateAssignmentEmailHTML(fault, transformer, assignedTo) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a3c6e; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f8f9fa; }
            .footer { margin-top: 20px; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📌 Fault Assigned</h1>
            </div>
            <div class="content">
              <h2>Fault Assignment</h2>
              <p><strong>Assigned To:</strong> ${assignedTo.name}</p>
              <p><strong>Transformer:</strong> ${transformer.asset_id}</p>
              <p><strong>Site:</strong> ${transformer.location_administrative.site_name}</p>
              <p><strong>Fault Type:</strong> ${fault.fault_type}</p>
              <p><strong>Severity:</strong> ${fault.severity}</p>
              <p><strong>Description:</strong> ${fault.fault_description}</p>
              <hr>
              <p><a href="${process.env.CLIENT_URL}/faults/${fault._id}" style="display: inline-block; padding: 10px 20px; background: #1a3c6e; color: white; text-decoration: none; border-radius: 4px;">View Fault Details</a></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} kVAssetTracker. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const result = await this.getAll(
        { user_id: userId },
        {
          page,
          limit,
          sort: { created_at: -1 }
        }
      );

      return result;
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw new ApiError(500, 'Failed to get notifications');
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId) {
    try {
      return await this.model.countDocuments({
        user_id: userId,
        is_read: false
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw new ApiError(500, 'Failed to get unread count');
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await this.model.findOne({
        _id: notificationId,
        user_id: userId
      });

      if (!notification) {
        throw new ApiError(404, 'Notification not found');
      }

      notification.is_read = true;
      notification.read_at = new Date();
      await notification.save();

      return notification;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error marking notification as read:', error);
      throw new ApiError(500, 'Failed to mark notification as read');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      await this.model.updateMany(
        { user_id: userId, is_read: false },
        {
          is_read: true,
          read_at: new Date()
        }
      );

      return { success: true };
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw new ApiError(500, 'Failed to mark all notifications as read');
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await this.model.findOne({
        _id: notificationId,
        user_id: userId
      });

      if (!notification) {
        throw new ApiError(404, 'Notification not found');
      }

      await notification.deleteOne();
      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error deleting notification:', error);
      throw new ApiError(500, 'Failed to delete notification');
    }
  }
}

module.exports = new NotificationService();
