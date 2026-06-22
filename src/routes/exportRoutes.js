const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/exportController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { exportOptionsSchema } = require('../validators/exportValidator');

/**
 * @route POST /api/exports/excel
 * @desc Export data to Excel
 * @access Private
 */
router.post(
  '/excel',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(exportOptionsSchema),
  ExportController.exportToExcel
);

/**
 * @route POST /api/exports/pdf
 * @desc Export data to PDF
 * @access Private
 */
router.post(
  '/pdf',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(exportOptionsSchema),
  ExportController.exportToPDF
);

/**
 * @route POST /api/exports/csv
 * @desc Export data to CSV
 * @access Private
 */
router.post(
  '/csv',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Viewer'),
  validate(exportOptionsSchema),
  ExportController.exportToCSV
);

/**
 * @route GET /api/exports/:exportId
 * @desc Download exported file
 * @access Private
 */
router.get(
  '/:exportId',
  authenticate,
  ExportController.downloadExport
);

module.exports = router;