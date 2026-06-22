const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `AuditController.${name} not yet implemented` });

module.exports = {
  getAuditLogs: notImpl('getAuditLogs'),
  getUserAuditLogs: notImpl('getUserAuditLogs'),
  getTransformerAuditLogs: notImpl('getTransformerAuditLogs'),
  getAuditActions: notImpl('getAuditActions'),
};
