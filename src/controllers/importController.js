const ImportService = require('../services/importService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class ImportController {
  /**
   * Import transformers from file
   * POST /api/import/transformers
   */
  importTransformers = asyncHandler(async (req, res) => {
    if (!req.file) {
      return errorResponse(res, 400, 'No file uploaded');
    }

    const userId = req.user.id;
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const result = await ImportService.importTransformers(
      filePath,
      fileName,
      userId
    );

    return successResponse(res, 201, 'Import completed successfully', result);
  });

  /**
   * Download import template
   * GET /api/import/template
   */
  downloadTemplate = asyncHandler(async (req, res) => {
    const template = await ImportService.generateTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=transformer_import_template.xlsx');
    
    return res.send(template);
  });

  /**
   * Validate import file before processing
   * POST /api/import/validate
   */
  validateImport = asyncHandler(async (req, res) => {
    if (!req.file) {
      return errorResponse(res, 400, 'No file uploaded');
    }

    const filePath = req.file.path;

    const validationResult = await ImportService.validateImportFile(filePath);

    return successResponse(res, 200, 'Validation completed', validationResult);
  });

  /**
   * Get import history
   * GET /api/import/history
   */
  getImportHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const history = await ImportService.getImportHistory(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    return successResponse(res, 200, 'Import history retrieved successfully', history);
  });

  /**
   * Get import details
   * GET /api/import/history/:importId
   */
  getImportDetails = asyncHandler(async (req, res) => {
    const { importId } = req.params;

    const details = await ImportService.getImportDetails(importId);

    return successResponse(res, 200, 'Import details retrieved successfully', details);
  });

  /**
   * Get import errors
   * GET /api/import/errors/:importId
   */
  getImportErrors = asyncHandler(async (req, res) => {
    const { importId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const errors = await ImportService.getImportErrors(
      importId,
      parseInt(page),
      parseInt(limit)
    );

    return successResponse(res, 200, 'Import errors retrieved successfully', errors);
  });

  /**
   * Import inspections from file
   * POST /api/import/inspections
   */
  importInspections = asyncHandler(async (req, res) => {
    if (!req.file) {
      return errorResponse(res, 400, 'No file uploaded');
    }

    const userId = req.user.id;
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const result = await ImportService.importInspections(
      filePath,
      fileName,
      userId
    );

    return successResponse(res, 201, 'Import completed successfully', result);
  });

  /**
   * Download inspection import template
   * GET /api/import/template/inspections
   */
  downloadInspectionTemplate = asyncHandler(async (req, res) => {
    const template = await ImportService.generateInspectionTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inspection_import_template.xlsx');
    
    return res.send(template);
  });

  /**
   * Cancel import job
   * POST /api/import/:importId/cancel
   */
  cancelImport = asyncHandler(async (req, res) => {
    const { importId } = req.params;

    const result = await ImportService.cancelImport(importId);

    return successResponse(res, 200, 'Import cancelled successfully', result);
  });

  /**
   * Retry failed import
   * POST /api/import/:importId/retry
   */
  retryImport = asyncHandler(async (req, res) => {
    const { importId } = req.params;
    const userId = req.user.id;

    const result = await ImportService.retryImport(importId, userId);

    return successResponse(res, 200, 'Import retry started successfully', result);
  });

  /**
   * Get import statistics
   * GET /api/import/stats
   */
  getImportStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const stats = await ImportService.getImportStats(userId);

    return successResponse(res, 200, 'Import statistics retrieved successfully', stats);
  });
}

module.exports = new ImportController();