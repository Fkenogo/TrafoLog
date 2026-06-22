const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/notifications
 * @desc Get user notifications
 * @access Private
 */
router.get(
  '/',
  authenticate,
  NotificationController.getNotifications
);

/**
 * @route GET /api/notifications/unread/count
 * @desc Get unread notification count
 * @access Private
 */
router.get(
  '/unread/count',
  authenticate,
  NotificationController.getUnreadCount
);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.put(
  '/:id/read',
  authenticate,
  NotificationController.markAsRead
);

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.put(
  '/read-all',
  authenticate,
  NotificationController.markAllAsRead
);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete notification
 * @access Private
 */
router.delete(
  '/:id',
  authenticate,
  NotificationController.deleteNotification
);

/**
 * @route POST /api/notifications/push-token
 * @desc Register push notification token
 * @access Private
 */
router.post(
  '/push-token',
  authenticate,
  NotificationController.registerPushToken
);

/**
 * @route DELETE /api/notifications/push-token
 * @desc Unregister push notification token
 * @access Private
 */
router.delete(
  '/push-token',
  authenticate,
  NotificationController.unregisterPushToken
);

module.exports = router;