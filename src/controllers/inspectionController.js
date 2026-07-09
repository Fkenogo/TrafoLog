const InspectionService = require('../services/inspectionService');
const { successResponse, errorResponse } = require('../utils/helpers');

class InspectionController {
  /**
   * Log inspection
   * POST /api/inspections
   */
  async create(req, res, next) {
    try {
      const inspection = await InspectionService.createInspection(
        req.body,
        req.user.id,
        req.files // Uploaded photos
      );
      
      return successResponse(res, 201, 'Inspection logged successfully', inspection);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get inspections for a transformer
   * GET /api/inspections/transformer/:transformerId
   */
  async getByTransformer(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const inspections = await InspectionService.getInspectionsByTransformer(
        req.params.transformerId,
        parseInt(page),
        parseInt(limit)
      );
      
      return successResponse(res, 200, 'Inspections retrieved successfully', inspections);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get inspection by ID
   * GET /api/inspections/:id
   */
  async getById(req, res, next) {
    try {
      const inspection = await InspectionService.getById(req.params.id, ['transformer_id', 'inspector_id']);
      return successResponse(res, 200, 'Inspection retrieved successfully', inspection);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get inspection statistics
   * GET /api/inspections/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await InspectionService.getStatistics(req.query);
      return successResponse(res, 200, 'Statistics retrieved successfully', stats);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const {
        page = 1, limit = 20, transformer_id, inspector_id,
        visit_type, condition, overloaded, recommended_action,
        startDate, endDate
      } = req.query;

      const filters = { is_deleted: false };
      if (transformer_id) filters.transformer_id = transformer_id;
      if (inspector_id) filters.inspector_id = inspector_id;
      if (visit_type) filters.visit_type = visit_type;
      if (condition) filters['physical.overall_condition'] = condition;
      if (overloaded !== undefined) filters['electrical.overload_flag'] = overloaded === 'true';
      if (recommended_action) filters.recommended_action = recommended_action;
      if (startDate || endDate) {
        filters.inspection_date = {};
        if (startDate) filters.inspection_date.$gte = new Date(startDate);
        if (endDate) filters.inspection_date.$lte = new Date(endDate);
      }

      const result = await InspectionService.getAll(filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { inspection_date: -1 },
        populate: ['inspector_id']
      });

      return successResponse(res, 200, 'Inspections retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await InspectionService.updateInspection(
        req.params.id,
        req.body,
        req.user.id,
        req.files || []
      );
      return successResponse(res, 200, 'Inspection updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await InspectionService.deleteInspection(req.params.id, req.user.id);
      return successResponse(res, 200, 'Inspection deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getOverdue(req, res, next) {
    try {
      const { days = 90 } = req.query;
      const territoryId = req.user.territory_id;
      const transformers = await InspectionService.getOverdueInspections(parseInt(days), territoryId);
      return successResponse(res, 200, 'Overdue inspections retrieved successfully', transformers);
    } catch (error) {
      next(error);
    }
  }

  async getLatest(req, res, next) {
    try {
      const inspection = await InspectionService.getLatestInspection(req.params.transformerId);
      if (!inspection) {
        return errorResponse(res, 404, 'No inspection found for this transformer');
      }
      return successResponse(res, 200, 'Latest inspection retrieved successfully', inspection);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InspectionController();
