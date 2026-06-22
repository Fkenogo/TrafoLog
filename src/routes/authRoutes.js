const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  verificationLimiter
} = require('../middleware/authRateLimiter');
const { validate } = require('../middleware/validation');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema
} = require('../validators/authValidator');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  AuthController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  AuthController.login
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  AuthController.refreshToken
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post(
  '/logout',
  authenticate,
  AuthController.logout
);

/**
 * @route POST /api/auth/logout-all
 * @desc Logout from all devices
 * @access Private
 */
router.post(
  '/logout-all',
  authenticate,
  AuthController.logoutAll
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 */
router.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  AuthController.resetPassword
);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email using token
 * @access Public
 */
router.post(
  '/verify-email',
  verificationLimiter,
  validate(verifyEmailSchema),
  AuthController.verifyEmail
);

/**
 * @route POST /api/auth/resend-verification
 * @desc Resend verification email
 * @access Public
 */
router.post(
  '/resend-verification',
  verificationLimiter,
  validate(resendVerificationSchema),
  AuthController.resendVerification
);

/**
 * @route POST /api/auth/change-password
 * @desc Change password for authenticated user
 * @access Private
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  AuthController.changePassword
);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get(
  '/me',
  authenticate,
  AuthController.getMe
);

/**
 * @route PUT /api/auth/me
 * @desc Update current user profile
 * @access Private
 */
router.put(
  '/me',
  authenticate,
  AuthController.updateMe
);

/**
 * @route GET /api/auth/sessions
 * @desc Get user sessions
 * @access Private
 */
router.get(
  '/sessions',
  authenticate,
  AuthController.getSessions
);

/**
 * @route DELETE /api/auth/sessions/:sessionToken
 * @desc Revoke specific session
 * @access Private
 */
router.delete(
  '/sessions/:sessionToken',
  authenticate,
  AuthController.revokeSession
);

module.exports = router;