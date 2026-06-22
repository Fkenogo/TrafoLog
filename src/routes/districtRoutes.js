const express = require('express');
const router = express.Router();
const DistrictController = require('../controllers/districtController');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/districts
 * @desc Get all districts
 * @access Private
 */
router.get(
  '/',
  authenticate,
  DistrictController.getAll
);

/**
 * @route GET /api/districts/:id
 * @desc Get district by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  DistrictController.getById
);

/**
 * @route GET /api/districts/region/:region
 * @desc Get districts by region
 * @access Private
 */
router.get(
  '/region/:region',
  authenticate,
  DistrictController.getByRegion
);

module.exports = router;