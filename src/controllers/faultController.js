const FaultService = require('../services/faultService');
const { successResponse, errorResponse } = require('../utils/helpers');

class FaultController {
  /**
   * Report fault
   * POST /api/faults
   */
  async create(req, res, next) {
    try {
      const fault = await FaultService.reportFault(req.body, req.user.id);
      return successResponse(res, 201, 'Fault reported successfully', fault);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get faults for a transformer
   * GET /api/faults/transformer/:transformerId
   */
  async getByTransformer(req, res, next) {
    try {
      const faults = await FaultService.getFaultsByTransformer(req.params.transformerId);
      return successResponse(res, 200, 'Faults retrieved successfully', faults);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get open faults
   * GET /api/faults/open
   */
  async getOpen(req, res, next) {
    try {
      const faults = await FaultService.getOpenFaults(req.query);
      return successResponse(res, 200, 'Open faults retrieved successfully', faults);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Assign fault
   * PUT /api/faults/:id/assign
   */
  async assign(req, res, next) {
    try {
      const fault = await FaultService.assignFault(
        req.params.id,
        req.body.assigned_to,
        req.user.id
      );
      return successResponse(res, 200, 'Fault assigned successfully', fault);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Resolve fault
   * PUT /api/faults/:id/resolve
   */
  async resolve(req, res, next) {
    try {
      const fault = await FaultService.resolveFault(
        req.params.id,
        req.body,
        req.user.id
      );
      return successResponse(res, 200, 'Fault resolved successfully', fault);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get fault statistics
   * GET /api/faults/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await FaultService.getFaultStats(req.query);
      return successResponse(res, 200, 'Statistics retrieved successfully', stats);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FaultController();