const express = require('express');
const router = express.Router();
const ServiceAreaController = require('../controllers/serviceAreaController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createServiceAreaSchema,
  updateServiceAreaSchema
} = require('../validators/serviceAreaValidator');

/**
 * @route GET /api/service-areas
 * @desc Get all service areas
 * @access Private
 */
router.get(
  '/',
  authenticate,
  ServiceAreaController.getAll
);

/**
 * @route GET /api/service-areas/territory/:territoryId
 * @desc Get service areas by territory
 * @access Private
 */
router.get(
  '/territory/:territoryId',
  authenticate,
  ServiceAreaController.getByTerritory
);

/**
 * @route GET /api/service-areas/:id
 * @desc Get service area by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  ServiceAreaController.getById
);

/**
 * @route POST /api/service-areas
 * @desc Create a new service area
 * @access Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin'),
  validate(createServiceAreaSchema),
  ServiceAreaController.create
);

/**
 * @route PUT /api/service-areas/:id
 * @desc Update service area
 * @access Private (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  validate(updateServiceAreaSchema),
  ServiceAreaController.update
);

/**
 * @route DELETE /api/service-areas/:id
 * @desc Delete service area
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  ServiceAreaController.delete
);

module.exports = router;