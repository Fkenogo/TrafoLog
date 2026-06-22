const NotificationService = require('../services/notificationService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class NotificationController {
  /**
   * Get user notifications
   * GET /api/notifications
   */
  getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 20, is_read, type, priority } = req.query;

    const filters = {};
    if (is_read !== undefined) filters.is_read = is_read === 'true';
    if (type) filters.type = type;
    if (priority) filters.priority = priority;

    const notifications = await NotificationService.getUserNotifications(
      userId,
      parseInt(page),
      parseInt(limit),
      filters
    );

    return successResponse(res, 200, 'Notifications retrieved successfully', notifications);
  });

  /**
   * Get unread notification count
   * GET /api/notifications/unread/count
   */
  getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const count = await NotificationService.getUnreadCount(userId);

    return successResponse(res, 200, 'Unread count retrieved successfully', { count });
  });

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await NotificationService.markAsRead(id, userId);

    return successResponse(res, 200, 'Notification marked as read successfully', notification);
  });

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await NotificationService.markAllAsRead(userId);

    return successResponse(res, 200, 'All notifications marked as read successfully', result);
  });

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await NotificationService.deleteNotification(id, userId);

    return successResponse(res, 200, 'Notification deleted successfully', result);
  });

  /**
   * Register push notification token
   * POST /api/notifications/push-token
   */
  registerPushToken = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { token, platform, device_name } = req.body;

    const result = await NotificationService.registerPushToken(
      userId,
      token,
      platform,
      device_name
    );

    return successResponse(res, 200, 'Push token registered successfully', result);
  });

  /**
   * Unregister push notification token
   * DELETE /api/notifications/push-token
   */
  unregisterPushToken = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { token } = req.body;

    const result = await NotificationService.unregisterPushToken(userId, token);

    return successResponse(res, 200, 'Push token unregistered successfully', result);
  });

  /**
   * Get notification preferences
   * GET /api/notifications/preferences
   */
  getPreferences = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const preferences = await NotificationService.getPreferences(userId);

    return successResponse(res, 200, 'Preferences retrieved successfully', preferences);
  });

  /**
   * Update notification preferences
   * PUT /api/notifications/preferences
   */
  updatePreferences = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { email, push, sms } = req.body;

    const preferences = await NotificationService.updatePreferences(
      userId,
      { email, push, sms }
    );

    return successResponse(res, 200, 'Preferences updated successfully', preferences);
  });

  /**
   * Send test notification
   * POST /api/notifications/test
   */
  sendTest = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { method = 'app' } = req.body;

    const result = await NotificationService.sendTestNotification(userId, method);

    return successResponse(res, 200, 'Test notification sent successfully', result);
  });

  /**
   * Get notification statistics
   * GET /api/notifications/stats
   */
  getStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const stats = await NotificationService.getNotificationStats(userId);

    return successResponse(res, 200, 'Notification statistics retrieved successfully', stats);
  });

  /**
   * Get notification delivery status
   * GET /api/notifications/:id/delivery
   */
  getDeliveryStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const status = await NotificationService.getDeliveryStatus(id, userId);

    return successResponse(res, 200, 'Delivery status retrieved successfully', status);
  });

  /**
   * Resend notification
   * POST /api/notifications/:id/resend
   */
  resendNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { method } = req.body;

    const result = await NotificationService.resendNotification(id, userId, method);

    return successResponse(res, 200, 'Notification resent successfully', result);
  });

  /**
   * Clear all notifications
   * DELETE /api/notifications/clear-all
   */
  clearAll = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await NotificationService.clearAllNotifications(userId);

    return successResponse(res, 200, 'All notifications cleared successfully', result);
  });

  /**
   * Get notification types
   * GET /api/notifications/types
   */
  getTypes = asyncHandler(async (req, res) => {
    const types = [
      { value: 'FAULT_ALERT', label: 'Fault Alert' },
      { value: 'FAULT_ASSIGNED', label: 'Fault Assigned' },
      { value: 'FAULT_RESOLVED', label: 'Fault Resolved' },
      { value: 'FAULT_ESCALATED', label: 'Fault Escalated' },
      { value: 'INSPECTION_ALERT', label: 'Inspection Alert' },
      { value: 'OVERLOAD_ALERT', label: 'Overload Alert' },
      { value: 'OVERDUE_INSPECTION', label: 'Overdue Inspection' },
      { value: 'MAINTENANCE_ALERT', label: 'Maintenance Alert' },
      { value: 'SYSTEM_ALERT', label: 'System Alert' }
    ];

    return successResponse(res, 200, 'Notification types retrieved successfully', types);
  });
}

const _notificationInstance = new NotificationController();
module.exports = new Proxy(_notificationInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `notificationController.${String(prop)} not yet implemented` });
  }
});