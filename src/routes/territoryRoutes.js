const express = require('express');
const router = express.Router();
const TerritoryController = require('../controllers/territoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createTerritorySchema,
  updateTerritorySchema
} = require('../validators/territoryValidator');

/**
 * @route GET /api/territories
 * @desc Get all territories
 * @access Private
 */
router.get(
  '/',
  authenticate,
  TerritoryController.getAll
);

/**
 * @route GET /api/territories/:id
 * @desc Get territory by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  TerritoryController.getById
);

/**
 * @route POST /api/territories
 * @desc Create a new territory
 * @access Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin'),
  validate(createTerritorySchema),
  TerritoryController.create
);

/**
 * @route PUT /api/territories/:id
 * @desc Update territory
 * @access Private (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  validate(updateTerritorySchema),
  TerritoryController.update
);

/**
 * @route DELETE /api/territories/:id
 * @desc Delete territory
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  TerritoryController.delete
);

module.exports = router;