const express = require('express');
const router = express.Router();
const TransformerController = require('../controllers/transformerController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createTransformerSchema,
  updateTransformerSchema,
  searchTransformerSchema,
  decommissionTransformerSchema
} = require('../validators/transformerValidator');

/**
 * @route GET /api/transformers
 * @desc Get all transformers with pagination and filters
 * @access Private
 */
router.get(
  '/',
  authenticate,
  validate(searchTransformerSchema, 'query'),
  TransformerController.getAll
);

/**
 * @route GET /api/transformers/stats
 * @desc Get transformer statistics
 * @access Private
 */
router.get(
  '/stats',
  authenticate,
  TransformerController.getStats
);

/**
 * @route GET /api/transformers/territory/:territoryId
 * @desc Get transformers by territory
 * @access Private
 */
router.get(
  '/territory/:territoryId',
  authenticate,
  TransformerController.getByTerritory
);

/**
 * @route GET /api/transformers/service-area/:serviceAreaId
 * @desc Get transformers by service area
 * @access Private
 */
router.get(
  '/service-area/:serviceAreaId',
  authenticate,
  TransformerController.getByServiceArea
);

/**
 * @route GET /api/transformers/nearby
 * @desc Get transformers near a location
 * @access Private
 */
router.get(
  '/nearby',
  authenticate,
  TransformerController.getNearby
);

/**
 * @route GET /api/transformers/search
 * @desc Search transformers by various criteria
 * @access Private
 */
router.get(
  '/search',
  authenticate,
  TransformerController.search
);

/**
 * @route GET /api/transformers/:id
 * @desc Get transformer by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  TransformerController.getById
);

/**
 * @route GET /api/transformers/:id/timeline
 * @desc Get transformer timeline
 * @access Private
 */
router.get(
  '/:id/timeline',
  authenticate,
  TransformerController.getTimeline
);

/**
 * @route GET /api/transformers/:id/qr
 * @desc Get transformer QR code
 * @access Private
 */
router.get(
  '/:id/qr',
  authenticate,
  TransformerController.getQRCode
);

/**
 * @route POST /api/transformers
 * @desc Create a new transformer
 * @access Private
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  validate(createTransformerSchema),
  TransformerController.create
);

/**
 * @route PUT /api/transformers/:id
 * @desc Update transformer
 * @access Private
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(updateTransformerSchema),
  TransformerController.update
);

/**
 * @route DELETE /api/transformers/:id
 * @desc Delete transformer (soft delete)
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  TransformerController.delete
);

/**
 * @route POST /api/transformers/:id/verify
 * @desc Verify transformer
 * @access Private
 */
router.post(
  '/:id/verify',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  TransformerController.verify
);

/**
 * @route POST /api/transformers/:id/decommission
 * @desc Decommission transformer
 * @access Private
 */
router.post(
  '/:id/decommission',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  validate(decommissionTransformerSchema),
  TransformerController.decommission
);

/**
 * @route POST /api/transformers/bulk
 * @desc Bulk create transformers
 * @access Private (Admin)
 */
router.post(
  '/bulk',
  authenticate,
  authorize('Super Admin'),
  TransformerController.bulkCreate
);

module.exports = router;