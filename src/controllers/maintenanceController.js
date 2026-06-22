const MaintenanceService = require('../services/maintenanceService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class MaintenanceController {
  /**
   * Get all maintenance records
   * GET /api/maintenance
   */
  getAll = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      transformer_id, 
      maintenance_type,
      startDate,
      endDate 
    } = req.query;

    const filters = {};
    if (transformer_id) filters.transformer_id = transformer_id;
    if (maintenance_type) filters.maintenance_type = maintenance_type;
    
    if (startDate || endDate) {
      filters.maintenance_date = {};
      if (startDate) filters.maintenance_date.$gte = new Date(startDate);
      if (endDate) filters.maintenance_date.$lte = new Date(endDate);
    }

    const result = await MaintenanceService.getAll(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { maintenance_date: -1 },
      populate: ['technician_id', 'transformer_id']
    });

    return successResponse(res, 200, 'Maintenance records retrieved successfully', result);
  });

  /**
   * Get maintenance records for a transformer
   * GET /api/maintenance/transformer/:transformerId
   */
  getByTransformer = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await MaintenanceService.getMaintenanceByTransformer(
      transformerId,
      parseInt(page),
      parseInt(limit)
    );

    return successResponse(res, 200, 'Maintenance records retrieved successfully', result);
  });

  /**
   * Get upcoming maintenance
   * GET /api/maintenance/upcoming
   */
  getUpcoming = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const territoryId = req.user.territory_id;

    const maintenance = await MaintenanceService.getUpcomingMaintenance(
      parseInt(days),
      territoryId
    );

    return successResponse(res, 200, 'Upcoming maintenance retrieved successfully', maintenance);
  });

  /**
   * Get maintenance by ID
   * GET /api/maintenance/:id
   */
  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const maintenance = await MaintenanceService.getById(id, ['technician_id', 'transformer_id']);

    return successResponse(res, 200, 'Maintenance record retrieved successfully', maintenance);
  });

  /**
   * Create a new maintenance record
   * POST /api/maintenance
   */
  create = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const files = req.files || {};

    const maintenance = await MaintenanceService.createMaintenance(
      req.body,
      userId,
      files
    );

    return successResponse(res, 201, 'Maintenance record created successfully', maintenance);
  });

  /**
   * Update maintenance record
   * PUT /api/maintenance/:id
   */
  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const files = req.files || {};

    const maintenance = await MaintenanceService.updateMaintenance(
      id,
      req.body,
      userId,
      files
    );

    return successResponse(res, 200, 'Maintenance record updated successfully', maintenance);
  });

  /**
   * Delete maintenance record
   * DELETE /api/maintenance/:id
   */
  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await MaintenanceService.deleteMaintenance(id, userId);

    return successResponse(res, 200, 'Maintenance record deleted successfully', result);
  });

  /**
   * Get maintenance statistics
   * GET /api/maintenance/stats
   */
  getStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const filters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const stats = await MaintenanceService.getStatistics(filters);

    return successResponse(res, 200, 'Maintenance statistics retrieved successfully', stats);
  });

  /**
   * Get maintenance by type
   * GET /api/maintenance/type/:type
   */
  getByType = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await MaintenanceService.getAll(
      { maintenance_type: type },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { maintenance_date: -1 },
        populate: ['technician_id', 'transformer_id']
      }
    );

    return successResponse(res, 200, 'Maintenance records retrieved successfully', result);
  });

  /**
   * Review maintenance record
   * POST /api/maintenance/:id/review
   */
  review = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { review_notes } = req.body;

    const maintenance = await MaintenanceService.reviewMaintenance(
      id,
      userId,
      review_notes
    );

    return successResponse(res, 200, 'Maintenance record reviewed successfully', maintenance);
  });

  /**
   * Schedule next maintenance
   * POST /api/maintenance/:id/schedule
   */
  schedule = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { next_maintenance_date, notes } = req.body;

    const maintenance = await MaintenanceService.scheduleNextMaintenance(
      id,
      next_maintenance_date,
      notes
    );

    return successResponse(res, 200, 'Next maintenance scheduled successfully', maintenance);
  });
}

const _maintenanceInstance = new MaintenanceController();
module.exports = new Proxy(_maintenanceInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `maintenanceController.${String(prop)} not yet implemented` });
  }
});