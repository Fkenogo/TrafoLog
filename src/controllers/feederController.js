const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `FeederController.${name} not yet implemented` });

module.exports = {
  getAll: notImpl('getAll'),
  getById: notImpl('getById'),
  create: notImpl('create'),
  update: notImpl('update'),
  delete: notImpl('delete'),
  getByServiceArea: notImpl('getByServiceArea'),
};
