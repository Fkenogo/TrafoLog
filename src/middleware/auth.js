const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { ApiError } = require('../utils/error');
const { asyncHandler } = require('../utils/helpers');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  
  // Get token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Get token from cookie
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  
  if (!token) {
    throw new ApiError(401, 'Authentication required. Please login.');
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id)
      .populate('territory_id', 'name code')
      .populate('service_area_id', 'name');
    
    if (!user) {
      throw new ApiError(401, 'User not found');
    }
    
    if (!user.is_active) {
      throw new ApiError(401, 'Account is deactivated');
    }
    
    // Validate session if session token provided
    if (req.cookies && req.cookies.sessionToken) {
      const session = await Session.findOne({
        session_token: req.cookies.sessionToken,
        user_id: user._id,
        is_active: true,
        expires_at: { $gt: new Date() }
      });
      
      if (!session) {
        throw new ApiError(401, 'Invalid session');
      }
      
      // Update last activity
      session.last_activity = new Date();
      await session.save();
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired. Please refresh.');
    }
    throw error;
  }
});

/**
 * Authorize middleware
 * Restricts access based on user role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    
    next();
  };
};

/**
 * Check if user has permission to access a transformer
 */
const canAccessTransformer = (user, transformer) => {
  if (user.role === 'Super Admin') return true;
  if (user.role === 'Viewer') return true;
  
  const transformerTerritory = transformer.location_operational?.territory_id;
  const transformerServiceArea = transformer.location_operational?.service_area_id;
  
  if (user.role === 'Territory Manager') {
    return transformerTerritory?.toString() === user.territory_id?.toString();
  }
  
  if (user.role === 'Engineer' || user.role === 'Field Technician') {
    return transformerServiceArea?.toString() === user.service_area_id?.toString();
  }
  
  return false;
};

/**
 * Check if user can access a territory
 */
const canAccessTerritory = (user, territoryId) => {
  if (user.role === 'Super Admin') return true;
  if (user.role === 'Viewer') return true;
  
  if (user.role === 'Territory Manager') {
    return user.territory_id?.toString() === territoryId?.toString();
  }
  
  if (user.role === 'Engineer' || user.role === 'Field Technician') {
    // Check if territory contains user's service area
    // This would require additional database query
    return true;
  }
  
  return false;
};

module.exports = {
  authenticate,
  authorize,
  canAccessTransformer,
  canAccessTerritory
};