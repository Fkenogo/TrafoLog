const express = require('express');
const router = express.Router();
const FaultController = require('../controllers/faultController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadPhotos } = require('../middleware/fileUpload');
const {
  createFaultSchema,
  resolveFaultSchema,
  assignFaultSchema,
  faultQuerySchema
} = require('../validators/faultValidator');

/**
 * @route GET /api/faults
 * @desc Get all faults with filters
 * @access Private
 */
router.get(
  '/',
  authenticate,
  validate(faultQuerySchema, 'query'),
  FaultController.getAll
);

/**
 * @route GET /api/faults/stats
 * @desc Get fault statistics
 * @access Private
 */
router.get(
  '/stats',
  authenticate,
  FaultController.getStats
);

/**
 * @route GET /api/faults/open
 * @desc Get open faults
 * @access Private
 */
router.get(
  '/open',
  authenticate,
  FaultController.getOpen
);

/**
 * @route GET /api/faults/assigned-to-me
 * @desc Get faults assigned to current user
 * @access Private
 */
router.get(
  '/assigned-to-me',
  authenticate,
  FaultController.getAssignedToMe
);

/**
 * @route GET /api/faults/transformer/:transformerId
 * @desc Get faults for a transformer
 * @access Private
 */
router.get(
  '/transformer/:transformerId',
  authenticate,
  FaultController.getByTransformer
);

/**
 * @route GET /api/faults/:id
 * @desc Get fault by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  FaultController.getById
);

/**
 * @route POST /api/faults
 * @desc Report a new fault
 * @access Private
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  uploadPhotos.array('photos', 10),
  validate(createFaultSchema),
  FaultController.create
);

/**
 * @route PUT /api/faults/:id/assign
 * @desc Assign fault to team
 * @access Private
 */
router.put(
  '/:id/assign',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  validate(assignFaultSchema),
  FaultController.assign
);

/**
 * @route PUT /api/faults/:id/resolve
 * @desc Resolve fault
 * @access Private
 */
router.put(
  '/:id/resolve',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  uploadPhotos.array('photosAfterRepair', 10),
  validate(resolveFaultSchema),
  FaultController.resolve
);

/**
 * @route PUT /api/faults/:id/close
 * @desc Close fault after review
 * @access Private
 */
router.put(
  '/:id/close',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  FaultController.close
);

/**
 * @route PUT /api/faults/:id/escalate
 * @desc Escalate fault
 * @access Private
 */
router.put(
  '/:id/escalate',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  FaultController.escalate
);

/**
 * @route DELETE /api/faults/:id
 * @desc Delete fault
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  FaultController.delete
);

module.exports = router;