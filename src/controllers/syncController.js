const SyncService = require('../services/syncService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class SyncController {
  /**
   * Sync offline queue data
   * POST /api/sync/offline-queue
   */
  syncOfflineQueue = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return errorResponse(res, 400, 'Operations array is required');
    }

    const result = await SyncService.processOfflineQueue(userId, operations);

    return successResponse(res, 200, 'Offline queue synced successfully', result);
  });

  /**
   * Get transformers for offline cache
   * GET /api/sync/transformers
   */
  getOfflineTransformers = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const serviceAreaId = req.user.service_area_id;
    const { lastSync } = req.query;

    const transformers = await SyncService.getOfflineTransformers(
      userId,
      userRole,
      territoryId,
      serviceAreaId,
      lastSync
    );

    return successResponse(res, 200, 'Transformers retrieved for offline sync', {
      transformers,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Resolve sync conflicts
   * POST /api/sync/conflicts
   */
  resolveConflict = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { conflicts } = req.body;

    if (!conflicts || !Array.isArray(conflicts)) {
      return errorResponse(res, 400, 'Conflicts array is required');
    }

    const result = await SyncService.resolveConflicts(userId, conflicts);

    return successResponse(res, 200, 'Conflicts resolved successfully', result);
  });

  /**
   * Get sync status
   * GET /api/sync/status
   */
  getSyncStatus = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const status = await SyncService.getSyncStatus(userId);

    return successResponse(res, 200, 'Sync status retrieved successfully', status);
  });

  /**
   * Get pending sync items
   * GET /api/sync/pending
   */
  getPendingItems = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const pending = await SyncService.getPendingItems(userId);

    return successResponse(res, 200, 'Pending sync items retrieved successfully', pending);
  });

  /**
   * Force sync specific record
   * POST /api/sync/force/:collection/:recordId
   */
  forceSync = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { collection, recordId } = req.params;

    const result = await SyncService.forceSync(userId, collection, recordId);

    return successResponse(res, 200, 'Force sync completed successfully', result);
  });

  /**
   * Clear sync queue
   * DELETE /api/sync/queue
   */
  clearQueue = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { status = 'pending' } = req.query;

    const result = await SyncService.clearQueue(userId, status);

    return successResponse(res, 200, 'Sync queue cleared successfully', result);
  });

  /**
   * Get sync statistics
   * GET /api/sync/stats
   */
  getSyncStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const stats = await SyncService.getSyncStats(userId);

    return successResponse(res, 200, 'Sync statistics retrieved successfully', stats);
  });

  /**
   * Check for updates
   * GET /api/sync/check-updates
   */
  checkUpdates = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { lastCheck } = req.query;

    const updates = await SyncService.checkForUpdates(userId, lastCheck);

    return successResponse(res, 200, 'Updates checked successfully', updates);
  });

  /**
   * Get sync logs
   * GET /api/sync/logs
   */
  getSyncLogs = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const logs = await SyncService.getSyncLogs(userId, parseInt(page), parseInt(limit));

    return successResponse(res, 200, 'Sync logs retrieved successfully', logs);
  });

  /**
   * Set sync priority
   * POST /api/sync/priority
   */
  setPriority = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { collection, priority } = req.body;

    const result = await SyncService.setSyncPriority(userId, collection, priority);

    return successResponse(res, 200, 'Sync priority set successfully', result);
  });

  /**
   * Batch sync
   * POST /api/sync/batch
   */
  batchSync = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return errorResponse(res, 400, 'Items array is required');
    }

    const result = await SyncService.processBatchSync(userId, items);

    return successResponse(res, 200, 'Batch sync completed successfully', result);
  });

  /**
   * Get sync conflicts
   * GET /api/sync/conflicts
   */
  getConflicts = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const conflicts = await SyncService.getUserConflicts(userId);

    return successResponse(res, 200, 'Sync conflicts retrieved successfully', conflicts);
  });

  /**
   * Resolve specific conflict
   * POST /api/sync/conflicts/:conflictId
   */
  resolveSpecificConflict = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { conflictId } = req.params;
    const { resolution, resolvedData } = req.body;

    const result = await SyncService.resolveSpecificConflict(
      userId,
      conflictId,
      resolution,
      resolvedData
    );

    return successResponse(res, 200, 'Conflict resolved successfully', result);
  });

  /**
   * Get sync health
   * GET /api/sync/health
   */
  getSyncHealth = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const health = await SyncService.getSyncHealth(userId);

    return successResponse(res, 200, 'Sync health retrieved successfully', health);
  });
}

const _syncInstance = new SyncController();
module.exports = new Proxy(_syncInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `syncController.${String(prop)} not yet implemented` });
  }
});