const express = require('express');
const router = express.Router();
const TimelineController = require('../controllers/timelineController');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/timeline/transformer/:transformerId
 * @desc Get transformer timeline
 * @access Private
 */
router.get(
  '/transformer/:transformerId',
  authenticate,
  TimelineController.getTransformerTimeline
);

/**
 * @route GET /api/timeline/recent
 * @desc Get recent activities
 * @access Private
 */
router.get(
  '/recent',
  authenticate,
  TimelineController.getRecentActivities
);

/**
 * @route GET /api/timeline/export/:transformerId
 * @desc Export transformer timeline
 * @access Private
 */
router.get(
  '/export/:transformerId',
  authenticate,
  TimelineController.exportTimeline
);

module.exports = router;