const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `AnalyticsController.${name} not yet implemented` });

module.exports = {
  getTransformerAnalytics: notImpl('getTransformerAnalytics'),
  getFaultAnalytics: notImpl('getFaultAnalytics'),
  getMaintenanceAnalytics: notImpl('getMaintenanceAnalytics'),
  getPredictiveAnalytics: notImpl('getPredictiveAnalytics'),
};
