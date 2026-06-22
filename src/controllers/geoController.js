const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `GeoController.${name} not yet implemented` });

module.exports = {
  findNearbyTransformers: notImpl('findNearbyTransformers'),
  getClusterData: notImpl('getClusterData'),
  geocode: notImpl('geocode'),
  reverseGeocode: notImpl('reverseGeocode'),
  getRoute: notImpl('getRoute'),
};
