const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const BaseService = require('./baseService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class AuditService extends BaseService {
  constructor() {
    super(AuditLog, 'AuditLog');
  }

  /**
   * Log an audit action
   */
  async logAction(data) {
    try {
      const auditLog = new AuditLog({
        user_id: data.user_id,
        action: data.action,
        action_category: data.action_category || this.getActionCategory(data.action),
        target_user_id: data.target_user_id,
        target_transformer_id: data.target_transformer_id,
        target_record_type: data.target_record_type,
        target_record_id: data.target_record_id,
        details: data.details,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        request_method: data.request_method,
        request_path: data.request_path,
        old_values: data.old_values,
        new_values: data.new_values,
        metadata: data.metadata
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      logger.error('Error logging audit action:', error);
      // Don't throw, just log the error
      return null;
    }
  }

  /**
   * Get action category from action name
   */
  getActionCategory(action) {
    const categoryMap = {
      'LOGIN': 'AUTH',
      'LOGOUT': 'AUTH',
      'REGISTER': 'AUTH',
      'PASSWORD_CHANGE': 'AUTH',
      'PASSWORD_RESET': 'AUTH',
      'EMAIL_VERIFY': 'AUTH',
      'USER_CREATE': 'USER_MANAGEMENT',
      'USER_UPDATE': 'USER_MANAGEMENT',
      'USER_DELETE': 'USER_MANAGEMENT',
      'USER_ROLE_CHANGE': 'USER_MANAGEMENT',
      'USER_ACTIVATE': 'USER_MANAGEMENT',
      'USER_DEACTIVATE': 'USER_MANAGEMENT',
      'TRANSFORMER_CREATE': 'TRANSFORMER_MANAGEMENT',
      'TRANSFORMER_UPDATE': 'TRANSFORMER_MANAGEMENT',
      'TRANSFORMER_DELETE': 'TRANSFORMER_MANAGEMENT',
      'TRANSFORMER_VERIFY': 'TRANSFORMER_MANAGEMENT',
      'TRANSFORMER_DECOMMISSION': 'TRANSFORMER_MANAGEMENT',
      'INSPECTION_CREATE': 'INSPECTION',
      'INSPECTION_UPDATE': 'INSPECTION',
      'INSPECTION_DELETE': 'INSPECTION',
      'FAULT_CREATE': 'FAULT_MANAGEMENT',
      'FAULT_UPDATE': 'FAULT_MANAGEMENT',
      'FAULT_RESOLVE': 'FAULT_MANAGEMENT',
      'FAULT_ASSIGN': 'FAULT_MANAGEMENT',
      'FAULT_CLOSE': 'FAULT_MANAGEMENT',
      'MAINTENANCE_CREATE': 'MAINTENANCE',
      'MAINTENANCE_UPDATE': 'MAINTENANCE',
      'MAINTENANCE_DELETE': 'MAINTENANCE',
      'INSTALLATION_CREATE': 'INSTALLATION',
      'INSTALLATION_UPDATE': 'INSTALLATION',
      'INSTALLATION_DELETE': 'INSTALLATION',
      'REPORT_GENERATE': 'REPORTING',
      'REPORT_EXPORT': 'REPORTING',
      'IMPORT_START': 'IMPORT',
      'IMPORT_COMPLETE': 'IMPORT',
      'EXPORT_START': 'EXPORT',
      'EXPORT_COMPLETE': 'EXPORT',
      'SYSTEM_BACKUP': 'SYSTEM',
      'SYSTEM_RESTORE': 'SYSTEM',
      'SYSTEM_MAINTENANCE': 'SYSTEM'
    };

    return categoryMap[action] || 'SYSTEM';
  }

  /**
   * Get user audit trail
   */
  async getUserAuditTrail(userId, page = 1, limit = 50) {
    try {
      const result = await this.getAll(
        { user_id: userId },
        {
          page,
          limit,
          sort: { created_at: -1 },
          populate: ['user_id', 'target_user_id', 'target_transformer_id']
        }
      );

      return result;
    } catch (error) {
      logger.error('Error getting user audit trail:', error);
      throw new ApiError(500, 'Failed to get user audit trail');
    }
  }

  /**
   * Get transformer audit trail
   */
  async getTransformerAuditTrail(transformerId, page = 1, limit = 50) {
    try {
      const result = await this.getAll(
        { target_transformer_id: transformerId },
        {
          page,
          limit,
          sort: { created_at: -1 },
          populate: ['user_id']
        }
      );

      return result;
    } catch (error) {
      logger.error('Error getting transformer audit trail:', error);
      throw new ApiError(500, 'Failed to get transformer audit trail');
    }
  }

  /**
   * Get actions by category
   */
  async getActionsByCategory(category, startDate = null, endDate = null) {
    try {
      const query = { action_category: category };
      
      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) query.created_at.$gte = startDate;
        if (endDate) query.created_at.$lte = endDate;
      }

      return await this.model.find(query)
        .sort({ created_at: -1 })
        .populate('user_id', 'name email');
    } catch (error) {
      logger.error('Error getting actions by category:', error);
      throw new ApiError(500, 'Failed to get actions by category');
    }
  }

  /**
   * Get action statistics
   */
  async getActionStats(startDate = null, endDate = null) {
    try {
      const match = {};
      if (startDate || endDate) {
        match.created_at = {};
        if (startDate) match.created_at.$gte = startDate;
        if (endDate) match.created_at.$lte = endDate;
      }

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$action_category',
            count: { $sum: 1 },
            users: { $addToSet: '$user_id' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            uniqueUsers: { $size: '$users' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get daily trends
      const dailyTrend = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$created_at' },
              month: { $month: '$created_at' },
              day: { $dayOfMonth: '$created_at' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // Get top users
      const topUsers = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$user_id',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $project: {
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            count: 1
          }
        }
      ]);

      // Get top actions
      const topActions = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      return {
        total: await this.model.countDocuments(match),
        byCategory: stats,
        dailyTrend,
        topUsers,
        topActions,
        timeRange: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      };
    } catch (error) {
      logger.error('Error getting action stats:', error);
      throw new ApiError(500, 'Failed to get action statistics');
    }
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(searchTerm, filters = {}, page = 1, limit = 50) {
    try {
      const query = {
        $or: [
          { action: { $regex: searchTerm, $options: 'i' } },
          { details: { $regex: searchTerm, $options: 'i' } },
          { 'metadata.searchable': { $regex: searchTerm, $options: 'i' } }
        ]
      };

      if (filters.user_id) {
        query.$or.push({ user_id: filters.user_id });
      }
      if (filters.action_category) {
        query.action_category = filters.action_category;
      }
      if (filters.startDate || filters.endDate) {
        query.created_at = {};
        if (filters.startDate) query.created_at.$gte = filters.startDate;
        if (filters.endDate) query.created_at.$lte = filters.endDate;
      }

      const result = await this.getAll(query, {
        page,
        limit,
        sort: { created_at: -1 },
        populate: ['user_id', 'target_user_id', 'target_transformer_id']
      });

      return result;
    } catch (error) {
      logger.error('Error searching audit logs:', error);
      throw new ApiError(500, 'Failed to search audit logs');
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activities = await this.model.aggregate([
        {
          $match: {
            user_id: userId,
            created_at: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$action_category',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const total = activities.reduce((sum, item) => sum + item.count, 0);

      return {
        userId,
        days,
        total,
        byCategory: activities,
        lastActivity: await this.model.findOne(
          { user_id: userId }
        ).sort({ created_at: -1 })
      };
    } catch (error) {
      logger.error('Error getting user activity summary:', error);
      throw new ApiError(500, 'Failed to get user activity summary');
    }
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(days = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await this.model.deleteMany({
        created_at: { $lt: cutoffDate }
      });

      logger.info(`Cleaned ${result.deletedCount} old audit logs`);
      return result;
    } catch (error) {
      logger.error('Error cleaning old audit logs:', error);
      throw new ApiError(500, 'Failed to clean old audit logs');
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id) {
    try {
      return await this.getById(id, ['user_id', 'target_user_id', 'target_transformer_id']);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting audit log by ID:', error);
      throw new ApiError(500, 'Failed to get audit log');
    }
  }

  /**
   * Get recent activities for dashboard
   */
  async getRecentActivities(limit = 20, filters = {}) {
    try {
      const query = {};
      if (filters.user_id) {
        query.user_id = filters.user_id;
      }
      if (filters.action_category) {
        query.action_category = filters.action_category;
      }

      return await this.model.find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .populate('user_id', 'name email')
        .populate('target_transformer_id', 'asset_id');
    } catch (error) {
      logger.error('Error getting recent activities:', error);
      throw new ApiError(500, 'Failed to get recent activities');
    }
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(filters = {}, format = 'json') {
    try {
      const query = {};
      
      if (filters.user_id) {
        query.user_id = filters.user_id;
      }
      if (filters.action_category) {
        query.action_category = filters.action_category;
      }
      if (filters.startDate || filters.endDate) {
        query.created_at = {};
        if (filters.startDate) query.created_at.$gte = filters.startDate;
        if (filters.endDate) query.created_at.$lte = filters.endDate;
      }

      const logs = await this.model.find(query)
        .sort({ created_at: -1 })
        .populate('user_id', 'name email')
        .populate('target_user_id', 'name email')
        .populate('target_transformer_id', 'asset_id');

      if (format === 'json') {
        return logs;
      }

      // Excel format would be handled by report service
      return { logs, count: logs.length };
    } catch (error) {
      logger.error('Error exporting audit logs:', error);
      throw new ApiError(500, 'Failed to export audit logs');
    }
  }
}

module.exports = new AuditService();