const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `DistrictController.${name} not yet implemented` });

module.exports = {
  getAll: notImpl('getAll'),
  getById: notImpl('getById'),
  getByRegion: notImpl('getByRegion'),
};
