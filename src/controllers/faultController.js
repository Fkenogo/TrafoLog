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
      const stats = await FaultService.getFaultStatistics(req.query);
      return successResponse(res, 200, 'Statistics retrieved successfully', stats);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const {
        page = 1, limit = 20,
        transformer_id, status, severity, fault_type, assigned_to,
        startDate, endDate
      } = req.query;

      const filters = {};
      if (transformer_id) filters.transformer_id = transformer_id;
      if (status) filters.fault_status = status; // query param 'status' maps to model field 'fault_status'
      if (severity) filters.severity = severity;
      if (fault_type) filters.fault_type = fault_type;
      if (assigned_to) filters.assigned_to = assigned_to;
      if (startDate || endDate) {
        filters.fault_date = {};
        if (startDate) filters.fault_date.$gte = new Date(startDate);
        if (endDate) filters.fault_date.$lte = new Date(endDate);
      }

      const result = await FaultService.getAll(filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { fault_date: -1 },
        populate: ['transformer_id', 'inspection_id', 'assigned_to', 'reported_by']
      });

      return successResponse(res, 200, 'Faults retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const fault = await FaultService.getById(
        req.params.id,
        ['transformer_id', 'inspection_id', 'reported_by', 'assigned_to', 'resolved_by']
      );
      return successResponse(res, 200, 'Fault retrieved successfully', fault);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const fault = await FaultService.update(req.params.id, req.body, req.user.id);
      return successResponse(res, 200, 'Fault updated successfully', fault);
    } catch (error) {
      next(error);
    }
  }

  async getAssignedToMe(req, res, next) {
    try {
      const faults = await FaultService.getFaultsAssignedToUser(req.user.id);
      return successResponse(res, 200, 'Assigned faults retrieved successfully', faults);
    } catch (error) {
      next(error);
    }
  }

  async close(req, res, next) {
    try {
      const fault = await FaultService.closeFault(req.params.id, req.user.id);
      return successResponse(res, 200, 'Fault closed successfully', fault);
    } catch (error) {
      next(error);
    }
  }

  async escalate(req, res, next) {
    try {
      const fault = await FaultService.escalateFault(
        req.params.id,
        req.body.reason,
        req.user.id
      );
      return successResponse(res, 200, 'Fault escalated successfully', fault);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await FaultService.hardDelete(req.params.id);
      return successResponse(res, 200, 'Fault deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FaultController();
