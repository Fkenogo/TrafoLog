const AuditLog = require('../models/AuditLog');
const AuditService = require('../services/auditService');
const { asyncHandler, successResponse } = require('../utils/helpers');

const SENSITIVE_KEYS = [
  'password',
  'token',
  'refresh',
  'secret',
  'reset_password_token',
  'email_verification_token',
  'refresh_tokens',
  'two_factor_secret'
];

const AUDIT_CATEGORIES = [
  'AUTH',
  'USER_MANAGEMENT',
  'TRANSFORMER_MANAGEMENT',
  'INSPECTION',
  'FAULT_MANAGEMENT',
  'MAINTENANCE',
  'INSTALLATION',
  'REPORTING',
  'IMPORT',
  'EXPORT',
  'SYSTEM'
];

const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'LOGOUT_ALL',
  'REFRESH_TOKEN',
  'SESSION_REVOKED',
  'PASSWORD_CHANGE',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'EMAIL_VERIFY',
  'EMAIL_VERIFIED',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DELETE',
  'USER_ROLE_CHANGE',
  'USER_ACTIVATE',
  'USER_DEACTIVATE',
  'TRANSFORMER_CREATE',
  'TRANSFORMER_UPDATE',
  'TRANSFORMER_DELETE',
  'TRANSFORMER_VERIFY',
  'TRANSFORMER_DECOMMISSION',
  'INSPECTION_CREATE',
  'INSPECTION_UPDATE',
  'INSPECTION_DELETE',
  'FAULT_CREATE',
  'FAULT_UPDATE',
  'FAULT_RESOLVE',
  'FAULT_ASSIGN',
  'FAULT_CLOSE',
  'MAINTENANCE_CREATE',
  'MAINTENANCE_UPDATE',
  'MAINTENANCE_DELETE',
  'REPORT_GENERATE',
  'REPORT_EXPORT',
  'EXPORT_START',
  'EXPORT_COMPLETE',
  'SYSTEM_BACKUP',
  'SYSTEM_RESTORE',
  'SYSTEM_MAINTENANCE'
];

const shouldRedactKey = (key) => SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey));

const redactSensitiveValues = (value) => {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      if (shouldRedactKey(key)) {
        acc[key] = '[REDACTED]';
        return acc;
      }
      acc[key] = redactSensitiveValues(entry);
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

const buildAuditFilters = (query = {}, overrides = {}) => {
  const filters = { ...overrides };

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

const getAuditLogPage = async (query, overrides = {}) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const filters = buildAuditFilters(query, overrides);
  const result = await AuditService.getAll(filters, {
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

const sendAuditList = (res, result) => res.status(200).json({
  success: true,
  data: result.data,
  pagination: result.pagination
});

module.exports = {
  getAuditLogs: asyncHandler(async (req, res) => {
    const result = await getAuditLogPage(req.query);
    return sendAuditList(res, result);
  }),
  getUserAuditLogs: asyncHandler(async (req, res) => {
    const result = await getAuditLogPage(req.query, { user_id: req.params.userId });
    return sendAuditList(res, result);
  }),
  getTransformerAuditLogs: asyncHandler(async (req, res) => {
    const result = await getAuditLogPage(req.query, { target_transformer_id: req.params.transformerId });
    return sendAuditList(res, result);
  }),
  getAuditActions: asyncHandler(async (req, res) => {
    const [categories, actions] = await Promise.all([
      AuditLog.distinct('action_category'),
      AuditLog.distinct('action')
    ]);

    return successResponse(res, 200, 'Audit actions retrieved successfully', {
      categories: Array.from(new Set([...AUDIT_CATEGORIES, ...categories])).sort(),
      actions: Array.from(new Set([...AUDIT_ACTIONS, ...actions])).sort()
    });
  }),
};
