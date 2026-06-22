const Maintenance = require('../models/Maintenance');
const Transformer = require('../models/Transformer');
const AssetTimeline = require('../models/AssetTimeline');
const BaseService = require('./baseService');
const NotificationService = require('./notificationService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class MaintenanceService extends BaseService {
  constructor() {
    super(Maintenance, 'Maintenance');
  }

  /**
   * Create a new maintenance record
   */
  async createMaintenance(data, userId, files = {}) {
    try {
      // Verify transformer exists
      const transformer = await Transformer.findById(data.transformer_id);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Prepare maintenance data
      const maintenanceData = {
        ...data,
        technician_id: userId,
        maintenance_date: data.maintenance_date || new Date(),
        photos_before: files.photosBefore?.map(f => f.filename || f.path) || [],
        photos_after: files.photosAfter?.map(f => f.filename || f.path) || []
      };

      // Create maintenance record
      const maintenance = await this.create(maintenanceData, userId);

      // Update transformer
      const updateData = {
        last_maintenance_date: maintenance.maintenance_date,
        updated_by: userId
      };

      // Update next maintenance date if provided
      if (data.next_maintenance_date) {
        updateData.next_maintenance_date = data.next_maintenance_date;
      }

      await Transformer.findByIdAndUpdate(data.transformer_id, updateData);

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'MAINTENANCE_PERFORMED', userId, {
        maintenance_id: maintenance._id,
        maintenance_type: data.maintenance_type
      });

      // Send notification if any issues found
      if (data.post_condition_narrative && 
          data.post_condition_narrative.toLowerCase().includes('issue')) {
        await NotificationService.sendMaintenanceAlert({
          maintenance,
          transformer,
          issue: data.post_condition_narrative
        });
      }

      return maintenance;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in MaintenanceService.createMaintenance:', error);
      throw new ApiError(500, 'Failed to create maintenance record');
    }
  }

  /**
   * Get maintenance records for a transformer
   */
  async getMaintenanceByTransformer(transformerId, page = 1, limit = 20) {
    try {
      const result = await this.getAll(
        { transformer_id: transformerId },
        {
          page,
          limit,
          sort: { maintenance_date: -1 },
          populate: ['technician_id', 'reviewed_by']
        }
      );

      return result;
    } catch (error) {
      logger.error('Error in MaintenanceService.getMaintenanceByTransformer:', error);
      throw new ApiError(500, 'Failed to get maintenance records');
    }
  }

  /**
   * Get upcoming maintenance
   */
  async getUpcomingMaintenance(days = 30, territoryId = null) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const query = {
        next_maintenance_date: {
          $gte: startDate,
          $lte: endDate
        },
        is_deleted: false
      };

      if (territoryId) {
        const transformers = await Transformer.find({
          'location_operational.territory_id': territoryId
        }).select('_id');

        const transformerIds = transformers.map(t => t._id);
        query.transformer_id = { $in: transformerIds };
      }

      const maintenance = await this.model.find(query)
        .populate('transformer_id')
        .populate('technician_id', 'name email')
        .sort({ next_maintenance_date: 1 });

      return maintenance;
    } catch (error) {
      logger.error('Error in MaintenanceService.getUpcomingMaintenance:', error);
      throw new ApiError(500, 'Failed to get upcoming maintenance');
    }
  }

  /**
   * Get maintenance statistics
   */
  async getStatistics(filters = {}) {
    try {
      const match = {};

      if (filters.territory_id) {
        // Join with transformer for territory filtering
      }

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            preventive: {
              $sum: { $cond: [{ $eq: ['$maintenance_type', 'Preventive'] }, 1, 0] }
            },
            corrective: {
              $sum: { $cond: [{ $eq: ['$maintenance_type', 'Corrective'] }, 1, 0] }
            },
            emergency: {
              $sum: { $cond: [{ $eq: ['$maintenance_type', 'Emergency'] }, 1, 0] }
            }
          }
        }
      ]);

      // Get monthly trend
      const monthlyTrend = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$maintenance_date' },
              month: { $month: '$maintenance_date' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return {
        ...(stats[0] || {
          total: 0,
          preventive: 0,
          corrective: 0,
          emergency: 0
        }),
        monthlyTrend
      };
    } catch (error) {
      logger.error('Error in MaintenanceService.getStatistics:', error);
      throw new ApiError(500, 'Failed to get maintenance statistics');
    }
  }

  /**
   * Update maintenance record
   */
  async updateMaintenance(id, data, userId, files = {}) {
    try {
      const maintenance = await this.getById(id);
      if (!maintenance) {
        throw new ApiError(404, 'Maintenance record not found');
      }

      // Update photos if provided
      if (files.photosBefore && files.photosBefore.length > 0) {
        data.photos_before = files.photosBefore.map(f => f.filename || f.path);
      }
      if (files.photosAfter && files.photosAfter.length > 0) {
        data.photos_after = files.photosAfter.map(f => f.filename || f.path);
      }

      const updated = await this.update(id, data, userId);

      // Update transformer if maintenance date changed
      if (data.maintenance_date) {
        await Transformer.findByIdAndUpdate(maintenance.transformer_id, {
          last_maintenance_date: data.maintenance_date,
          updated_by: userId
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in MaintenanceService.updateMaintenance:', error);
      throw new ApiError(500, 'Failed to update maintenance record');
    }
  }

  /**
   * Delete maintenance record
   */
  async deleteMaintenance(id, userId) {
    try {
      const maintenance = await this.getById(id);
      if (!maintenance) {
        throw new ApiError(404, 'Maintenance record not found');
      }

      await this.delete(id, userId);

      // Update transformer - set last maintenance to previous one
      const latestMaintenance = await this.model.findOne({
        transformer_id: maintenance.transformer_id
      }).sort({ maintenance_date: -1 });

      await Transformer.findByIdAndUpdate(maintenance.transformer_id, {
        last_maintenance_date: latestMaintenance?.maintenance_date || null,
        updated_by: userId
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in MaintenanceService.deleteMaintenance:', error);
      throw new ApiError(500, 'Failed to delete maintenance record');
    }
  }

  /**
   * Create timeline entry
   */
  async createTimelineEntry(transformer, eventType, userId, metadata = {}) {
    try {
      const timeline = new AssetTimeline({
        transformer_id: transformer._id,
        event_type: eventType,
        event_summary: `${eventType} - ${transformer.asset_id}`,
        metadata: metadata,
        created_by: userId
      });
      await timeline.save();
    } catch (error) {
      logger.error('Error creating timeline entry:', error);
    }
  }
}

module.exports = new MaintenanceService();