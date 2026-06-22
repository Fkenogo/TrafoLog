const Fault = require('../models/Fault');
const Transformer = require('../models/Transformer');
const AssetTimeline = require('../models/AssetTimeline');
const BaseService = require('./baseService');
const NotificationService = require('./notificationService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class FaultService extends BaseService {
  constructor() {
    super(Fault, 'Fault');
  }

  /**
   * Report a new fault
   */
  async reportFault(data, userId, files = []) {
    try {
      // Verify transformer exists
      const transformer = await Transformer.findById(data.transformer_id);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Set network voltage from transformer
      data.network_voltage_kv = transformer.network_voltage_kv;

      // Prepare fault data
      const faultData = {
        ...data,
        reported_by: userId,
        fault_date: data.fault_date || new Date(),
        photos: files.map(file => file.filename || file.path)
      };

      // Create fault
      const fault = await this.create(faultData, userId);

      // Update transformer
      await Transformer.findByIdAndUpdate(data.transformer_id, {
        has_open_fault: true,
        operational_status: 'Faulty',
        updated_by: userId
      });

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'FAULT_REPORTED', userId, {
        fault_id: fault._id,
        fault_type: data.fault_type,
        severity: data.severity
      });

      // Send notifications for Critical and Complete Outage
      if (['Critical', 'Complete Outage'].includes(data.severity)) {
        await NotificationService.sendFaultAlert({
          fault,
          transformer,
          priority: 'critical'
        });
      }

      return fault;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in FaultService.reportFault:', error);
      throw new ApiError(500, 'Failed to report fault');
    }
  }

  /**
   * Assign fault to team
   */
  async assignFault(faultId, assignedTo, userId) {
    try {
      const fault = await this.getById(faultId);
      if (!fault) {
        throw new ApiError(404, 'Fault not found');
      }

      // Check if fault can be assigned
      if (fault.fault_status === 'Resolved' || fault.fault_status === 'Closed') {
        throw new ApiError(400, 'Cannot assign a resolved or closed fault');
      }

      // Update fault
      const updated = await this.update(
        faultId,
        {
          assigned_to: assignedTo,
          date_assigned: new Date(),
          fault_status: 'Assigned',
          target_resolution_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        },
        userId
      );

      // Get transformer
      const transformer = await Transformer.findById(fault.transformer_id);

      // Send notification
      await NotificationService.sendAssignmentNotification({
        fault: updated,
        transformer,
        assignedTo
      });

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'FAULT_ASSIGNED', userId, {
        fault_id: fault._id,
        assigned_to: assignedTo
      });

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in FaultService.assignFault:', error);
      throw new ApiError(500, 'Failed to assign fault');
    }
  }

  /**
   * Resolve fault
   */
  async resolveFault(faultId, data, userId, files = []) {
    try {
      const fault = await this.getById(faultId);
      if (!fault) {
        throw new ApiError(404, 'Fault not found');
      }

      // Check if fault can be resolved
      if (fault.fault_status === 'Resolved' || fault.fault_status === 'Closed') {
        throw new ApiError(400, 'Fault already resolved or closed');
      }

      // Calculate downtime
      const resolvedDate = data.resolved_date || new Date();
      const downtimeHours = Math.round(
        (resolvedDate - fault.fault_date) / (1000 * 60 * 60)
      );

      // Prepare resolution data
      const resolutionData = {
        ...data,
        resolved_date: resolvedDate,
        resolved_by: userId,
        fault_status: 'Resolved',
        downtime_hours: downtimeHours,
        photos_after_repair: files.map(file => file.filename || file.path)
      };

      // Update fault
      const updated = await this.update(faultId, resolutionData, userId);

      // Get transformer
      const transformer = await Transformer.findById(fault.transformer_id);

      // Update transformer - clear open fault flag
      await Transformer.findByIdAndUpdate(fault.transformer_id, {
        has_open_fault: false,
        operational_status: 'Active',
        updated_by: userId
      });

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'FAULT_RESOLVED', userId, {
        fault_id: fault._id,
        downtime_hours: downtimeHours
      });

      // Send notification
      await NotificationService.sendResolutionNotification({
        fault: updated,
        transformer
      });

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in FaultService.resolveFault:', error);
      throw new ApiError(500, 'Failed to resolve fault');
    }
  }

  /**
   * Close fault after review
   */
  async closeFault(faultId, userId) {
    try {
      const fault = await this.getById(faultId);
      if (!fault) {
        throw new ApiError(404, 'Fault not found');
      }

      if (fault.fault_status !== 'Resolved') {
        throw new ApiError(400, 'Only resolved faults can be closed');
      }

      // Update fault
      const updated = await this.update(
        faultId,
        {
          fault_status: 'Closed',
          reviewed_by: userId,
          reviewed_at: new Date()
        },
        userId
      );

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in FaultService.closeFault:', error);
      throw new ApiError(500, 'Failed to close fault');
    }
  }

  /**
   * Escalate fault
   */
  async escalateFault(faultId, reason, userId) {
    try {
      const fault = await this.getById(faultId);
      if (!fault) {
        throw new ApiError(404, 'Fault not found');
      }

      // Update fault with escalation
      const updated = await this.update(
        faultId,
        {
          escalation_reason: reason,
          escalated_at: new Date(),
          escalated_by: userId,
          fault_status: 'In Progress' // Or whatever status makes sense
        },
        userId
      );

      // Send escalation notification
      const transformer = await Transformer.findById(fault.transformer_id);
      await NotificationService.sendEscalationNotification({
        fault: updated,
        transformer,
        reason
      });

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in FaultService.escalateFault:', error);
      throw new ApiError(500, 'Failed to escalate fault');
    }
  }

  /**
   * Get open faults
   */
  async getOpenFaults(filters = {}) {
    try {
      const query = {
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
      };

      if (filters.territory_id) {
        // Need to join with transformer
        // We'll use aggregation
        const faults = await this.model.aggregate([
          {
            $match: query
          },
          {
            $lookup: {
              from: 'transformers',
              localField: 'transformer_id',
              foreignField: '_id',
              as: 'transformer'
            }
          },
          {
            $unwind: '$transformer'
          },
          {
            $match: {
              'transformer.location_operational.territory_id': filters.territory_id
            }
          },
          {
            $sort: { created_at: -1 }
          }
        ]);

        return faults;
      }

      if (filters.assigned_to) {
        query.assigned_to = filters.assigned_to;
      }

      return await this.model.find(query)
        .populate('transformer_id')
        .populate('assigned_to', 'name email')
        .sort({ created_at: -1 });
    } catch (error) {
      logger.error('Error in FaultService.getOpenFaults:', error);
      throw new ApiError(500, 'Failed to get open faults');
    }
  }

  /**
   * Get faults assigned to user
   */
  async getFaultsAssignedToUser(userId) {
    try {
      return await this.model.find({
        assigned_to: userId,
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
      })
      .populate('transformer_id')
      .sort({ created_at: -1 });
    } catch (error) {
      logger.error('Error in FaultService.getFaultsAssignedToUser:', error);
      throw new ApiError(500, 'Failed to get assigned faults');
    }
  }

  /**
   * Get faults for a transformer
   */
  async getFaultsByTransformer(transformerId) {
    try {
      return await this.model.find({
        transformer_id: transformerId
      })
      .populate('reported_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('resolved_by', 'name email')
      .sort({ fault_date: -1 });
    } catch (error) {
      logger.error('Error in FaultService.getFaultsByTransformer:', error);
      throw new ApiError(500, 'Failed to get faults');
    }
  }

  /**
   * Get fault statistics
   */
  async getFaultStatistics(filters = {}) {
    try {
      const match = {};

      if (filters.territory_id) {
        // We need to join with transformer
        // For now, we'll do a simpler query
      }

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: {
              $sum: {
                $cond: [
                  { $in: ['$fault_status', ['Open', 'Assigned', 'In Progress']] },
                  1,
                  0
                ]
              }
            },
            resolved: {
              $sum: { $cond: [{ $eq: ['$fault_status', 'Resolved'] }, 1, 0] }
            },
            closed: {
              $sum: { $cond: [{ $eq: ['$fault_status', 'Closed'] }, 1, 0] }
            },
            critical: {
              $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] }
            },
            completeOutage: {
              $sum: { $cond: [{ $eq: ['$severity', 'Complete Outage'] }, 1, 0] }
            },
            major: {
              $sum: { $cond: [{ $eq: ['$severity', 'Major'] }, 1, 0] }
            },
            minor: {
              $sum: { $cond: [{ $eq: ['$severity', 'Minor'] }, 1, 0] }
            },
            averageDowntime: { $avg: '$downtime_hours' },
            maxDowntime: { $max: '$downtime_hours' },
            minDowntime: { $min: '$downtime_hours' }
          }
        }
      ]);

      // Get fault types breakdown
      const typeBreakdown = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$fault_type',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get monthly trend
      const monthlyTrend = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$fault_date' },
              month: { $month: '$fault_date' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return {
        ...(stats[0] || {
          total: 0,
          open: 0,
          resolved: 0,
          closed: 0,
          critical: 0,
          completeOutage: 0,
          major: 0,
          minor: 0,
          averageDowntime: 0,
          maxDowntime: 0,
          minDowntime: 0
        }),
        typeBreakdown,
        monthlyTrend
      };
    } catch (error) {
      logger.error('Error in FaultService.getFaultStatistics:', error);
      throw new ApiError(500, 'Failed to get fault statistics');
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

module.exports = new FaultService();