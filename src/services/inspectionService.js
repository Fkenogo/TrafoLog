const Inspection = require('../models/Inspection');
const Transformer = require('../models/Transformer');
const AssetTimeline = require('../models/AssetTimeline');
const BaseService = require('./baseService');
const { calculateLoadPercentage } = require('../utils/loadCalculator');
const NotificationService = require('./notificationService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class InspectionService extends BaseService {
  constructor() {
    super(Inspection, 'Inspection');
  }

  /**
   * Create a new inspection
   */
  async createInspection(data, userId, files = []) {
    try {
      // Verify transformer exists
      const transformer = await Transformer.findById(data.transformer_id);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Calculate load percentage
      let loadPercentage = 0;
      let overloadFlag = false;
      if (data.electrical && data.electrical.load_current_a && data.electrical.load_current_b && data.electrical.load_current_c) {
        loadPercentage = calculateLoadPercentage(
          transformer.kva_rating,
          data.electrical.load_current_a,
          data.electrical.load_current_b,
          data.electrical.load_current_c
        );
        overloadFlag = loadPercentage > 90;
      }

      // Set GPS location from device if provided
      if (data.gps_lat && data.gps_lng) {
        data.gps_at_inspection = {
          type: 'Point',
          coordinates: [data.gps_lng, data.gps_lat]
        };
      }

      // Set rating discrepancy flag
      const ratingDiscrepancy = data.network_voltage_confirmed === false || 
                               data.kva_rating_confirmed === false;

      // Prepare inspection data
      const inspectionData = {
        ...data,
        inspector_id: userId,
        'electrical.load_percentage': loadPercentage,
        'electrical.overload_flag': overloadFlag,
        rating_discrepancy_flag: ratingDiscrepancy,
        photos: files.map(file => file.filename || file.path)
      };

      // Create inspection
      const inspection = await this.create(inspectionData, userId);

      // Update transformer
      await Transformer.findByIdAndUpdate(data.transformer_id, {
        last_inspection_date: inspection.inspection_date || new Date(),
        last_load_reading_date: inspection.inspection_date || new Date(),
        last_load_percentage: loadPercentage,
        updated_by: userId
      });

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'INSPECTED', userId, {
        inspection_id: inspection._id,
        condition: data.physical?.overall_condition || 'Not specified'
      });

      // Send notification for urgent actions
      if (data.recommended_action === 'Urgent Repair' || data.recommended_action === 'Replace') {
        await NotificationService.sendInspectionAlert({
          transformer,
          inspection,
          action: data.recommended_action
        });
      }

      // Send overload notification
      if (overloadFlag) {
        await NotificationService.sendOverloadAlert({
          transformer,
          inspection,
          loadPercentage
        });
      }

      return inspection;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in InspectionService.createInspection:', error);
      throw new ApiError(500, 'Failed to create inspection');
    }
  }

  /**
   * Get inspections for a transformer
   */
  async getInspectionsByTransformer(transformerId, page = 1, limit = 20) {
    try {
      const result = await this.getAll(
        { transformer_id: transformerId },
        {
          page,
          limit,
          sort: { inspection_date: -1 },
          populate: ['inspector_id']
        }
      );

      return result;
    } catch (error) {
      logger.error('Error in InspectionService.getInspectionsByTransformer:', error);
      throw new ApiError(500, 'Failed to get inspections');
    }
  }

  /**
   * Get latest inspection for a transformer
   */
  async getLatestInspection(transformerId) {
    try {
      const inspection = await this.model.findOne({
        transformer_id: transformerId
      })
      .sort({ inspection_date: -1 })
      .populate('inspector_id', 'name email');

      return inspection;
    } catch (error) {
      logger.error('Error in InspectionService.getLatestInspection:', error);
      throw new ApiError(500, 'Failed to get latest inspection');
    }
  }

  /**
   * Get overdue inspections
   */
  async getOverdueInspections(days = 90, territoryId = null) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const query = {
        is_deleted: false
      };

      if (territoryId) {
        query['location_operational.territory_id'] = territoryId;
      }

      // Find transformers with no inspection in the last X days
      const transformers = await Transformer.find({
        ...query,
        $or: [
          { last_inspection_date: { $lt: cutoffDate } },
          { last_inspection_date: { $exists: false } }
        ]
      });

      return transformers;
    } catch (error) {
      logger.error('Error in InspectionService.getOverdueInspections:', error);
      throw new ApiError(500, 'Failed to get overdue inspections');
    }
  }

  /**
   * Get inspection statistics
   */
  async getStatistics(filters = {}) {
    try {
      const match = {};
      if (filters.territory_id) {
        // This would require joining with transformer
        // For now, we'll use a simpler approach
      }

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            routine: {
              $sum: { $cond: [{ $eq: ['$visit_type', 'Routine Inspection'] }, 1, 0] }
            },
            followup: {
              $sum: { $cond: [{ $eq: ['$visit_type', 'Follow-up'] }, 1, 0] }
            },
            audit: {
              $sum: { $cond: [{ $eq: ['$visit_type', 'Audit'] }, 1, 0] }
            },
            overloadDetected: {
              $sum: { $cond: [{ $eq: ['$electrical.overload_flag', true] }, 1, 0] }
            },
            urgentActions: {
              $sum: {
                $cond: [
                  { $in: ['$recommended_action', ['Urgent Repair', 'Replace']] },
                  1,
                  0
                ]
              }
            },
            averageLoad: { $avg: '$electrical.load_percentage' }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        routine: 0,
        followup: 0,
        audit: 0,
        overloadDetected: 0,
        urgentActions: 0,
        averageLoad: 0
      };
    } catch (error) {
      logger.error('Error in InspectionService.getStatistics:', error);
      throw new ApiError(500, 'Failed to get inspection statistics');
    }
  }

  /**
   * Update inspection
   */
  async updateInspection(id, data, userId, files = []) {
    try {
      const inspection = await this.getById(id);
      if (!inspection) {
        throw new ApiError(404, 'Inspection not found');
      }

      // Update photos if provided
      if (files && files.length > 0) {
        data.photos = files.map(file => file.filename || file.path);
      }

      // Update transformer if inspection date changed
      if (data.inspection_date) {
        await Transformer.findByIdAndUpdate(inspection.transformer_id, {
          last_inspection_date: data.inspection_date,
          updated_by: userId
        });
      }

      const updated = await this.update(id, data, userId);

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in InspectionService.updateInspection:', error);
      throw new ApiError(500, 'Failed to update inspection');
    }
  }

  /**
   * Delete inspection
   */
  async deleteInspection(id, userId) {
    try {
      const inspection = await this.getById(id);
      if (!inspection) {
        throw new ApiError(404, 'Inspection not found');
      }

      await this.delete(id, userId);

      // Update transformer - set last inspection to previous one
      const latestInspection = await this.model.findOne({
        transformer_id: inspection.transformer_id
      }).sort({ inspection_date: -1 });

      await Transformer.findByIdAndUpdate(inspection.transformer_id, {
        last_inspection_date: latestInspection?.inspection_date || null,
        updated_by: userId
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in InspectionService.deleteInspection:', error);
      throw new ApiError(500, 'Failed to delete inspection');
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

module.exports = new InspectionService();