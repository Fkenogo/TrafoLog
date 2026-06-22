const express = require('express');
const router = express.Router();
const MaintenanceController = require('../controllers/maintenanceController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadPhotos } = require('../middleware/fileUpload');
const {
  createMaintenanceSchema,
  maintenanceQuerySchema
} = require('../validators/maintenanceValidator');

/**
 * @route GET /api/maintenance
 * @desc Get all maintenance records
 * @access Private
 */
router.get(
  '/',
  authenticate,
  validate(maintenanceQuerySchema, 'query'),
  MaintenanceController.getAll
);

/**
 * @route GET /api/maintenance/stats
 * @desc Get maintenance statistics
 * @access Private
 */
router.get(
  '/stats',
  authenticate,
  MaintenanceController.getStats
);

/**
 * @route GET /api/maintenance/transformer/:transformerId
 * @desc Get maintenance records for a transformer
 * @access Private
 */
router.get(
  '/transformer/:transformerId',
  authenticate,
  MaintenanceController.getByTransformer
);

/**
 * @route GET /api/maintenance/upcoming
 * @desc Get upcoming maintenance
 * @access Private
 */
router.get(
  '/upcoming',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  MaintenanceController.getUpcoming
);

/**
 * @route GET /api/maintenance/:id
 * @desc Get maintenance record by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  MaintenanceController.getById
);

/**
 * @route POST /api/maintenance
 * @desc Create a new maintenance record
 * @access Private
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  uploadPhotos.fields([
    { name: 'photosBefore', maxCount: 10 },
    { name: 'photosAfter', maxCount: 10 }
  ]),
  validate(createMaintenanceSchema),
  MaintenanceController.create
);

/**
 * @route PUT /api/maintenance/:id
 * @desc Update maintenance record
 * @access Private
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  uploadPhotos.fields([
    { name: 'photosBefore', maxCount: 10 },
    { name: 'photosAfter', maxCount: 10 }
  ]),
  validate(createMaintenanceSchema),
  MaintenanceController.update
);

/**
 * @route DELETE /api/maintenance/:id
 * @desc Delete maintenance record
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  MaintenanceController.delete
);

module.exports = router;