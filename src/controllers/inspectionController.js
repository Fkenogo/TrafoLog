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
      const inspection = await InspectionService.getInspectionById(req.params.id);
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

  async getAll(req, res) {
    return res.status(501).json({ success: false, message: 'InspectionController.getAll not yet implemented' });
  }

  async update(req, res) {
    return res.status(501).json({ success: false, message: 'InspectionController.update not yet implemented' });
  }

  async delete(req, res) {
    return res.status(501).json({ success: false, message: 'InspectionController.delete not yet implemented' });
  }

  async getOverdue(req, res) {
    return res.status(501).json({ success: false, message: 'InspectionController.getOverdue not yet implemented' });
  }

  async getLatest(req, res) {
    return res.status(501).json({ success: false, message: 'InspectionController.getLatest not yet implemented' });
  }
}

module.exports = new InspectionController();