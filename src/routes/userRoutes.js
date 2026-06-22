const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createUserSchema,
  updateUserSchema,
  userQuerySchema
} = require('../validators/userValidator');

/**
 * @route GET /api/users
 * @desc Get all users with pagination and filters
 * @access Private (Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(userQuerySchema, 'query'),
  UserController.getAllUsers
);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (Admin)
 */
router.get(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  UserController.getUserById
);

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(createUserSchema),
  UserController.createUser
);

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Private (Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  validate(updateUserSchema),
  UserController.updateUser
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete (deactivate) user
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  UserController.deleteUser
);

/**
 * @route POST /api/users/:id/activate
 * @desc Activate user
 * @access Private (Admin)
 */
router.post(
  '/:id/activate',
  authenticate,
  authorize('Super Admin'),
  UserController.activateUser
);

/**
 * @route POST /api/users/:id/deactivate
 * @desc Deactivate user
 * @access Private (Admin)
 */
router.post(
  '/:id/deactivate',
  authenticate,
  authorize('Super Admin', 'Territory Manager'),
  UserController.deactivateUser
);

/**
 * @route POST /api/users/:id/role
 * @desc Change user role
 * @access Private (Admin)
 */
router.post(
  '/:id/role',
  authenticate,
  authorize('Super Admin'),
  UserController.changeUserRole
);

/**
 * @route GET /api/users/me/territory
 * @desc Get users in my territory
 * @access Private
 */
router.get(
  '/me/territory',
  authenticate,
  UserController.getUsersInMyTerritory
);

module.exports = router;