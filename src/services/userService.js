const mongoose = require('mongoose');
const User = require('../models/User');
const AuditService = require('./auditService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

const SAFE_UPDATE_FIELDS = [
  'name',
  'email',
  'territory_id',
  'service_area_id',
  'preferences'
];

const SENSITIVE_AUDIT_FIELDS = [
  'password',
  'confirmPassword',
  'reset_password_token',
  'email_verification_token',
  'refresh_tokens',
  'push_tokens',
  'two_factor_secret'
];

const pick = (source, fields) => fields.reduce((acc, field) => {
  if (source[field] !== undefined) acc[field] = source[field];
  return acc;
}, {});

const scrubAuditValues = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubAuditValues);

  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (SENSITIVE_AUDIT_FIELDS.some((field) => key.toLowerCase().includes(field))) {
      acc[key] = '[REDACTED]';
      return acc;
    }
    acc[key] = scrubAuditValues(entry);
    return acc;
  }, {});
};

class UserService {
  constructor() {
    this.auditService = AuditService;
  }

  buildFilters(query = {}) {
    const filters = {};

    if (query.search) {
      filters.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } }
      ];
    }

    if (query.role) filters.role = query.role;
    if (query.territory_id) filters.territory_id = query.territory_id;
    if (query.service_area_id) filters.service_area_id = query.service_area_id;
    if (query.is_active !== undefined) filters.is_active = query.is_active;

    return filters;
  }

  async listUsers(query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;
    const filters = this.buildFilters(query);

    const [data, total] = await Promise.all([
      User.find(filters)
        .populate('territory_id', 'name code')
        .populate('service_area_id', 'name')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filters)
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUserById(id) {
    const user = await User.findById(id)
      .populate('territory_id', 'name code')
      .populate('service_area_id', 'name');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  }

  async createUser(data, actor, req) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }

    const user = new User({
      ...data,
      created_by: actor._id,
      updated_by: actor._id
    });

    await user.save();
    await this.logUserAction('USER_CREATE', actor, user, req, {
      new_values: scrubAuditValues({
        name: user.name,
        email: user.email,
        role: user.role,
        territory_id: user.territory_id,
        service_area_id: user.service_area_id,
        is_active: user.is_active
      }),
      details: `Created user ${user.email}`
    });

    return this.getUserById(user._id);
  }

  async updateUser(id, data, actor, req) {
    const user = await this.getUserById(id);
    const update = pick(data, SAFE_UPDATE_FIELDS);

    if (update.email && update.email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({
        email: update.email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
      }
    }

    const oldValues = pick(user.toJSON(), SAFE_UPDATE_FIELDS);
    Object.assign(user, update, { updated_by: actor._id });
    await user.save();

    await this.logUserAction('USER_UPDATE', actor, user, req, {
      old_values: scrubAuditValues(oldValues),
      new_values: scrubAuditValues(pick(user.toJSON(), SAFE_UPDATE_FIELDS)),
      details: `Updated user ${user.email}`
    });

    return this.getUserById(user._id);
  }

  async changeRole(id, data, actor, req) {
    const user = await this.getUserById(id);

    if (this.sameId(user._id, actor._id)) {
      throw new ApiError(400, 'You cannot change your own role through User Management');
    }

    if (user.role === 'Super Admin' && data.role !== 'Super Admin') {
      await this.ensureAnotherActiveSuperAdmin(user._id);
    }

    const oldValues = {
      role: user.role,
      territory_id: user.territory_id,
      service_area_id: user.service_area_id
    };

    user.role = data.role;
    user.territory_id = data.territory_id || undefined;
    user.service_area_id = data.service_area_id || undefined;
    user.updated_by = actor._id;
    await user.save();

    await this.logUserAction('USER_ROLE_CHANGE', actor, user, req, {
      old_values: scrubAuditValues(oldValues),
      new_values: scrubAuditValues({
        role: user.role,
        territory_id: user.territory_id,
        service_area_id: user.service_area_id
      }),
      details: `Changed role for user ${user.email}`
    });

    return this.getUserById(user._id);
  }

  async activateUser(id, actor, req, notes = null) {
    const user = await this.getUserById(id);
    const wasActive = user.is_active;

    user.is_active = true;
    user.deleted_at = undefined;
    user.deleted_by = undefined;
    user.updated_by = actor._id;
    await user.save();

    await this.logUserAction('USER_ACTIVATE', actor, user, req, {
      old_values: { is_active: wasActive },
      new_values: { is_active: user.is_active },
      metadata: notes ? { notes } : undefined,
      details: `Activated user ${user.email}`
    });

    return this.getUserById(user._id);
  }

  async deactivateUser(id, actor, req, reason = null) {
    const user = await this.getUserById(id);

    if (this.sameId(user._id, actor._id)) {
      throw new ApiError(400, 'You cannot deactivate your own account');
    }

    if (user.role === 'Super Admin') {
      await this.ensureAnotherActiveSuperAdmin(user._id);
    }

    const wasActive = user.is_active;
    user.is_active = false;
    user.deleted_at = new Date();
    user.deleted_by = actor._id;
    user.updated_by = actor._id;
    await user.save();

    await this.logUserAction('USER_DEACTIVATE', actor, user, req, {
      old_values: { is_active: wasActive },
      new_values: { is_active: user.is_active },
      metadata: reason ? { reason } : undefined,
      details: `Deactivated user ${user.email}`
    });

    return this.getUserById(user._id);
  }

  async ensureAnotherActiveSuperAdmin(userId) {
    const count = await User.countDocuments({
      _id: { $ne: userId },
      role: 'Super Admin',
      is_active: true
    });

    if (count < 1) {
      throw new ApiError(400, 'Cannot remove the last active Super Admin');
    }
  }

  sameId(a, b) {
    return new mongoose.Types.ObjectId(a).equals(new mongoose.Types.ObjectId(b));
  }

  async logUserAction(action, actor, targetUser, req, payload = {}) {
    try {
      await this.auditService.logAction({
        user_id: actor._id,
        action,
        action_category: 'USER_MANAGEMENT',
        target_user_id: targetUser._id,
        target_record_type: 'User',
        target_record_id: targetUser._id,
        request_method: req.method,
        request_path: req.originalUrl,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        ...payload
      });
    } catch (error) {
      logger.error('User audit logging failed:', error);
    }
  }
}

module.exports = new UserService();
