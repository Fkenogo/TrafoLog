const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `TerritoryController.${name} not yet implemented` });

module.exports = {
  getAll: notImpl('getAll'),
  getById: notImpl('getById'),
  create: notImpl('create'),
  update: notImpl('update'),
  delete: notImpl('delete'),
};
