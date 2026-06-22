/**
 * Success response helper
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response helper
 */
const errorResponse = (res, statusCode = 500, message = 'Internal Server Error', errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Pagination helper
 */
const getPagination = (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  return {
    skip,
    limit: parseInt(limit),
    page: parseInt(page)
  };
};

/**
 * Generate pagination meta
 */
const getPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * Sanitize object (remove undefined and null values)
 */
const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nested = sanitizeObject(value);
        if (Object.keys(nested).length > 0) {
          sanitized[key] = nested;
        }
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
};

/**
 * Format date
 */
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  const pad = (n) => String(n).padStart(2, '0');
  
  const replacements = {
    'YYYY': d.getFullYear(),
    'MM': pad(d.getMonth() + 1),
    'DD': pad(d.getDate()),
    'HH': pad(d.getHours()),
    'mm': pad(d.getMinutes()),
    'ss': pad(d.getSeconds())
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => replacements[match]);
};

/**
 * Generate random ID
 */
const generateId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}${random}`.toUpperCase();
};

/**
 * Check if object has required fields
 */
const hasRequiredFields = (obj, fields) => {
  for (const field of fields) {
    if (!obj[field] || obj[field] === '') {
      return false;
    }
  }
  return true;
};

/**
 * Extract error messages from validation errors
 */
const extractValidationErrors = (errors) => {
  if (!errors || !errors.details) return [];
  return errors.details.map((err) => ({
    field: err.path.join('.'),
    message: err.message
  }));
};

/**
 * Mask sensitive data
 */
const maskSensitiveData = (obj, fields = ['password', 'token', 'secret']) => {
  const masked = { ...obj };
  for (const field of fields) {
    if (masked[field]) {
      masked[field] = '********';
    }
  }
  return masked;
};

/**
 * Calculate date difference
 */
const dateDiff = (date1, date2, unit = 'days') => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  
  const units = {
    'ms': 1,
    'seconds': 1000,
    'minutes': 60000,
    'hours': 3600000,
    'days': 86400000,
    'weeks': 604800000
  };
  
  return Math.floor(diffTime / units[unit]);
};

/**
 * Parse query parameters for filters
 */
const parseQueryFilters = (query, mapping = {}) => {
  const filters = {};
  
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      const mappedKey = mapping[key] || key;
      
      // Handle special cases
      if (key.includes('_id') || key === 'id') {
        filters[mappedKey] = value;
      } else if (key === 'dateFrom' || key === 'dateTo') {
        if (!filters.date) filters.date = {};
        filters.date[key === 'dateFrom' ? '$gte' : '$lte'] = new Date(value);
      } else if (typeof value === 'string' && value.includes(',')) {
        filters[mappedKey] = { $in: value.split(',') };
      } else if (!isNaN(value) && value !== '') {
        filters[mappedKey] = Number(value);
      } else {
        filters[mappedKey] = value;
      }
    }
  }
  
  return filters;
};

module.exports = {
  successResponse,
  errorResponse,
  asyncHandler,
  getPagination,
  getPaginationMeta,
  sanitizeObject,
  formatDate,
  generateId,
  hasRequiredFields,
  extractValidationErrors,
  maskSensitiveData,
  dateDiff,
  parseQueryFilters
};