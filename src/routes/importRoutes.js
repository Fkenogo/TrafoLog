const express = require('express');
const router = express.Router();
const ImportController = require('../controllers/importController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadFile } = require('../middleware/fileUpload');

/**
 * @route POST /api/import/transformers
 * @desc Import transformers from file
 * @access Private (Admin)
 */
router.post(
  '/transformers',
  authenticate,
  authorize('Super Admin'),
  uploadFile.single('file'),
  ImportController.importTransformers
);

/**
 * @route GET /api/import/template
 * @desc Download import template
 * @access Private (Admin)
 */
router.get(
  '/template',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  ImportController.downloadTemplate
);

/**
 * @route POST /api/import/validate
 * @desc Validate import file before processing
 * @access Private (Admin)
 */
router.post(
  '/validate',
  authenticate,
  authorize('Super Admin'),
  uploadFile.single('file'),
  ImportController.validateImport
);

/**
 * @route GET /api/import/history
 * @desc Get import history
 * @access Private (Admin)
 */
router.get(
  '/history',
  authenticate,
  authorize('Super Admin'),
  ImportController.getImportHistory
);

/**
 * @route GET /api/import/history/:importId
 * @desc Get import details
 * @access Private (Admin)
 */
router.get(
  '/history/:importId',
  authenticate,
  authorize('Super Admin'),
  ImportController.getImportDetails
);

/**
 * @route GET /api/import/errors/:importId
 * @desc Get import errors
 * @access Private (Admin)
 */
router.get(
  '/errors/:importId',
  authenticate,
  authorize('Super Admin'),
  ImportController.getImportErrors
);

module.exports = router;