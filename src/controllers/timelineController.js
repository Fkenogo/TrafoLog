const TimelineService = require('../services/timelineService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class TimelineController {
  /**
   * Get transformer timeline
   * GET /api/timeline/transformer/:transformerId
   */
  getTransformerTimeline = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const timeline = await TimelineService.getTransformerTimeline(
      transformerId,
      parseInt(limit),
      parseInt(page)
    );

    return successResponse(res, 200, 'Transformer timeline retrieved successfully', timeline);
  });

  /**
   * Get recent activities
   * GET /api/timeline/recent
   */
  getRecentActivities = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { limit = 20 } = req.query;

    const activities = await TimelineService.getRecentActivities(
      userRole,
      territoryId,
      parseInt(limit)
    );

    return successResponse(res, 200, 'Recent activities retrieved successfully', activities);
  });

  /**
   * Export transformer timeline
   * GET /api/timeline/export/:transformerId
   */
  exportTimeline = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;
    const { format = 'pdf' } = req.query;

    const exportData = await TimelineService.exportTimeline(
      transformerId,
      format
    );

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=timeline_${transformerId}.pdf`);
      return res.send(exportData);
    }

    return successResponse(res, 200, 'Timeline exported successfully', exportData);
  });

  /**
   * Get timeline summary
   * GET /api/timeline/summary/:transformerId
   */
  getTimelineSummary = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;

    const summary = await TimelineService.getTimelineSummary(transformerId);

    return successResponse(res, 200, 'Timeline summary retrieved successfully', summary);
  });

  /**
   * Get event types
   * GET /api/timeline/event-types
   */
  getEventTypes = asyncHandler(async (req, res) => {
    const eventTypes = await TimelineService.getEventTypes();

    return successResponse(res, 200, 'Event types retrieved successfully', eventTypes);
  });

  /**
   * Get timeline by event type
   * GET /api/timeline/events/:eventType
   */
  getByEventType = asyncHandler(async (req, res) => {
    const { eventType } = req.params;
    const { transformerId, limit = 20 } = req.query;

    const events = await TimelineService.getByEventType(
      eventType,
      transformerId,
      parseInt(limit)
    );

    return successResponse(res, 200, 'Events retrieved successfully', events);
  });

  /**
   * Get timeline for date range
   * GET /api/timeline/date-range
   */
  getByDateRange = asyncHandler(async (req, res) => {
    const { transformerId, startDate, endDate, limit = 50 } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 400, 'Start date and end date are required');
    }

    const events = await TimelineService.getByDateRange(
      transformerId,
      new Date(startDate),
      new Date(endDate),
      parseInt(limit)
    );

    return successResponse(res, 200, 'Events retrieved successfully', events);
  });

  /**
   * Get latest events
   * GET /api/timeline/latest/:transformerId
   */
  getLatestEvents = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;
    const { limit = 10 } = req.query;

    const events = await TimelineService.getLatestEvents(
      transformerId,
      parseInt(limit)
    );

    return successResponse(res, 200, 'Latest events retrieved successfully', events);
  });

  /**
   * Get event count by type
   * GET /api/timeline/count-by-type/:transformerId
   */
  getCountByType = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;

    const counts = await TimelineService.getEventCountByType(transformerId);

    return successResponse(res, 200, 'Event counts retrieved successfully', counts);
  });

  /**
   * Get timeline statistics
   * GET /api/timeline/stats
   */
  getStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { startDate, endDate } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    if (userRole !== 'Super Admin' && territoryId) {
      filters.territory_id = territoryId;
    }

    const stats = await TimelineService.getStatistics(filters);

    return successResponse(res, 200, 'Timeline statistics retrieved successfully', stats);
  });

  /**
   * Generate activity report
   * POST /api/timeline/activity-report
   */
  generateActivityReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { transformerId, startDate, endDate, format = 'pdf' } = req.body;

    const report = await TimelineService.generateActivityReport({
      transformerId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      format,
      userId
    });

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=activity_report.pdf');
      return res.send(report);
    }

    return successResponse(res, 200, 'Activity report generated successfully', report);
  });

  /**
   * Get event details
   * GET /api/timeline/event/:eventId
   */
  getEventDetails = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const event = await TimelineService.getEventDetails(eventId);

    return successResponse(res, 200, 'Event details retrieved successfully', event);
  });

  /**
   * Search timeline
   * GET /api/timeline/search
   */
  search = asyncHandler(async (req, res) => {
    const { query, transformerId, startDate, endDate, limit = 20 } = req.query;

    if (!query) {
      return errorResponse(res, 400, 'Search query is required');
    }

    const results = await TimelineService.search({
      query,
      transformerId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: parseInt(limit)
    });

    return successResponse(res, 200, 'Search results retrieved successfully', results);
  });

  /**
   * Get timeline for multiple transformers
   * POST /api/timeline/bulk
   */
  getBulkTimeline = asyncHandler(async (req, res) => {
    const { transformerIds, limit = 10 } = req.body;

    if (!transformerIds || !Array.isArray(transformerIds) || transformerIds.length === 0) {
      return errorResponse(res, 400, 'Transformer IDs array is required');
    }

    const timelines = await TimelineService.getBulkTimeline(
      transformerIds,
      parseInt(limit)
    );

    return successResponse(res, 200, 'Bulk timeline retrieved successfully', timelines);
  });

  /**
   * Archive timeline entries
   * POST /api/timeline/archive
   */
  archiveTimeline = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { transformerId, olderThanDays = 365 } = req.body;

    const result = await TimelineService.archiveTimeline(
      transformerId,
      parseInt(olderThanDays),
      userId
    );

    return successResponse(res, 200, 'Timeline archived successfully', result);
  });

  /**
   * Get activity feed
   * GET /api/timeline/feed
   */
  getActivityFeed = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { limit = 50, page = 1 } = req.query;

    const feed = await TimelineService.getActivityFeed(
      userRole,
      territoryId,
      parseInt(limit),
      parseInt(page)
    );

    return successResponse(res, 200, 'Activity feed retrieved successfully', feed);
  });
}

const _timelineInstance = new TimelineController();
module.exports = new Proxy(_timelineInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `timelineController.${String(prop)} not yet implemented` });
  }
});