const UserService = require('../services/userService');
const { asyncHandler, successResponse } = require('../utils/helpers');

const sanitizeUser = (user) => {
  const data = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };

  delete data.password;
  delete data.refresh_tokens;
  delete data.reset_password_token;
  delete data.reset_password_expires;
  delete data.email_verification_token;
  delete data.email_verification_expires;
  delete data.two_factor_secret;
  delete data.push_tokens;

  return data;
};

const sendUserList = (res, result) => res.status(200).json({
  success: true,
  data: result.data.map(sanitizeUser),
  pagination: result.pagination
});

const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `UserController.${name} not yet implemented` });

module.exports = {
  getAllUsers: asyncHandler(async (req, res) => {
    const result = await UserService.listUsers(req.query);
    return sendUserList(res, result);
  }),

  getUserById: asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.params.id);
    return successResponse(res, 200, 'User retrieved successfully', sanitizeUser(user));
  }),

  createUser: asyncHandler(async (req, res) => {
    const user = await UserService.createUser(req.body, req.user, req);
    return successResponse(res, 201, 'User created successfully', sanitizeUser(user));
  }),

  updateUser: asyncHandler(async (req, res) => {
    const user = await UserService.updateUser(req.params.id, req.body, req.user, req);
    return successResponse(res, 200, 'User updated successfully', sanitizeUser(user));
  }),

  deleteUser: notImpl('deleteUser'),

  activateUser: asyncHandler(async (req, res) => {
    const user = await UserService.activateUser(req.params.id, req.user, req, req.body?.notes);
    return successResponse(res, 200, 'User activated successfully', sanitizeUser(user));
  }),

  deactivateUser: asyncHandler(async (req, res) => {
    const user = await UserService.deactivateUser(req.params.id, req.user, req, req.body.reason);
    return successResponse(res, 200, 'User deactivated successfully', sanitizeUser(user));
  }),

  changeUserRole: asyncHandler(async (req, res) => {
    const user = await UserService.changeRole(req.params.id, req.body, req.user, req);
    return successResponse(res, 200, 'User role updated successfully', sanitizeUser(user));
  }),

  getUsersInMyTerritory: notImpl('getUsersInMyTerritory'),
};
