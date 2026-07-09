const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { analyticsQuerySchema } = require('../validators/analyticsValidator');

/**
 * @route GET /api/analytics/transformers
 * @desc Get transformer analytics
 * @access Private
 */
router.get(
  '/transformers',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(analyticsQuerySchema, 'query'),
  AnalyticsController.getTransformerAnalytics
);

/**
 * @route GET /api/analytics/faults
 * @desc Get fault analytics
 * @access Private
 */
router.get(
  '/faults',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(analyticsQuerySchema, 'query'),
  AnalyticsController.getFaultAnalytics
);

/**
 * @route GET /api/analytics/maintenance
 * @desc Get maintenance analytics
 * @access Private
 */
router.get(
  '/maintenance',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(analyticsQuerySchema, 'query'),
  AnalyticsController.getMaintenanceAnalytics
);

/**
 * @route GET /api/analytics/predictive
 * @desc Get predictive analytics
 * @access Private
 */
router.get(
  '/predictive',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(analyticsQuerySchema, 'query'),
  AnalyticsController.getPredictiveAnalytics
);

module.exports = router;
