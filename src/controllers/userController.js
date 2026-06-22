const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `UserController.${name} not yet implemented` });

module.exports = {
  getAllUsers: notImpl('getAllUsers'),
  getUserById: notImpl('getUserById'),
  createUser: notImpl('createUser'),
  updateUser: notImpl('updateUser'),
  deleteUser: notImpl('deleteUser'),
  activateUser: notImpl('activateUser'),
  deactivateUser: notImpl('deactivateUser'),
  changeUserRole: notImpl('changeUserRole'),
  getUsersInMyTerritory: notImpl('getUsersInMyTerritory'),
};
