const AssetTimeline = require('../models/AssetTimeline');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const Installation = require('../models/Installation');
const BaseService = require('./baseService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class TimelineService extends BaseService {
  constructor() {
    super(AssetTimeline, 'AssetTimeline');
  }

  /**
   * Get transformer timeline
   */
  async getTransformerTimeline(transformerId, limit = 50, page = 1) {
    try {
      const transformer = await Transformer.findById(transformerId);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      const result = await this.getAll(
        { transformer_id: transformerId },
        {
          page,
          limit,
          sort: { event_date: -1 },
          populate: ['created_by']
        }
      );

      // Build timeline with related records
      const timeline = await this.buildTimelineWithRelations(result.data);

      return {
        ...result,
        data: timeline
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting transformer timeline:', error);
      throw new ApiError(500, 'Failed to get transformer timeline');
    }
  }

  /**
   * Build timeline with related records
   */
  async buildTimelineWithRelations(events) {
    const timeline = [];

    for (const event of events) {
      let relatedData = null;

      if (event.linked_record_type && event.linked_record_id) {
        try {
          switch (event.linked_record_type) {
            case 'Inspection':
              relatedData = await Inspection.findById(event.linked_record_id)
                .populate('inspector_id', 'name email');
              break;
            case 'Maintenance':
              relatedData = await Maintenance.findById(event.linked_record_id)
                .populate('technician_id', 'name email');
              break;
            case 'Fault':
              relatedData = await Fault.findById(event.linked_record_id)
                .populate('reported_by', 'name email')
                .populate('assigned_to', 'name email');
              break;
            case 'Installation':
              relatedData = await Installation.findById(event.linked_record_id);
              break;
            default:
              break;
          }
        } catch (error) {
          logger.error('Error fetching related data:', error);
        }
      }

      timeline.push({
        ...event.toObject(),
        relatedData
      });
    }

    return timeline;
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(userRole, territoryId, limit = 20) {
    try {
      const query = {};
      
      if (userRole !== 'Super Admin' && territoryId) {
        // For non-super admins, get activities from their territory
        // This requires joining with transformer
        const transformers = await Transformer.find({
          'location_operational.territory_id': territoryId
        }).select('_id');

        const transformerIds = transformers.map(t => t._id);
        query.transformer_id = { $in: transformerIds };
      }

      const events = await this.model.find(query)
        .sort({ event_date: -1 })
        .limit(limit)
        .populate('created_by', 'name email role')
        .populate('transformer_id', 'asset_id display_rating location_administrative');

      return events;
    } catch (error) {
      logger.error('Error getting recent activities:', error);
      throw new ApiError(500, 'Failed to get recent activities');
    }
  }

  /**
   * Export transformer timeline
   */
  async exportTimeline(transformerId, format = 'pdf') {
    try {
      const transformer = await Transformer.findById(transformerId);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      const events = await this.model.find({ transformer_id: transformerId })
        .sort({ event_date: -1 })
        .populate('created_by', 'name email');

      const timeline = await this.buildTimelineWithRelations(events);

      const exportData = {
        transformer,
        events: timeline,
        generatedAt: new Date(),
        summary: {
          totalEvents: events.length,
          inspections: events.filter(e => e.event_type === 'INSPECTED').length,
          faults: events.filter(e => e.is_fault_related).length,
          maintenance: events.filter(e => e.is_maintenance_related).length
        }
      };

      if (format === 'json') {
        return exportData;
      }

      // PDF export would be handled by report service
      return exportData;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error exporting timeline:', error);
      throw new ApiError(500, 'Failed to export timeline');
    }
  }

  /**
   * Get timeline summary
   */
  async getTimelineSummary(transformerId) {
    try {
      const transformer = await Transformer.findById(transformerId);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      const events = await this.model.find({ transformer_id: transformerId });

      const summary = {
        totalEvents: events.length,
        byType: this.getEventTypeSummary(events),
        timeline: {
          firstEvent: events.length > 0 ? events[events.length - 1] : null,
          lastEvent: events.length > 0 ? events[0] : null,
          activeYears: this.getActiveYears(events)
        },
        statistics: {
          inspections: events.filter(e => e.event_type === 'INSPECTED').length,
          faults: events.filter(e => e.is_fault_related).length,
          maintenance: events.filter(e => e.is_maintenance_related).length,
          installations: events.filter(e => e.event_type === 'INSTALLED').length
        }
      };

      return summary;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting timeline summary:', error);
      throw new ApiError(500, 'Failed to get timeline summary');
    }
  }

  /**
   * Get event type summary
   */
  getEventTypeSummary(events) {
    const summary = {};
    events.forEach(event => {
      summary[event.event_type] = (summary[event.event_type] || 0) + 1;
    });
    return summary;
  }

  /**
   * Get active years
   */
  getActiveYears(events) {
    if (events.length === 0) return [];

    const years = new Set();
    events.forEach(event => {
      const year = event.event_date.getFullYear();
      years.add(year);
    });

    return Array.from(years).sort();
  }

  /**
   * Get event types
   */
  async getEventTypes() {
    return [
      { value: 'REGISTERED', label: 'Registered', icon: '📋', color: '#28a745' },
      { value: 'VERIFIED', label: 'Verified', icon: '✅', color: '#17a2b8' },
      { value: 'UPDATED', label: 'Updated', icon: '📝', color: '#6c757d' },
      { value: 'DECOMMISSIONED', label: 'Decommissioned', icon: '⚰️', color: '#dc3545' },
      { value: 'INSPECTED', label: 'Inspected', icon: '🔍', color: '#007bff' },
      { value: 'MAINTENANCE_PERFORMED', label: 'Maintenance', icon: '🔧', color: '#fd7e14' },
      { value: 'FAULT_REPORTED', label: 'Fault Reported', icon: '⚠️', color: '#dc3545' },
      { value: 'FAULT_ASSIGNED', label: 'Fault Assigned', icon: '📌', color: '#ffc107' },
      { value: 'FAULT_RESOLVED', label: 'Fault Resolved', icon: '✔️', color: '#28a745' },
      { value: 'FAULT_CLOSED', label: 'Fault Closed', icon: '🔒', color: '#6c757d' },
      { value: 'INSTALLED', label: 'Installed', icon: '🔌', color: '#007bff' },
      { value: 'REPLACED', label: 'Replaced', icon: '🔄', color: '#fd7e14' },
      { value: 'RELOCATED', label: 'Relocated', icon: '🚚', color: '#17a2b8' },
      { value: 'LOAD_SPLIT', label: 'Load Split', icon: '⚡', color: '#6610f2' },
      { value: 'OVERLOAD_DETECTED', label: 'Overload Detected', icon: '🔥', color: '#dc3545' },
      { value: 'COMPONENT_REPLACED', label: 'Component Replaced', icon: '🔄', color: '#fd7e14' }
    ];
  }

  /**
   * Get events by type
   */
  async getByEventType(eventType, transformerId = null, limit = 20) {
    try {
      const query = { event_type: eventType };
      if (transformerId) {
        query.transformer_id = transformerId;
      }

      return await this.model.find(query)
        .sort({ event_date: -1 })
        .limit(limit)
        .populate('created_by', 'name email')
        .populate('transformer_id', 'asset_id display_rating');
    } catch (error) {
      logger.error('Error getting events by type:', error);
      throw new ApiError(500, 'Failed to get events by type');
    }
  }

  /**
   * Get events by date range
   */
  async getByDateRange(transformerId, startDate, endDate, limit = 50) {
    try {
      const query = {
        transformer_id: transformerId,
        event_date: {
          $gte: startDate,
          $lte: endDate
        }
      };

      return await this.model.find(query)
        .sort({ event_date: -1 })
        .limit(limit)
        .populate('created_by', 'name email');
    } catch (error) {
      logger.error('Error getting events by date range:', error);
      throw new ApiError(500, 'Failed to get events by date range');
    }
  }

  /**
   * Get latest events
   */
  async getLatestEvents(transformerId, limit = 10) {
    try {
      return await this.model.find({ transformer_id: transformerId })
        .sort({ event_date: -1 })
        .limit(limit)
        .populate('created_by', 'name email');
    } catch (error) {
      logger.error('Error getting latest events:', error);
      throw new ApiError(500, 'Failed to get latest events');
    }
  }

  /**
   * Get event count by type
   */
  async getEventCountByType(transformerId) {
    try {
      const counts = await this.model.aggregate([
        {
          $match: { transformer_id: transformerId }
        },
        {
          $group: {
            _id: '$event_type',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return counts;
    } catch (error) {
      logger.error('Error getting event count by type:', error);
      throw new ApiError(500, 'Failed to get event count by type');
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(filters = {}) {
    try {
      const match = {};
      if (filters.startDate || filters.endDate) {
        match.event_date = {};
        if (filters.startDate) match.event_date.$gte = filters.startDate;
        if (filters.endDate) match.event_date.$lte = filters.endDate;
      }

      if (filters.territory_id) {
        // This would require joining with transformer
        // For now, we'll do a separate query
      }

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            inspections: {
              $sum: { $cond: [{ $eq: ['$event_type', 'INSPECTED'] }, 1, 0] }
            },
            faults: {
              $sum: {
                $cond: [
                  { $in: ['$event_type', ['FAULT_REPORTED', 'FAULT_ASSIGNED', 'FAULT_RESOLVED']] },
                  1,
                  0
                ]
              }
            },
            maintenance: {
              $sum: { $cond: [{ $eq: ['$event_type', 'MAINTENANCE_PERFORMED'] }, 1, 0] }
            },
            installations: {
              $sum: { $cond: [{ $eq: ['$event_type', 'INSTALLED'] }, 1, 0] }
            }
          }
        }
      ]);

      // Get daily trend
      const dailyTrend = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              year: { $year: '$event_date' },
              month: { $month: '$event_date' },
              day: { $dayOfMonth: '$event_date' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // Get top events
      const topEvents = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$event_type',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      return {
        ...(stats[0] || {
          total: 0,
          inspections: 0,
          faults: 0,
          maintenance: 0,
          installations: 0
        }),
        dailyTrend,
        topEvents
      };
    } catch (error) {
      logger.error('Error getting statistics:', error);
      throw new ApiError(500, 'Failed to get statistics');
    }
  }

  /**
   * Generate activity report
   */
  async generateActivityReport(data) {
    try {
      const { transformerId, startDate, endDate, format = 'pdf', userId } = data;

      const transformer = await Transformer.findById(transformerId);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      const query = { transformer_id: transformerId };
      if (startDate || endDate) {
        query.event_date = {};
        if (startDate) query.event_date.$gte = startDate;
        if (endDate) query.event_date.$lte = endDate;
      }

      const events = await this.model.find(query)
        .sort({ event_date: -1 })
        .populate('created_by', 'name email');

      const report = {
        transformer,
        events,
        startDate: startDate || null,
        endDate: endDate || null,
        generatedAt: new Date(),
        generatedBy: userId
      };

      // Format based on type
      if (format === 'json') {
        return report;
      }

      // PDF would be handled by report service
      return report;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error generating activity report:', error);
      throw new ApiError(500, 'Failed to generate activity report');
    }
  }

  /**
   * Get event details
   */
  async getEventDetails(eventId) {
    try {
      const event = await this.getById(eventId, ['created_by', 'transformer_id']);
      
      if (!event) {
        throw new ApiError(404, 'Event not found');
      }

      // Get related data
      let relatedData = null;
      if (event.linked_record_type && event.linked_record_id) {
        switch (event.linked_record_type) {
          case 'Inspection':
            relatedData = await Inspection.findById(event.linked_record_id)
              .populate('inspector_id', 'name email');
            break;
          case 'Maintenance':
            relatedData = await Maintenance.findById(event.linked_record_id)
              .populate('technician_id', 'name email');
            break;
          case 'Fault':
            relatedData = await Fault.findById(event.linked_record_id)
              .populate('reported_by', 'name email')
              .populate('assigned_to', 'name email');
            break;
          case 'Installation':
            relatedData = await Installation.findById(event.linked_record_id);
            break;
          default:
            break;
        }
      }

      return {
        ...event.toObject(),
        relatedData
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting event details:', error);
      throw new ApiError(500, 'Failed to get event details');
    }
  }

  /**
   * Search timeline
   */
  async search(params) {
    try {
      const { query, transformerId, startDate, endDate, limit = 20 } = params;

      const searchQuery = {
        $or: [
          { event_summary: { $regex: query, $options: 'i' } },
          { event_details: { $regex: query, $options: 'i' } },
          { 'metadata.searchable': { $regex: query, $options: 'i' } }
        ]
      };

      if (transformerId) {
        searchQuery.transformer_id = transformerId;
      }

      if (startDate || endDate) {
        searchQuery.event_date = {};
        if (startDate) searchQuery.event_date.$gte = startDate;
        if (endDate) searchQuery.event_date.$lte = endDate;
      }

      return await this.model.find(searchQuery)
        .sort({ event_date: -1 })
        .limit(limit)
        .populate('created_by', 'name email')
        .populate('transformer_id', 'asset_id display_rating');
    } catch (error) {
      logger.error('Error searching timeline:', error);
      throw new ApiError(500, 'Failed to search timeline');
    }
  }

  /**
   * Get bulk timeline
   */
  async getBulkTimeline(transformerIds, limit = 10) {
    try {
      const results = {};

      for (const transformerId of transformerIds) {
        const events = await this.model.find({ transformer_id: transformerId })
          .sort({ event_date: -1 })
          .limit(limit)
          .populate('created_by', 'name email');

        results[transformerId] = events;
      }

      return results;
    } catch (error) {
      logger.error('Error getting bulk timeline:', error);
      throw new ApiError(500, 'Failed to get bulk timeline');
    }
  }

  /**
   * Archive timeline entries
   */
  async archiveTimeline(transformerId, olderThanDays = 365, userId) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const query = {
        transformer_id: transformerId,
        event_date: { $lt: cutoffDate }
      };

      // Mark as archived (soft delete)
      const result = await this.model.updateMany(
        query,
        {
          is_archived: true,
          archived_at: new Date(),
          archived_by: userId
        }
      );

      return {
        archived: result.modifiedCount,
        cutoffDate
      };
    } catch (error) {
      logger.error('Error archiving timeline:', error);
      throw new ApiError(500, 'Failed to archive timeline');
    }
  }

  /**
   * Get activity feed
   */
  async getActivityFeed(userRole, territoryId, limit = 50, page = 1) {
    try {
      const query = {};
      
      if (userRole !== 'Super Admin' && territoryId) {
        const transformers = await Transformer.find({
          'location_operational.territory_id': territoryId
        }).select('_id');

        const transformerIds = transformers.map(t => t._id);
        query.transformer_id = { $in: transformerIds };
      }

      const result = await this.getAll(query, {
        page,
        limit,
        sort: { event_date: -1 },
        populate: ['created_by', 'transformer_id']
      });

      return result;
    } catch (error) {
      logger.error('Error getting activity feed:', error);
      throw new ApiError(500, 'Failed to get activity feed');
    }
  }
}

module.exports = new TimelineService();