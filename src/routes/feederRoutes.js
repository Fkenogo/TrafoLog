const express = require('express');
const router = express.Router();
const FeederController = require('../controllers/feederController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createFeederSchema,
  updateFeederSchema
} = require('../validators/feederValidator');

/**
 * @route GET /api/feeders
 * @desc Get all feeders
 * @access Private
 */
router.get(
  '/',
  authenticate,
  FeederController.getAll
);

/**
 * @route GET /api/feeders/service-area/:serviceAreaId
 * @desc Get feeders by service area
 * @access Private
 */
router.get(
  '/service-area/:serviceAreaId',
  authenticate,
  FeederController.getByServiceArea
);

/**
 * @route GET /api/feeders/:id
 * @desc Get feeder by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  FeederController.getById
);

/**
 * @route POST /api/feeders
 * @desc Create a new feeder
 * @access Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(createFeederSchema),
  FeederController.create
);

/**
 * @route PUT /api/feeders/:id
 * @desc Update feeder
 * @access Private (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(updateFeederSchema),
  FeederController.update
);

/**
 * @route DELETE /api/feeders/:id
 * @desc Delete feeder
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  FeederController.delete
);

module.exports = router;