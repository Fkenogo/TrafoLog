const ExportService = require('../services/exportService');
const { successResponse, asyncHandler } = require('../utils/helpers');
const { ApiError } = require('../utils/error');

const sendExport = async (req, res, format) => {
  const result = await ExportService.buildExport(
    req.body.report_type,
    req.body.filters || {},
    req.user.id,
    format
  );

  if (format === 'csv') {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.content);
  }

  return successResponse(res, 200, 'Export generated successfully', {
    metadata: result.metadata,
    rows: result.rows
  });
};

module.exports = {
  exportToCSV: asyncHandler(async (req, res) => sendExport(req, res, 'csv')),
  exportToJSON: asyncHandler(async (req, res) => sendExport(req, res, 'json')),
  exportToExcel: asyncHandler(async () => {
    throw new ApiError(501, 'Excel exports are not ready yet');
  }),
  exportToPDF: asyncHandler(async () => {
    throw new ApiError(501, 'PDF exports are not ready yet');
  }),
  downloadExport: asyncHandler(async () => {
    throw new ApiError(501, 'Export downloads are not ready yet');
  })
};
