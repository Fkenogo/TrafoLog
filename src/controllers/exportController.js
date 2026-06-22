const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `ExportController.${name} not yet implemented` });

module.exports = {
  exportToCSV: notImpl('exportToCSV'),
  exportToExcel: notImpl('exportToExcel'),
  exportToPDF: notImpl('exportToPDF'),
  downloadExport: notImpl('downloadExport'),
};
