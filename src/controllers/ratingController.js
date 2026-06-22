const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `RatingController.${name} not yet implemented` });

module.exports = {
  getAll: notImpl('getAll'),
  create: notImpl('create'),
  update: notImpl('update'),
  delete: notImpl('delete'),
  getByNetworkVoltage: notImpl('getByNetworkVoltage'),
};
