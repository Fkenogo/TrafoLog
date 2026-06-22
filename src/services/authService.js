const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const BaseService = require('./baseService');
const { sendEmail } = require('../utils/email');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class AuthService extends BaseService {
  constructor() {
    super(User, 'User');
  }

  /**
   * Register new user
   */
  async register(userData, requestingUserId = null) {
    try {
      // Check if user exists
      const existingUser = await this.model.findOne({ email: userData.email });
      if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
      }

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const user = new this.model({
        ...userData,
        email_verification_token: verificationToken,
        email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_by: requestingUserId
      });

      await user.save();

      // Send verification email
      await this.sendVerificationEmail(user, verificationToken);

      // Log action
      await this.logAction({
        user_id: requestingUserId || user._id,
        action: 'USER_REGISTERED',
        target_user_id: user._id,
        details: `User ${user.email} registered`
      });

      return user;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.register:', error);
      throw new ApiError(500, 'Failed to register user');
    }
  }

  /**
   * Login user
   */
  async login(email, password, userAgent, ipAddress) {
    try {
      // Find user
      const user = await this.model.findOne({ email }).select('+password');
      if (!user) {
        throw new ApiError(401, 'Invalid email or password');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new ApiError(401, 'Account is deactivated');
      }

      // Check if account is locked
      if (user.isLocked()) {
        throw new ApiError(401, 'Account is locked due to too many failed attempts. Try again later.');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new ApiError(401, 'Invalid email or password');
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Update last login
      user.last_login = new Date();
      await user.save();

      // Generate tokens
      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      // Store refresh token
      const refreshTokenDoc = new RefreshToken({
        user_id: user._id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        user_agent: userAgent,
        ip_address: ipAddress
      });
      await refreshTokenDoc.save();

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const session = new Session({
        user_id: user._id,
        session_token: sessionToken,
        user_agent: userAgent,
        ip_address: ipAddress,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      await session.save();

      // Log login
      await this.logAction({
        user_id: user._id,
        action: 'LOGIN',
        details: `User ${user.email} logged in from IP ${ipAddress}`,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return {
        user,
        accessToken,
        refreshToken,
        sessionToken
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.login:', error);
      throw new ApiError(500, 'Failed to login');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken, userAgent, ipAddress) {
    try {
      // Validate refresh token
      const tokenDoc = await RefreshToken.findOne({
        token: refreshToken,
        is_revoked: false
      });

      if (!tokenDoc) {
        throw new ApiError(401, 'Invalid refresh token');
      }

      if (tokenDoc.isExpired()) {
        throw new ApiError(401, 'Refresh token expired');
      }

      // Get user
      const user = await this.model.findById(tokenDoc.user_id);
      if (!user || !user.is_active) {
        throw new ApiError(401, 'User not found or inactive');
      }

      // Generate new tokens
      const newAccessToken = user.generateAuthToken();

      // Rotate refresh token if enabled
      let newRefreshToken = refreshToken;
      if (process.env.ROTATE_REFRESH_TOKENS === 'true') {
        // Revoke old token
        tokenDoc.is_revoked = true;
        tokenDoc.revoked_at = new Date();
        tokenDoc.revoked_reason = 'Token rotated';
        await tokenDoc.save();

        // Create new refresh token
        newRefreshToken = user.generateRefreshToken();
        const newTokenDoc = new RefreshToken({
          user_id: user._id,
          token: newRefreshToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          user_agent: userAgent,
          ip_address: ipAddress
        });
        await newTokenDoc.save();
      }

      // Log refresh
      await this.logAction({
        user_id: user._id,
        action: 'REFRESH_TOKEN',
        details: `Token refreshed from IP ${ipAddress}`,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.refreshToken:', error);
      throw new ApiError(500, 'Failed to refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId, sessionToken, refreshToken = null) {
    try {
      // Invalidate session
      if (sessionToken) {
        await Session.findOneAndUpdate(
          { session_token: sessionToken },
          { is_active: false }
        );
      }

      // Revoke refresh token
      if (refreshToken) {
        await RefreshToken.findOneAndUpdate(
          { token: refreshToken },
          {
            is_revoked: true,
            revoked_at: new Date(),
            revoked_reason: 'User logged out'
          }
        );
      }

      // Log logout
      await this.logAction({
        user_id: userId,
        action: 'LOGOUT',
        details: 'User logged out'
      });

      return { success: true };
    } catch (error) {
      logger.error('Error in AuthService.logout:', error);
      throw new ApiError(500, 'Failed to logout');
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId) {
    try {
      // Invalidate all sessions
      await Session.updateMany(
        { user_id: userId },
        { is_active: false }
      );

      // Revoke all refresh tokens
      await RefreshToken.updateMany(
        { user_id: userId },
        {
          is_revoked: true,
          revoked_at: new Date(),
          revoked_reason: 'Logout from all devices'
        }
      );

      // Log logout all
      await this.logAction({
        user_id: userId,
        action: 'LOGOUT_ALL',
        details: 'User logged out from all devices'
      });

      return { success: true };
    } catch (error) {
      logger.error('Error in AuthService.logoutAll:', error);
      throw new ApiError(500, 'Failed to logout from all devices');
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const user = await this.model.findOne({ email });
      if (!user) {
        // Don't reveal that user doesn't exist
        return { success: true };
      }

      // Generate reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // Send reset email
      await this.sendPasswordResetEmail(user, resetToken);

      // Log action
      await this.logAction({
        user_id: user._id,
        action: 'PASSWORD_RESET_REQUESTED',
        details: 'Password reset requested'
      });

      return { success: true };
    } catch (error) {
      logger.error('Error in AuthService.requestPasswordReset:', error);
      throw new ApiError(500, 'Failed to request password reset');
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await this.model.findOne({
        reset_password_token: token,
        reset_password_expires: { $gt: new Date() }
      });

      if (!user) {
        throw new ApiError(400, 'Invalid or expired reset token');
      }

      // Update password
      user.password = newPassword;
      user.reset_password_token = undefined;
      user.reset_password_expires = undefined;
      await user.save();

      // Revoke all refresh tokens and sessions
      await RefreshToken.updateMany(
        { user_id: user._id },
        { is_revoked: true, revoked_reason: 'Password reset' }
      );
      await Session.updateMany(
        { user_id: user._id },
        { is_active: false }
      );

      // Log action
      await this.logAction({
        user_id: user._id,
        action: 'PASSWORD_RESET_COMPLETED',
        details: 'Password reset completed'
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.resetPassword:', error);
      throw new ApiError(500, 'Failed to reset password');
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    try {
      const user = await this.model.findOne({
        email_verification_token: token,
        email_verification_expires: { $gt: new Date() }
      });

      if (!user) {
        throw new ApiError(400, 'Invalid or expired verification token');
      }

      user.email_verified = true;
      user.email_verification_token = undefined;
      user.email_verification_expires = undefined;
      await user.save();

      // Log action
      await this.logAction({
        user_id: user._id,
        action: 'EMAIL_VERIFIED',
        details: 'Email verified'
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.verifyEmail:', error);
      throw new ApiError(500, 'Failed to verify email');
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    try {
      const user = await this.model.findOne({ email });
      if (!user || user.email_verified) {
        return { success: true };
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.email_verification_token = verificationToken;
      user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      // Send verification email
      await this.sendVerificationEmail(user, verificationToken);

      return { success: true };
    } catch (error) {
      logger.error('Error in AuthService.resendVerificationEmail:', error);
      throw new ApiError(500, 'Failed to resend verification email');
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.model.findById(userId).select('+password');
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Verify current password
      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        throw new ApiError(401, 'Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Log action
      await this.logAction({
        user_id: userId,
        action: 'PASSWORD_CHANGED',
        details: 'Password changed'
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.changePassword:', error);
      throw new ApiError(500, 'Failed to change password');
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(user, token) {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1a3c6e; color: white; padding: 20px; text-align: center; }
              .button { display: inline-block; padding: 12px 24px; background: #1a3c6e; color: white; text-decoration: none; border-radius: 4px; }
              .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>kVAssetTracker</h1>
              </div>
              <h2>Welcome to kVAssetTracker!</h2>
              <p>Please verify your email address by clicking the button below:</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email</a>
              </p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account, please ignore this email.</p>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} kVAssetTracker. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, token) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1a3c6e; color: white; padding: 20px; text-align: center; }
              .button { display: inline-block; padding: 12px 24px; background: #1a3c6e; color: white; text-decoration: none; border-radius: 4px; }
              .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>kVAssetTracker</h1>
              </div>
              <h2>Password Reset Request</h2>
              <p>You requested to reset your password. Click the button below to reset it:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, please ignore this email.</p>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} kVAssetTracker. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
  }

  /**
   * Log action to audit log
   */
  async logAction(data) {
    try {
      const auditLog = new AuditLog({
        user_id: data.user_id,
        action: data.action,
        target_user_id: data.target_user_id,
        details: data.details,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        metadata: data.metadata
      });
      await auditLog.save();
    } catch (error) {
      logger.error('Error logging action:', error);
      // Don't throw, just log
    }
  }

  /**
   * Validate session
   */
  async validateSession(sessionToken) {
    try {
      const session = await Session.findOne({
        session_token: sessionToken,
        is_active: true,
        expires_at: { $gt: new Date() }
      });

      if (!session) {
        return null;
      }

      // Update last activity
      session.last_activity = new Date();
      await session.save();

      return session;
    } catch (error) {
      logger.error('Error in AuthService.validateSession:', error);
      return null;
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId) {
    try {
      return await Session.find({
        user_id: userId,
        is_active: true
      }).sort({ last_activity: -1 });
    } catch (error) {
      logger.error('Error in AuthService.getUserSessions:', error);
      throw new ApiError(500, 'Failed to get user sessions');
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionToken, userId) {
    try {
      const session = await Session.findOne({
        session_token: sessionToken,
        user_id: userId
      });

      if (!session) {
        throw new ApiError(404, 'Session not found');
      }

      session.is_active = false;
      await session.save();

      // Log action
      await this.logAction({
        user_id: userId,
        action: 'SESSION_REVOKED',
        details: `Session ${sessionToken} revoked`
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in AuthService.revokeSession:', error);
      throw new ApiError(500, 'Failed to revoke session');
    }
  }
}

module.exports = new AuthService();