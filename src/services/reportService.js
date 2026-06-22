const notImpl = (name) => async () => {
  throw new Error(`ReportService.${name} not yet implemented`);
};

module.exports = {
  generateTransformerReport: notImpl('generateTransformerReport'),
  generateInspectionReport: notImpl('generateInspectionReport'),
  generateFaultReport: notImpl('generateFaultReport'),
  generateMaintenanceReport: notImpl('generateMaintenanceReport'),
  generateAssetRegister: notImpl('generateAssetRegister'),
  generateCustomReport: notImpl('generateCustomReport'),
  exportToExcel: notImpl('exportToExcel'),
  exportToPDF: notImpl('exportToPDF'),
  getExportStatus: notImpl('getExportStatus'),
  downloadExport: notImpl('downloadExport'),
  scheduleReport: notImpl('scheduleReport'),
  getScheduledReports: notImpl('getScheduledReports'),
  cancelSchedule: notImpl('cancelSchedule'),
  saveTemplate: notImpl('saveTemplate'),
  getReportTemplates: notImpl('getReportTemplates'),
  deleteTemplate: notImpl('deleteTemplate'),
};
