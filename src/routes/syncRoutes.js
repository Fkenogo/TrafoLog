const express = require('express');
const router = express.Router();
const SyncController = require('../controllers/syncController');
const { authenticate } = require('../middleware/auth');

/**
 * @route POST /api/sync/offline-queue
 * @desc Sync offline queue data
 * @access Private
 */
router.post(
  '/offline-queue',
  authenticate,
  SyncController.syncOfflineQueue
);

/**
 * @route GET /api/sync/transformers
 * @desc Get transformers for offline cache
 * @access Private
 */
router.get(
  '/transformers',
  authenticate,
  SyncController.getOfflineTransformers
);

/**
 * @route POST /api/sync/conflicts
 * @desc Resolve sync conflicts
 * @access Private
 */
router.post(
  '/conflicts',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  SyncController.resolveConflict
);

/**
 * @route GET /api/sync/status
 * @desc Get sync status
 * @access Private
 */
router.get(
  '/status',
  authenticate,
  SyncController.getSyncStatus
);

module.exports = router;