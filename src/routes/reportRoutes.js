const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  reportQuerySchema,
  exportOptionsSchema
} = require('../validators/reportValidator');

/**
 * @route GET /api/reports/transformers
 * @desc Generate transformer report
 * @access Private
 */
router.get(
  '/transformers',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(reportQuerySchema, 'query'),
  ReportController.generateTransformerReport
);

/**
 * @route GET /api/reports/inspections
 * @desc Generate inspection report
 * @access Private
 */
router.get(
  '/inspections',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(reportQuerySchema, 'query'),
  ReportController.generateInspectionReport
);

/**
 * @route GET /api/reports/faults
 * @desc Generate fault report
 * @access Private
 */
router.get(
  '/faults',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(reportQuerySchema, 'query'),
  ReportController.generateFaultReport
);

/**
 * @route GET /api/reports/maintenance
 * @desc Generate maintenance report
 * @access Private
 */
router.get(
  '/maintenance',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(reportQuerySchema, 'query'),
  ReportController.generateMaintenanceReport
);

/**
 * @route GET /api/reports/asset-register
 * @desc Generate complete asset register
 * @access Private
 */
router.get(
  '/asset-register',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(exportOptionsSchema, 'query'),
  ReportController.generateAssetRegister
);

/**
 * @route POST /api/reports/export/excel
 * @desc Export report to Excel
 * @access Private
 */
router.post(
  '/export/excel',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(exportOptionsSchema),
  ReportController.exportToExcel
);

/**
 * @route POST /api/reports/export/pdf
 * @desc Export report to PDF
 * @access Private
 */
router.post(
  '/export/pdf',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(exportOptionsSchema),
  ReportController.exportToPDF
);

/**
 * @route GET /api/reports/exports/:exportId
 * @desc Get export status and download
 * @access Private
 */
router.get(
  '/exports/:exportId',
  authenticate,
  ReportController.getExportStatus
);

module.exports = router;