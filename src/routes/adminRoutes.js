const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/admin/audit-logs
 * @desc Get audit logs
 * @access Private (Admin)
 */
router.get(
  '/audit-logs',
  authenticate,
  authorize('Super Admin'),
  AdminController.getAuditLogs
);

/**
 * @route GET /api/admin/system-stats
 * @desc Get system statistics
 * @access Private (Admin)
 */
router.get(
  '/system-stats',
  authenticate,
  authorize('Super Admin'),
  AdminController.getSystemStats
);

/**
 * @route POST /api/admin/backup
 * @desc Trigger database backup
 * @access Private (Admin)
 */
router.post(
  '/backup',
  authenticate,
  authorize('Super Admin'),
  AdminController.triggerBackup
);

/**
 * @route GET /api/admin/backups
 * @desc Get backup history
 * @access Private (Admin)
 */
router.get(
  '/backups',
  authenticate,
  authorize('Super Admin'),
  AdminController.getBackupHistory
);

/**
 * @route POST /api/admin/restore/:backupId
 * @desc Restore from backup
 * @access Private (Admin)
 */
router.post(
  '/restore/:backupId',
  authenticate,
  authorize('Super Admin'),
  AdminController.restoreFromBackup
);

/**
 * @route POST /api/admin/maintenance
 * @desc Put system in maintenance mode
 * @access Private (Admin)
 */
router.post(
  '/maintenance',
  authenticate,
  authorize('Super Admin'),
  AdminController.toggleMaintenanceMode
);

/**
 * @route GET /api/admin/users
 * @desc Get all users with filters (admin version)
 * @access Private (Admin)
 */
router.get(
  '/users',
  authenticate,
  authorize('Super Admin'),
  AdminController.getAllUsers
);

module.exports = router;