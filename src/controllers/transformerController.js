const TransformerService = require('../services/transformerService');
const TimelineService = require('../services/timelineService');
const QRService = require('../services/qrService');
const { successResponse, errorResponse } = require('../utils/helpers');

class TransformerController {
  /**
   * Create transformer
   * POST /api/transformers
   */
  async create(req, res, next) {
    try {
      const transformer = await TransformerService.createTransformer(
        req.body,
        req.user.id
      );
      
      return successResponse(res, 201, 'Transformer created successfully', transformer);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get all transformers with pagination and filters
   * GET /api/transformers
   */
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      
      const result = await TransformerService.searchTransformers(
        filters,
        parseInt(page),
        parseInt(limit)
      );
      
      return successResponse(res, 200, 'Transformers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get transformer by ID
   * GET /api/transformers/:id
   */
  async getById(req, res, next) {
    try {
      const transformer = await TransformerService.getTransformerWithDetails(req.params.id);
      return successResponse(res, 200, 'Transformer retrieved successfully', transformer);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update transformer
   * PUT /api/transformers/:id
   */
  async update(req, res, next) {
    try {
      const transformer = await TransformerService.updateTransformer(
        req.params.id,
        req.body,
        req.user.id
      );
      
      return successResponse(res, 200, 'Transformer updated successfully', transformer);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Delete transformer (soft delete)
   * DELETE /api/transformers/:id
   */
  async delete(req, res, next) {
    try {
      // Only Super Admin can delete
      if (req.user.role !== 'Super Admin') {
        return errorResponse(res, 403, 'Unauthorized to delete transformers');
      }
      
      await TransformerService.softDelete(req.params.id, req.user.id);
      return successResponse(res, 200, 'Transformer deleted successfully');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get transformer statistics
   * GET /api/transformers/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await TransformerService.getStatistics(req.query);
      return successResponse(res, 200, 'Statistics retrieved successfully', stats);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get transformers by territory
   * GET /api/transformers/territory/:territoryId
   */
  async getByTerritory(req, res, next) {
    try {
      const transformers = await TransformerService.getTransformersByTerritory(
        req.params.territoryId
      );
      return successResponse(res, 200, 'Transformers retrieved successfully', transformers);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Verify transformer
   * POST /api/transformers/:id/verify
   */
  async verify(req, res, next) {
    try {
      const transformer = await TransformerService.verifyTransformer(
        req.params.id,
        req.user.id
      );
      return successResponse(res, 200, 'Transformer verified successfully', transformer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search transformers by various criteria
   * GET /api/transformers/search
   */
  async search(req, res, next) {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await TransformerService.searchTransformers(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });
      return successResponse(res, 200, 'Transformers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transformers by service area
   * GET /api/transformers/service-area/:serviceAreaId
   */
  async getByServiceArea(req, res, next) {
    try {
      const result = await TransformerService.getTransformersByServiceArea(
        req.params.serviceAreaId
      );
      return successResponse(res, 200, 'Transformers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get nearby transformers
   * GET /api/transformers/nearby?lat=&lng=&radius=&limit=
   */
  async getNearby(req, res, next) {
    try {
      const { lat, lng, radius = 5, limit = 20 } = req.query;
      if (!lat || !lng) {
        return errorResponse(res, 400, 'lat and lng query parameters are required');
      }
      const transformers = await TransformerService.getNearbyTransformers(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius),
        parseInt(limit)
      );
      return successResponse(res, 200, 'Nearby transformers retrieved successfully', transformers);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transformer timeline
   * GET /api/transformers/:id/timeline
   */
  async getTimeline(req, res, next) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const timeline = await TimelineService.getTransformerTimeline(
        req.params.id,
        parseInt(limit),
        parseInt(page)
      );
      return successResponse(res, 200, 'Timeline retrieved successfully', timeline);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get or generate transformer QR code
   * GET /api/transformers/:id/qr
   */
  async getQRCode(req, res, next) {
    try {
      const qrCode = await QRService.generateQR(req.params.id, req.user.id);
      return successResponse(res, 200, 'QR code retrieved successfully', qrCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Decommission transformer
   * POST /api/transformers/:id/decommission
   */
  async decommission(req, res, next) {
    try {
      const transformer = await TransformerService.decommissionTransformer(
        req.params.id,
        req.body.reason,
        req.user.id
      );
      return successResponse(res, 200, 'Transformer decommissioned successfully', transformer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk create transformers
   * POST /api/transformers/bulk
   */
  async bulkCreate(req, res, next) {
    try {
      const transformersData = Array.isArray(req.body) ? req.body : req.body.transformers;
      if (!transformersData || !Array.isArray(transformersData) || transformersData.length === 0) {
        return errorResponse(res, 400, 'Request body must be a non-empty array of transformers');
      }
      const result = await TransformerService.bulkCreate(transformersData, req.user.id);
      return successResponse(res, 207, 'Bulk create completed', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransformerController();
