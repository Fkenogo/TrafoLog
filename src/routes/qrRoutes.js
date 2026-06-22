const express = require('express');
const router = express.Router();
const QRController = require('../controllers/qrController');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /api/qr/transformer/:transformerId
 * @desc Generate QR code for transformer
 * @access Private
 */
router.get(
  '/transformer/:transformerId',
  authenticate,
  QRController.generateTransformerQR
);

/**
 * @route POST /api/qr/scan
 * @desc Process QR code scan
 * @access Private
 */
router.post(
  '/scan',
  authenticate,
  QRController.processQRScan
);

/**
 * @route GET /api/qr/bulk
 * @desc Generate QR codes for multiple transformers
 * @access Private
 */
router.get(
  '/bulk',
  authenticate,
  QRController.generateBulkQR
);

/**
 * @route GET /api/qr/download/:transformerId
 * @desc Download QR code as image
 * @access Private
 */
router.get(
  '/download/:transformerId',
  authenticate,
  QRController.downloadQR
);

module.exports = router;