const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Transformer = require('../models/Transformer');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const UserService = require('../services/userService');
const AuditService = require('../services/auditService');
const MaintenanceModeService = require('../services/maintenanceModeService');
const BackupService = require('../services/backupService');
const RestoreService = require('../services/restoreService');
const { asyncHandler, successResponse } = require('../utils/helpers');

const OPEN_FAULT_STATUSES = ['Open', 'Assigned', 'In Progress'];
const SENSITIVE_KEYS = [
  'password',
  'token',
  'refresh',
  'reset_password_token',
  'email_verification_token',
  'refresh_tokens',
  'secret'
];

const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `AdminController.${name} not yet implemented` });

const toCountMap = (items, keyName = '_id') => items.reduce((acc, item) => {
  const key = item[keyName] || 'Unknown';
  acc[key] = item.count;
  return acc;
}, {});

const sanitizeUser = (user) => {
  const data = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete data.password;
  delete data.refresh_tokens;
  delete data.reset_password_token;
  delete data.reset_password_expires;
  delete data.email_verification_token;
  delete data.email_verification_expires;
  delete data.two_factor_secret;
  delete data.push_tokens;
  return data;
};

const shouldRedactKey = (key) => SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey));

const redactSensitiveValues = (value) => {
  if (Array.isArray(value)) return value.map(redactSensitiveValues);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[key] = shouldRedactKey(key) ? '[REDACTED]' : redactSensitiveValues(entry);
      return acc;
    }, {});
  }
  return value;
};

const sanitizeUserRef = (value) => {
  if (!value || typeof value !== 'object') return value;
  return {
    _id: value._id,
    name: value.name,
    email: value.email,
    role: value.role
  };
};

const sanitizeTransformerRef = (value) => {
  if (!value || typeof value !== 'object') return value;
  return {
    _id: value._id,
    asset_id: value.asset_id,
    site_name: value.location_administrative?.site_name
  };
};

const sanitizeAuditLog = (log) => {
  const item = typeof log.toJSON === 'function' ? log.toJSON() : log;
  return {
    _id: item._id,
    user_id: sanitizeUserRef(item.user_id),
    action: item.action,
    action_category: item.action_category,
    target_user_id: sanitizeUserRef(item.target_user_id),
    target_transformer_id: sanitizeTransformerRef(item.target_transformer_id),
    target_record_type: item.target_record_type,
    target_record_id: item.target_record_id,
    details: item.details,
    request_method: item.request_method,
    request_path: item.request_path,
    old_values: redactSensitiveValues(item.old_values || {}),
    new_values: redactSensitiveValues(item.new_values || {}),
    metadata: redactSensitiveValues(item.metadata || {}),
    is_sensitive: item.is_sensitive,
    created_at: item.created_at,
    updated_at: item.updated_at
  };
};

const buildAuditFilters = (query = {}) => {
  const filters = {};
  if (query.action) filters.action = query.action;
  if (query.action_category) filters.action_category = query.action_category;
  if (query.user_id) filters.user_id = query.user_id;
  if (query.target_type) filters.target_record_type = query.target_type;
  if (query.target_id) filters.target_record_id = query.target_id;
  if (query.is_sensitive !== undefined) filters.is_sensitive = query.is_sensitive;
  if (query.startDate || query.endDate) {
    filters.created_at = {};
    if (query.startDate) filters.created_at.$gte = query.startDate;
    if (query.endDate) filters.created_at.$lte = query.endDate;
  }
  return filters;
};

const getAuditLogPage = async (query = {}) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const result = await AuditService.getAll(buildAuditFilters(query), {
    page,
    limit,
    sort: { created_at: -1 },
    populate: ['user_id', 'target_user_id', 'target_transformer_id']
  });

  return {
    data: result.data.map(sanitizeAuditLog),
    pagination: result.pagination
  };
};

const getSystemStats = async () => {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    usersByRole,
    totalTransformers,
    transformersByStatus,
    openFaults,
    overdueInspections,
    upcomingMaintenance,
    recentAuditActivity
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ is_active: true }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Transformer.countDocuments(),
    Transformer.aggregate([{ $group: { _id: '$operational_status', count: { $sum: 1 } } }]),
    Fault.countDocuments({ fault_status: { $in: OPEN_FAULT_STATUSES } }),
    Transformer.countDocuments({
      operational_status: { $ne: 'Decommissioned' },
      $or: [
        { overdue_inspection_flag: true },
        { last_inspection_date: { $lt: ninetyDaysAgo } },
        { last_inspection_date: { $exists: false } }
      ]
    }),
    Maintenance.countDocuments({
      is_deleted: { $ne: true },
      next_maintenance_date: { $gte: now, $lte: thirtyDaysFromNow }
    }),
    AuditLog.countDocuments({ created_at: { $gte: oneDayAgo } })
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      by_role: toCountMap(usersByRole)
    },
    transformers: {
      total: totalTransformers,
      by_status: toCountMap(transformersByStatus)
    },
    faults: {
      open: openFaults
    },
    inspections: {
      overdue: overdueInspections
    },
    maintenance: {
      upcoming: upcomingMaintenance
    },
    audit: {
      recent_activity_count: recentAuditActivity
    },
    generated_at: new Date().toISOString()
  };
};

module.exports = {
  getSystemStats: asyncHandler(async (req, res) => {
    const stats = await getSystemStats();
    return successResponse(res, 200, 'System stats retrieved successfully', stats);
  }),

  getAllUsers: asyncHandler(async (req, res) => {
    const result = await UserService.listUsers(req.query);
    return res.status(200).json({
      success: true,
      data: result.data.map(sanitizeUser),
      pagination: result.pagination
    });
  }),

  getAuditLogs: asyncHandler(async (req, res) => {
    const result = await getAuditLogPage(req.query);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  }),

  getMaintenanceMode: asyncHandler(async (req, res) => {
    const state = await MaintenanceModeService.getState({ useCache: false });
    return successResponse(res, 200, 'Maintenance mode status retrieved successfully', state);
  }),

  toggleMaintenanceMode: asyncHandler(async (req, res) => {
    const state = await MaintenanceModeService.setState(req.body, req.user, req);
    return successResponse(res, 200, 'Maintenance mode updated successfully', state);
  }),

  triggerBackup: asyncHandler(async (req, res) => {
    const result = await BackupService.createBackup(req.body, req.user, req);
    const statusCode = result.failed ? 500 : 201;
    return res.status(statusCode).json({
      success: !result.failed,
      message: result.failed ? 'Backup failed' : 'Backup completed successfully',
      data: BackupService.toMetadata(result.job)
    });
  }),

  getBackupHistory: asyncHandler(async (req, res) => {
    const result = await BackupService.listBackups(req.query);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  }),

  restoreFromBackup: asyncHandler(async (req, res) => {
    const result = await RestoreService.restore(req.params.backupId, req.body, req.user, req);
    return res.status(200).json({
      success: true,
      data: result
    });
  }),
};
