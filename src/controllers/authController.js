const AuthService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/helpers');
const { validate } = require('../utils/validation');

class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const { error } = validate.register(req.body);
      if (error) {
        return errorResponse(res, 400, error.details[0].message);
      }
      
      const user = await AuthService.register(req.body, req.user?.id);
      
      return successResponse(res, 201, 'User registered successfully', {
        user,
        message: 'Please check your email to verify your account'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      const result = await AuthService.login(email, password, userAgent, ipAddress);
      
      // Set cookies for secure token storage
      this.setTokenCookies(res, result);
      
      return successResponse(res, 200, 'Login successful', {
        user: result.user,
        accessToken: result.accessToken,
        sessionToken: result.sessionToken
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      if (!refreshToken) {
        return errorResponse(res, 401, 'Refresh token required');
      }
      
      const result = await AuthService.refreshToken(refreshToken, userAgent, ipAddress);
      
      // Update cookies
      this.setTokenCookies(res, result);
      
      return successResponse(res, 200, 'Token refreshed successfully', {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      const sessionToken = req.body.sessionToken || req.cookies.sessionToken;
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      
      await AuthService.logout(req.user.id, sessionToken, refreshToken);
      
      // Clear cookies
      this.clearTokenCookies(res);
      
      return successResponse(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   */
  async logoutAll(req, res, next) {
    try {
      await AuthService.logoutAll(req.user.id);
      
      // Clear cookies
      this.clearTokenCookies(res);
      
      return successResponse(res, 200, 'Logged out from all devices');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return errorResponse(res, 400, 'Email is required');
      }
      
      await AuthService.requestPasswordReset(email);
      
      return successResponse(res, 200, 'If your email exists in our system, you will receive a password reset link');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Reset password
   * POST /api/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const { token, password, confirmPassword } = req.body;
      
      if (password !== confirmPassword) {
        return errorResponse(res, 400, 'Passwords do not match');
      }
      
      await AuthService.resetPassword(token, password);
      
      return successResponse(res, 200, 'Password reset successfully');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Verify email
   * POST /api/auth/verify-email
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return errorResponse(res, 400, 'Verification token is required');
      }
      
      await AuthService.verifyEmail(token);
      
      return successResponse(res, 200, 'Email verified successfully');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Resend verification email
   * POST /api/auth/resend-verification
   */
  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return errorResponse(res, 400, 'Email is required');
      }
      
      await AuthService.resendVerificationEmail(email);
      
      return successResponse(res, 200, 'Verification email sent');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Change password
   * POST /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      
      if (newPassword !== confirmPassword) {
        return errorResponse(res, 400, 'Passwords do not match');
      }
      
      await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      
      return successResponse(res, 200, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get current user
   * GET /api/auth/me
   */
  async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user.id)
        .populate('territory_id', 'name code')
        .populate('service_area_id', 'name');
      
      return successResponse(res, 200, 'User details retrieved', user);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Update current user
   * PUT /api/auth/me
   */
  async updateMe(req, res, next) {
    try {
      const allowedUpdates = ['name', 'preferences', 'push_tokens'];
      const updates = {};
      
      for (const field of allowedUpdates) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      const user = await User.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true, runValidators: true }
      );
      
      return successResponse(res, 200, 'User updated successfully', user);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get user sessions
   * GET /api/auth/sessions
   */
  async getSessions(req, res, next) {
    try {
      const sessions = await AuthService.getUserSessions(req.user.id);
      return successResponse(res, 200, 'Sessions retrieved', sessions);
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Revoke session
   * DELETE /api/auth/sessions/:sessionToken
   */
  async revokeSession(req, res, next) {
    try {
      await AuthService.revokeSession(req.params.sessionToken, req.user.id);
      return successResponse(res, 200, 'Session revoked successfully');
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Set authentication cookies
   */
  setTokenCookies(res, { accessToken, refreshToken, sessionToken }) {
    // Access token cookie (short-lived)
    if (accessToken) {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }
    
    // Refresh token cookie (long-lived)
    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    
    // Session token cookie
    if (sessionToken) {
      res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }
  }
  
  /**
   * Clear authentication cookies
   */
  clearTokenCookies(res) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('sessionToken');
  }
}

module.exports = new AuthController();