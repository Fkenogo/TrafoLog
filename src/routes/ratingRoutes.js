const express = require('express');
const router = express.Router();
const RatingController = require('../controllers/ratingController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route GET /api/ratings
 * @desc Get all transformer ratings
 * @access Private
 */
router.get(
  '/',
  authenticate,
  RatingController.getAll
);

/**
 * @route GET /api/ratings/network/:networkVoltage
 * @desc Get ratings by network voltage
 * @access Private
 */
router.get(
  '/network/:networkVoltage',
  authenticate,
  RatingController.getByNetworkVoltage
);

/**
 * @route POST /api/ratings
 * @desc Create a new rating
 * @access Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin'),
  RatingController.create
);

/**
 * @route PUT /api/ratings/:id
 * @desc Update rating
 * @access Private (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  RatingController.update
);

/**
 * @route DELETE /api/ratings/:id
 * @desc Delete rating
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  RatingController.delete
);

module.exports = router;