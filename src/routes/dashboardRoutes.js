const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/dashboard/manager
 * @desc Get manager dashboard data
 * @access Private
 */
router.get(
  '/manager',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Viewer'),
  DashboardController.getManagerDashboard
);

/**
 * @route GET /api/dashboard/field
 * @desc Get field technician dashboard
 * @access Private
 */
router.get(
  '/field',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  DashboardController.getFieldDashboard
);

/**
 * @route GET /api/dashboard/kpi
 * @desc Get KPI strip data
 * @access Private
 */
router.get(
  '/kpi',
  authenticate,
  DashboardController.getKPI
);

/**
 * @route GET /api/dashboard/alerts
 * @desc Get alert panel data
 * @access Private
 */
router.get(
  '/alerts',
  authenticate,
  DashboardController.getAlerts
);

/**
 * @route GET /api/dashboard/charts
 * @desc Get chart data
 * @access Private
 */
router.get(
  '/charts',
  authenticate,
  DashboardController.getCharts
);

/**
 * @route GET /api/dashboard/decision-tables
 * @desc Get decision support tables
 * @access Private
 */
router.get(
  '/decision-tables',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  DashboardController.getDecisionTables
);

/**
 * @route GET /api/dashboard/map-data
 * @desc Get map data
 * @access Private
 */
router.get(
  '/map-data',
  authenticate,
  DashboardController.getMapData
);

module.exports = router;