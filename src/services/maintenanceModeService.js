const MaintenanceMode = require('../models/MaintenanceMode');
const AuditService = require('./auditService');
const redis = require('../config/redis');
const { logger } = require('../utils/logger');

const CACHE_KEY = 'system:maintenance-mode';
const CACHE_TTL_SECONDS = 60;
const STATE_KEY = 'global';
const DEFAULT_MESSAGE = 'System is under maintenance';

const toIso = (value) => (value ? new Date(value).toISOString() : null);
const toId = (value) => (value ? value.toString() : null);

class MaintenanceModeService {
  defaultState() {
    return {
      enabled: false,
      message: DEFAULT_MESSAGE,
      reason: null,
      enabled_by: null,
      enabled_at: null,
      disabled_by: null,
      disabled_at: null,
      updated_at: null
    };
  }

  normalize(doc) {
    if (!doc) return this.defaultState();
    const item = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
      enabled: Boolean(item.enabled),
      message: item.message || DEFAULT_MESSAGE,
      reason: item.reason || null,
      enabled_by: toId(item.enabled_by),
      enabled_at: toIso(item.enabled_at),
      disabled_by: toId(item.disabled_by),
      disabled_at: toIso(item.disabled_at),
      updated_at: toIso(item.updated_at)
    };
  }

  async cacheState(state) {
    await redis.set(CACHE_KEY, state, CACHE_TTL_SECONDS);
  }

  async getState({ useCache = true } = {}) {
    if (useCache) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return cached;
    }

    const doc = await MaintenanceMode.findOne({ key: STATE_KEY });
    const state = this.normalize(doc);
    await this.cacheState(state);
    return state;
  }

  async setState(payload, user, req = null) {
    const existing = await MaintenanceMode.findOne({ key: STATE_KEY });
    const now = new Date();
    const enabled = Boolean(payload.enabled);
    const update = {
      key: STATE_KEY,
      enabled,
      message: payload.message || existing?.message || DEFAULT_MESSAGE,
      reason: payload.reason || null
    };

    if (enabled) {
      update.enabled_by = user._id;
      update.enabled_at = now;
      update.disabled_by = null;
      update.disabled_at = null;
    } else {
      update.disabled_by = user._id;
      update.disabled_at = now;
    }

    const doc = await MaintenanceMode.findOneAndUpdate(
      { key: STATE_KEY },
      update,
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const state = this.normalize(doc);
    await this.cacheState(state);
    await this.logMaintenanceChange(enabled, state, user, req);
    return state;
  }

  async logMaintenanceChange(enabled, state, user, req) {
    try {
      await AuditService.logAction({
        user_id: user._id,
        action: enabled ? 'SYSTEM_MAINTENANCE_ENABLED' : 'SYSTEM_MAINTENANCE_DISABLED',
        action_category: 'SYSTEM',
        details: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
        request_method: req?.method,
        request_path: req?.originalUrl,
        ip_address: req?.ip,
        user_agent: req?.get ? req.get('User-Agent') : undefined,
        new_values: {
          enabled: state.enabled,
          message: state.message,
          reason: state.reason
        }
      });
    } catch (error) {
      logger.error('Failed to write maintenance mode audit log:', error);
    }
  }
}

module.exports = new MaintenanceModeService();
