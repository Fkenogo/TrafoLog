const ReportService = require('../services/reportService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class ReportController {
  /**
   * Generate transformer report
   * GET /api/reports/transformers
   */
  generateTransformerReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { 
      format = 'json',
      startDate,
      endDate,
      territory_id,
      service_area_id,
      network_voltage_kv,
      status,
      district_id
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      network_voltage_kv: network_voltage_kv ? parseInt(network_voltage_kv) : undefined,
      status,
      district_id
    };

    // Apply territory filter based on user role
    if (userRole !== 'Super Admin' && territoryId) {
      filters.territory_id = territoryId;
    } else if (territory_id) {
      filters.territory_id = territory_id;
    }

    if (service_area_id) {
      filters.service_area_id = service_area_id;
    }

    const report = await ReportService.generateTransformerReport(
      filters,
      userId,
      format
    );

    if (format === 'pdf' || format === 'excel') {
      return res.send(report);
    }

    return successResponse(res, 200, 'Report generated successfully', report);
  });

  /**
   * Generate inspection report
   * GET /api/reports/inspections
   */
  generateInspectionReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { 
      format = 'json',
      startDate,
      endDate,
      territory_id,
      service_area_id,
      transformer_id,
      condition
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      transformer_id,
      condition
    };

    if (userRole !== 'Super Admin' && territoryId) {
      filters.territory_id = territoryId;
    } else if (territory_id) {
      filters.territory_id = territory_id;
    }

    if (service_area_id) {
      filters.service_area_id = service_area_id;
    }

    const report = await ReportService.generateInspectionReport(
      filters,
      userId,
      format
    );

    if (format === 'pdf' || format === 'excel') {
      return res.send(report);
    }

    return successResponse(res, 200, 'Report generated successfully', report);
  });

  /**
   * Generate fault report
   * GET /api/reports/faults
   */
  generateFaultReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { 
      format = 'json',
      startDate,
      endDate,
      territory_id,
      service_area_id,
      severity,
      fault_type,
      status
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      severity,
      fault_type,
      status
    };

    if (userRole !== 'Super Admin' && territoryId) {
      filters.territory_id = territoryId;
    } else if (territory_id) {
      filters.territory_id = territory_id;
    }

    if (service_area_id) {
      filters.service_area_id = service_area_id;
    }

    const report = await ReportService.generateFaultReport(
      filters,
      userId,
      format
    );

    if (format === 'pdf' || format === 'excel') {
      return res.send(report);
    }

    return successResponse(res, 200, 'Report generated successfully', report);
  });

  /**
   * Generate maintenance report
   * GET /api/reports/maintenance
   */
  generateMaintenanceReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { 
      format = 'json',
      startDate,
      endDate,
      territory_id,
      service_area_id,
      maintenance_type
    } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      maintenance_type
    };

    if (userRole !== 'Super Admin' && territoryId) {
      filters.territory_id = territoryId;
    } else if (territory_id) {
      filters.territory_id = territory_id;
    }

    if (service_area_id) {
      filters.service_area_id = service_area_id;
    }

    const report = await ReportService.generateMaintenanceReport(
      filters,
      userId,
      format
    );

    if (format === 'pdf' || format === 'excel') {
      return res.send(report);
    }

    return successResponse(res, 200, 'Report generated successfully', report);
  });

  /**
   * Generate asset register
   * GET /api/reports/asset-register
   */
  generateAssetRegister = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;
    const { format = 'excel', territory_id } = req.query;

    const filters = {};
    if (userRole !== 'Super Admin' && territoryId) {
      filters.territory_id = territoryId;
    } else if (territory_id) {
      filters.territory_id = territory_id;
    }

    const report = await ReportService.generateAssetRegister(
      filters,
      userId,
      format
    );

    if (format === 'pdf') {
      return res.send(report);
    }

    return successResponse(res, 200, 'Asset register generated successfully', report);
  });

  /**
   * Export report to Excel
   * POST /api/reports/export/excel
   */
  exportToExcel = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { report_type, filters } = req.body;

    const result = await ReportService.exportToExcel(
      report_type,
      filters,
      userId
    );

    return successResponse(res, 200, 'Export started successfully', result);
  });

  /**
   * Export report to PDF
   * POST /api/reports/export/pdf
   */
  exportToPDF = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { report_type, filters } = req.body;

    const result = await ReportService.exportToPDF(
      report_type,
      filters,
      userId
    );

    return successResponse(res, 200, 'Export started successfully', result);
  });

  /**
   * Get export status
   * GET /api/reports/exports/:exportId
   */
  getExportStatus = asyncHandler(async (req, res) => {
    const { exportId } = req.params;
    const userId = req.user.id;

    const status = await ReportService.getExportStatus(exportId, userId);

    return successResponse(res, 200, 'Export status retrieved successfully', status);
  });

  /**
   * Download export file
   * GET /api/reports/exports/:exportId/download
   */
  downloadExport = asyncHandler(async (req, res) => {
    const { exportId } = req.params;
    const userId = req.user.id;

    const file = await ReportService.downloadExport(exportId, userId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${file.filename}`);
    return res.send(file.data);
  });

  /**
   * Get available report types
   * GET /api/reports/types
   */
  getReportTypes = asyncHandler(async (req, res) => {
    const types = [
      { value: 'transformers', label: 'Transformer Report' },
      { value: 'inspections', label: 'Inspection Report' },
      { value: 'faults', label: 'Fault Report' },
      { value: 'maintenance', label: 'Maintenance Report' },
      { value: 'asset-register', label: 'Asset Register' },
      { value: 'custom', label: 'Custom Report' }
    ];

    return successResponse(res, 200, 'Report types retrieved successfully', types);
  });

  /**
   * Get report templates
   * GET /api/reports/templates
   */
  getTemplates = asyncHandler(async (req, res) => {
    const templates = await ReportService.getReportTemplates();

    return successResponse(res, 200, 'Report templates retrieved successfully', templates);
  });

  /**
   * Generate custom report
   * POST /api/reports/custom
   */
  generateCustomReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { 
      name, 
      data_source, 
      fields, 
      filters, 
      grouping, 
      sorting,
      format = 'json' 
    } = req.body;

    const report = await ReportService.generateCustomReport({
      name,
      data_source,
      fields,
      filters,
      grouping,
      sorting,
      format,
      user_id: userId
    });

    if (format === 'pdf' || format === 'excel') {
      return res.send(report);
    }

    return successResponse(res, 200, 'Custom report generated successfully', report);
  });

  /**
   * Save report template
   * POST /api/reports/templates
   */
  saveTemplate = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, data_source, fields, filters, grouping, sorting } = req.body;

    const template = await ReportService.saveTemplate({
      name,
      data_source,
      fields,
      filters,
      grouping,
      sorting,
      user_id: userId
    });

    return successResponse(res, 201, 'Report template saved successfully', template);
  });

  /**
   * Delete report template
   * DELETE /api/reports/templates/:templateId
   */
  deleteTemplate = asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const userId = req.user.id;

    const result = await ReportService.deleteTemplate(templateId, userId);

    return successResponse(res, 200, 'Report template deleted successfully', result);
  });

  /**
   * Schedule report
   * POST /api/reports/schedule
   */
  scheduleReport = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { 
      name, 
      report_type, 
      filters, 
      frequency, 
      recipients,
      format = 'pdf' 
    } = req.body;

    const schedule = await ReportService.scheduleReport({
      name,
      report_type,
      filters,
      frequency,
      recipients,
      format,
      user_id: userId
    });

    return successResponse(res, 201, 'Report scheduled successfully', schedule);
  });

  /**
   * Get scheduled reports
   * GET /api/reports/scheduled
   */
  getScheduledReports = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const schedules = await ReportService.getScheduledReports(userId);

    return successResponse(res, 200, 'Scheduled reports retrieved successfully', schedules);
  });

  /**
   * Cancel scheduled report
   * DELETE /api/reports/schedule/:scheduleId
   */
  cancelSchedule = asyncHandler(async (req, res) => {
    const { scheduleId } = req.params;
    const userId = req.user.id;

    const result = await ReportService.cancelSchedule(scheduleId, userId);

    return successResponse(res, 200, 'Schedule cancelled successfully', result);
  });
}

module.exports = new ReportController();