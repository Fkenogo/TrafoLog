const express = require('express');
const router = express.Router();
const InspectionController = require('../controllers/inspectionController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadPhotos } = require('../middleware/fileUpload');
const {
  createInspectionSchema,
  inspectionQuerySchema
} = require('../validators/inspectionValidator');

/**
 * @route GET /api/inspections
 * @desc Get all inspections with filters
 * @access Private
 */
router.get(
  '/',
  authenticate,
  validate(inspectionQuerySchema, 'query'),
  InspectionController.getAll
);

/**
 * @route GET /api/inspections/stats
 * @desc Get inspection statistics
 * @access Private
 */
router.get(
  '/stats',
  authenticate,
  InspectionController.getStats
);

/**
 * @route GET /api/inspections/transformer/:transformerId
 * @desc Get inspections for a transformer
 * @access Private
 */
router.get(
  '/transformer/:transformerId',
  authenticate,
  InspectionController.getByTransformer
);

/**
 * @route GET /api/inspections/latest/:transformerId
 * @desc Get latest inspection for a transformer
 * @access Private
 */
router.get(
  '/latest/:transformerId',
  authenticate,
  InspectionController.getLatest
);

/**
 * @route GET /api/inspections/overdue
 * @desc Get overdue inspections
 * @access Private
 */
router.get(
  '/overdue',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  InspectionController.getOverdue
);

/**
 * @route GET /api/inspections/:id
 * @desc Get inspection by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  InspectionController.getById
);

/**
 * @route POST /api/inspections
 * @desc Create a new inspection
 * @access Private
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  uploadPhotos.array('photos', 10),
  validate(createInspectionSchema),
  InspectionController.create
);

/**
 * @route PUT /api/inspections/:id
 * @desc Update inspection
 * @access Private
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  uploadPhotos.array('photos', 10),
  validate(createInspectionSchema),
  InspectionController.update
);

/**
 * @route DELETE /api/inspections/:id
 * @desc Delete inspection
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  InspectionController.delete
);

module.exports = router;