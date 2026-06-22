const notImpl = (name) => async (req, res) =>
  res.status(501).json({ success: false, message: `QRController.${name} not yet implemented` });

module.exports = {
  generateTransformerQR: notImpl('generateTransformerQR'),
  generateBulkQR: notImpl('generateBulkQR'),
  downloadQR: notImpl('downloadQR'),
  processQRScan: notImpl('processQRScan'),
};
