const ReportingService = require('./reportingService');
const { ApiError } = require('../utils/error');

const reportGenerators = {
  transformers: ReportingService.generateTransformerReport.bind(ReportingService),
  inspections: ReportingService.generateInspectionReport.bind(ReportingService),
  faults: ReportingService.generateFaultReport.bind(ReportingService),
  maintenance: ReportingService.generateMaintenanceReport.bind(ReportingService),
  'asset-register': ReportingService.generateAssetRegister.bind(ReportingService)
};

const normalizeGeneratedAt = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeReport = (report, fallbackTitle) => ({
  success: true,
  data: Array.isArray(report?.data) ? report.data : [],
  summary: {
    title: report?.title || fallbackTitle,
    total: typeof report?.total === 'number' ? report.total : (Array.isArray(report?.data) ? report.data.length : 0)
  },
  filters: report?.filters || {},
  generated_at: normalizeGeneratedAt(report?.generatedAt)
});

const generateReport = async (reportType, filters, userId, format = 'json') => {
  const generator = reportGenerators[reportType];

  if (!generator) {
    throw new ApiError(400, 'Unsupported report type');
  }

  const report = await generator(filters, userId, format);
  if (format !== 'json') {
    return report;
  }

  return normalizeReport(report, `${reportType} report`);
};

const exportReport = async (reportType, filters, userId, format) => {
  const buffer = await generateReport(reportType, filters || {}, userId, format);

  return {
    success: true,
    report_type: reportType,
    format,
    status: 'completed',
    file_size: Buffer.isBuffer(buffer) ? buffer.length : 0,
    generated_at: new Date().toISOString()
  };
};

module.exports = {
  generateTransformerReport: (filters, userId, format) => generateReport('transformers', filters, userId, format),
  generateInspectionReport: (filters, userId, format) => generateReport('inspections', filters, userId, format),
  generateFaultReport: (filters, userId, format) => generateReport('faults', filters, userId, format),
  generateMaintenanceReport: (filters, userId, format) => generateReport('maintenance', filters, userId, format),
  generateAssetRegister: (filters, userId, format) => generateReport('asset-register', filters, userId, format),
  exportToExcel: (reportType, filters, userId) => exportReport(reportType, filters, userId, 'excel'),
  exportToPDF: (reportType, filters, userId) => exportReport(reportType, filters, userId, 'pdf'),
  getExportStatus: (exportId, userId) => ReportingService.getExportStatus(exportId, userId),
  downloadExport: (exportId, userId) => ReportingService.downloadExport(exportId, userId),
  getReportTemplates: () => ReportingService.getReportTemplates(),
  generateCustomReport: (data) => ReportingService.generateCustomReport(data),
  saveTemplate: (data) => ReportingService.saveTemplate(data),
  deleteTemplate: (templateId, userId) => ReportingService.deleteTemplate(templateId, userId),
  scheduleReport: (data) => ReportingService.scheduleReport(data),
  getScheduledReports: (userId) => ReportingService.getScheduledReports(userId),
  cancelSchedule: (scheduleId, userId) => ReportingService.cancelSchedule(scheduleId, userId)
};
