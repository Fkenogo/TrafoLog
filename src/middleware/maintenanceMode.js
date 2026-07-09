const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MaintenanceModeService = require('../services/maintenanceModeService');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH_WRITE_ALLOWLIST = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/logout-all'
]);

const isAllowedPath = (path) => (
  path === '/admin/maintenance' ||
  path === '/health' ||
  path === '/version' ||
  AUTH_WRITE_ALLOWLIST.has(path)
);

const getBearerToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  return req.cookies?.accessToken || null;
};

const getRequestUser = async (req) => {
  if (req.user) return req.user;

  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(decoded.id).select('role is_active');
  } catch (error) {
    return null;
  }
};

const maintenanceModeMiddleware = async (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method) || isAllowedPath(req.path)) {
    return next();
  }

  const state = await MaintenanceModeService.getState();
  if (!state.enabled) {
    return next();
  }

  if (process.env.NODE_ENV === 'test' && req.get('X-Maintenance-Test-Enforce') !== 'true') {
    return next();
  }

  const user = await getRequestUser(req);
  if (user?.is_active && user.role === 'Super Admin' && req.path.startsWith('/admin')) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: 'System is under maintenance',
    maintenance: {
      enabled: true,
      message: state.message,
      reason: state.reason
    }
  });
};

module.exports = maintenanceModeMiddleware;
