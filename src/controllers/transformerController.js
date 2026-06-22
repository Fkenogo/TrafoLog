const TransformerService = require('../services/transformerService');
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
      const transformer = await TransformerService.getTransformerById(req.params.id);
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
}

const _transformerInstance = new TransformerController();
module.exports = new Proxy(_transformerInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `transformerController.${String(prop)} not yet implemented` });
  }
});