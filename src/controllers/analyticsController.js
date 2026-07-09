const AnalyticsService = require('../services/analyticsService');
const { asyncHandler, successResponse } = require('../utils/helpers');

module.exports = {
  getTransformerAnalytics: asyncHandler(async (req, res) => {
    const data = await AnalyticsService.getTransformerAnalytics(req.query);
    return successResponse(res, 200, 'Transformer analytics generated successfully', data);
  }),
  getFaultAnalytics: asyncHandler(async (req, res) => {
    const data = await AnalyticsService.getFaultAnalytics(req.query);
    return successResponse(res, 200, 'Fault analytics generated successfully', data);
  }),
  getMaintenanceAnalytics: asyncHandler(async (req, res) => {
    const data = await AnalyticsService.getMaintenanceAnalytics(req.query);
    return successResponse(res, 200, 'Maintenance analytics generated successfully', data);
  }),
  getPredictiveAnalytics: asyncHandler(async (req, res) => {
    const data = await AnalyticsService.getPredictiveAnalytics(req.query);
    return successResponse(res, 200, 'Rule-based risk analytics generated successfully', data);
  }),
};
