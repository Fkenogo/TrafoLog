const InstallationService = require('../services/installationService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class InstallationController {
  /**
   * Get all installations
   * GET /api/installations
   */
  getAll = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, transformer_id, installation_type } = req.query;

    const filters = {};
    if (transformer_id) filters.transformer_id = transformer_id;
    if (installation_type) filters.installation_type = installation_type;

    const result = await InstallationService.getAll(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { installation_date: -1 },
      populate: ['transformer_id', 'previous_transformer_id']
    });

    return successResponse(res, 200, 'Installations retrieved successfully', result);
  });

  /**
   * Get installations for a transformer
   * GET /api/installations/transformer/:transformerId
   */
  getByTransformer = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;

    const installations = await InstallationService.getInstallationsByTransformer(transformerId);

    return successResponse(res, 200, 'Installations retrieved successfully', installations);
  });

  /**
   * Get installation by ID
   * GET /api/installations/:id
   */
  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const installation = await InstallationService.getInstallationById(id);

    return successResponse(res, 200, 'Installation retrieved successfully', installation);
  });

  /**
   * Create a new installation record
   * POST /api/installations
   */
  create = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const files = req.files || {};

    const installation = await InstallationService.createInstallation(
      req.body,
      userId,
      files
    );

    return successResponse(res, 201, 'Installation created successfully', installation);
  });

  /**
   * Update installation record
   * PUT /api/installations/:id
   */
  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const files = req.files || {};

    const installation = await InstallationService.updateInstallation(
      id,
      req.body,
      userId,
      files
    );

    return successResponse(res, 200, 'Installation updated successfully', installation);
  });

  /**
   * Delete installation record
   * DELETE /api/installations/:id
   */
  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await InstallationService.deleteInstallation(id, userId);

    return successResponse(res, 200, 'Installation deleted successfully', result);
  });

  /**
   * Get installation statistics
   * GET /api/installations/stats
   */
  getStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const filters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const stats = await InstallationService.getStatistics(filters);

    return successResponse(res, 200, 'Installation statistics retrieved successfully', stats);
  });

  /**
   * Get installation history for a transformer
   * GET /api/installations/history/:transformerId
   */
  getHistory = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;

    const history = await InstallationService.getInstallationHistory(transformerId);

    return successResponse(res, 200, 'Installation history retrieved successfully', history);
  });

  /**
   * Get latest installation for a transformer
   * GET /api/installations/latest/:transformerId
   */
  getLatest = asyncHandler(async (req, res) => {
    const { transformerId } = req.params;

    const installation = await InstallationService.getLatestInstallation(transformerId);

    return successResponse(res, 200, 'Latest installation retrieved successfully', installation);
  });

  /**
   * Verify installation
   * POST /api/installations/:id/verify
   */
  verify = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const installation = await InstallationService.verifyInstallation(id, userId);

    return successResponse(res, 200, 'Installation verified successfully', installation);
  });
}

const _installationInstance = new InstallationController();
module.exports = new Proxy(_installationInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `installationController.${String(prop)} not yet implemented` });
  }
});