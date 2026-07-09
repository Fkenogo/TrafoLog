const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  changeUserRoleSchema,
  activateUserSchema,
  deactivateUserSchema
} = require('../validators/userValidator');

/**
 * @route GET /api/users
 * @desc Get all users with pagination and filters
 * @access Private (Admin)
 */
router.get(
  '/',
  authenticate,
  authorize('Super Admin'),
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
  authorize('Super Admin'),
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
  authorize('Super Admin'),
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
  authorize('Super Admin'),
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
  validate(activateUserSchema),
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
  authorize('Super Admin'),
  validate(deactivateUserSchema),
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
  validate(changeUserRoleSchema),
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
