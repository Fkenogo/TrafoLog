const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/audit
 * @desc Get audit logs
 * @access Private (Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('Super Admin'),
  AuditController.getAuditLogs
);

/**
 * @route GET /api/audit/user/:userId
 * @desc Get audit logs for a user
 * @access Private (Admin)
 */
router.get(
  '/user/:userId',
  authenticate,
  authorize('Super Admin'),
  AuditController.getUserAuditLogs
);

/**
 * @route GET /api/audit/transformers/:transformerId
 * @desc Get audit logs for a transformer
 * @access Private (Admin)
 */
router.get(
  '/transformers/:transformerId',
  authenticate,
  authorize('Super Admin'),
  AuditController.getTransformerAuditLogs
);

/**
 * @route GET /api/audit/actions
 * @desc Get available audit actions
 * @access Private (Admin)
 */
router.get(
  '/actions',
  authenticate,
  authorize('Super Admin'),
  AuditController.getAuditActions
);

module.exports = router;