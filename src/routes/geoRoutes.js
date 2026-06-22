const express = require('express');
const router = express.Router();
const GeoController = require('../controllers/geoController');
const { authenticate } = require('../middleware/auth');

/**
 * @route POST /api/geo/transformers/nearby
 * @desc Find nearby transformers
 * @access Private
 */
router.post(
  '/transformers/nearby',
  authenticate,
  GeoController.findNearbyTransformers
);

/**
 * @route POST /api/geo/route
 * @desc Get route to a transformer
 * @access Private
 */
router.post(
  '/route',
  authenticate,
  GeoController.getRoute
);

/**
 * @route GET /api/geo/cluster
 * @desc Get clustered transformer data for map
 * @access Private
 */
router.get(
  '/cluster',
  authenticate,
  GeoController.getClusterData
);

/**
 * @route POST /api/geo/geocode
 * @desc Geocode address to coordinates
 * @access Private
 */
router.post(
  '/geocode',
  authenticate,
  GeoController.geocode
);

/**
 * @route POST /api/geo/reverse-geocode
 * @desc Reverse geocode coordinates to address
 * @access Private
 */
router.post(
  '/reverse-geocode',
  authenticate,
  GeoController.reverseGeocode
);

module.exports = router;