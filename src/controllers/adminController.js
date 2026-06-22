const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `AdminController.${name} not yet implemented` });

module.exports = {
  getSystemStats: notImpl('getSystemStats'),
  getAllUsers: notImpl('getAllUsers'),
  getAuditLogs: notImpl('getAuditLogs'),
  triggerBackup: notImpl('triggerBackup'),
  restoreFromBackup: notImpl('restoreFromBackup'),
  getBackupHistory: notImpl('getBackupHistory'),
  toggleMaintenanceMode: notImpl('toggleMaintenanceMode'),
};
