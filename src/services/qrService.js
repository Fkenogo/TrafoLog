const QRCode = require('qrcode');
const QRCodeModel = require('../models/QRCode');
const Transformer = require('../models/Transformer');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class QRService {
  /**
   * Generate QR code for transformer
   */
  async generateQR(transformerId, userId) {
    try {
      const transformer = await Transformer.findById(transformerId);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Check if QR code already exists
      let qrCode = await QRCodeModel.findOne({ transformer_id: transformerId });
      
      if (qrCode) {
        // Update existing QR
        const qrData = this.prepareQRData(transformer);
        const qrImage = await this.generateQRImage(qrData);
        
        qrCode.qr_code_string = JSON.stringify(qrData);
        qrCode.qr_code_image = qrImage;
        qrCode.status = 'active';
        qrCode.generated_by = userId;
        qrCode.generated_at = new Date();
        qrCode.version += 1;
        await qrCode.save();
      } else {
        // Create new QR
        const qrData = this.prepareQRData(transformer);
        const qrImage = await this.generateQRImage(qrData);
        
        qrCode = new QRCodeModel({
          transformer_id: transformerId,
          qr_code_string: JSON.stringify(qrData),
          qr_code_image: qrImage,
          generated_by: userId,
          version: 1,
          status: 'active'
        });
        await qrCode.save();
      }

      return qrCode;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error generating QR code:', error);
      throw new ApiError(500, 'Failed to generate QR code');
    }
  }

  /**
   * Prepare QR data
   */
  prepareQRData(transformer) {
    return {
      id: transformer.asset_id,
      rating: transformer.display_rating,
      site: transformer.location_administrative?.site_name || 'Unknown',
      territory: transformer.location_operational?.territory_name || 'Unknown',
      url: `${process.env.APP_URL}/assets/${transformer.asset_id}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate QR image
   */
  async generateQRImage(data) {
    try {
      const options = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 2,
        width: 300,
        color: {
          dark: '#1a3c6e',
          light: '#ffffff'
        }
      };

      const qrData = typeof data === 'string' ? data : JSON.stringify(data);
      return await QRCode.toDataURL(qrData, options);
    } catch (error) {
      logger.error('Error generating QR image:', error);
      throw error;
    }
  }

  /**
   * Get QR code for transformer
   */
  async getQRCode(transformerId) {
    try {
      const qrCode = await QRCodeModel.findOne({
        transformer_id: transformerId,
        status: 'active'
      });

      if (!qrCode) {
        throw new ApiError(404, 'QR code not found');
      }

      return qrCode;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting QR code:', error);
      throw new ApiError(500, 'Failed to get QR code');
    }
  }

  /**
   * Process QR code scan
   */
  async processQRScan(qrString, userId, location = null, deviceInfo = null) {
    try {
      // Parse QR data
      let qrData;
      try {
        qrData = typeof qrString === 'string' ? JSON.parse(qrString) : qrString;
      } catch (e) {
        // If not JSON, treat as asset ID
        qrData = { id: qrString };
      }

      // Find transformer by asset_id
      const transformer = await Transformer.findOne({
        asset_id: qrData.id || qrString
      });

      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Find QR code
      const qrCode = await QRCodeModel.findOne({
        transformer_id: transformer._id
      });

      if (!qrCode) {
        throw new ApiError(404, 'QR code not found');
      }

      // Record scan
      await qrCode.scan(userId, location, deviceInfo);

      return {
        transformer,
        scanInfo: {
          scannedAt: new Date(),
          scannedBy: userId,
          location,
          deviceInfo
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error processing QR scan:', error);
      throw new ApiError(500, 'Failed to process QR scan');
    }
  }

  /**
   * Generate bulk QR codes
   */
  async generateBulkQR(transformerIds, userId) {
    try {
      const results = {
        success: [],
        failed: []
      };

      for (const transformerId of transformerIds) {
        try {
          const qrCode = await this.generateQR(transformerId, userId);
          results.success.push({
            transformerId,
            qrCodeId: qrCode._id
          });
        } catch (error) {
          results.failed.push({
            transformerId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error generating bulk QR codes:', error);
      throw new ApiError(500, 'Failed to generate bulk QR codes');
    }
  }

  /**
   * Download QR code
   */
  async downloadQR(transformerId) {
    try {
      const qrCode = await this.getQRCode(transformerId);
      
      // Remove data URL prefix to get raw image data
      const imageData = qrCode.qr_code_image.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(imageData, 'base64');

      return {
        buffer,
        filename: `qr_${transformerId}_${Date.now()}.png`,
        mimeType: 'image/png'
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error downloading QR code:', error);
      throw new ApiError(500, 'Failed to download QR code');
    }
  }

  /**
   * Get QR code statistics
   */
  async getQRStats(transformerId = null) {
    try {
      const query = {};
      if (transformerId) {
        query.transformer_id = transformerId;
      }

      const stats = {
        total: await QRCodeModel.countDocuments(query),
        active: await QRCodeModel.countDocuments({ ...query, status: 'active' }),
        inactive: await QRCodeModel.countDocuments({ ...query, status: 'inactive' }),
        expired: await QRCodeModel.countDocuments({ ...query, status: 'expired' })
      };

      // Get total scans
      const scanStats = await QRCodeModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalScans: { $sum: '$scan_count' },
            avgScans: { $avg: '$scan_count' }
          }
        }
      ]);

      // Get top scanned
      const topScanned = await QRCodeModel.find(query)
        .sort({ scan_count: -1 })
        .limit(10)
        .populate('transformer_id', 'asset_id display_rating');

      return {
        ...stats,
        ...(scanStats[0] || { totalScans: 0, avgScans: 0 }),
        topScanned
      };
    } catch (error) {
      logger.error('Error getting QR stats:', error);
      throw new ApiError(500, 'Failed to get QR statistics');
    }
  }

  /**
   * Deactivate QR code
   */
  async deactivateQR(transformerId, userId) {
    try {
      const qrCode = await QRCodeModel.findOne({
        transformer_id: transformerId,
        status: 'active'
      });

      if (!qrCode) {
        throw new ApiError(404, 'Active QR code not found');
      }

      qrCode.status = 'inactive';
      qrCode.deactivated_at = new Date();
      qrCode.deactivated_by = userId;
      await qrCode.save();

      return qrCode;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error deactivating QR code:', error);
      throw new ApiError(500, 'Failed to deactivate QR code');
    }
  }

  /**
   * Validate QR code
   */
  async validateQR(qrString) {
    try {
      let qrData;
      try {
        qrData = typeof qrString === 'string' ? JSON.parse(qrString) : qrString;
      } catch (e) {
        qrData = { id: qrString };
      }

      const transformer = await Transformer.findOne({
        asset_id: qrData.id || qrString
      });

      if (!transformer) {
        return { valid: false, error: 'Transformer not found' };
      }

      const qrCode = await QRCodeModel.findOne({
        transformer_id: transformer._id,
        status: 'active'
      });

      if (!qrCode) {
        return { valid: false, error: 'QR code not active' };
      }

      if (qrCode.isExpired()) {
        return { valid: false, error: 'QR code expired' };
      }

      return {
        valid: true,
        transformer,
        qrCode
      };
    } catch (error) {
      logger.error('Error validating QR code:', error);
      return { valid: false, error: 'Invalid QR code' };
    }
  }

  /**
   * Generate QR code image only (without saving)
   */
  async generateQRImageOnly(data) {
    try {
      const options = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 2,
        width: 200
      };

      return await QRCode.toDataURL(data, options);
    } catch (error) {
      logger.error('Error generating QR image:', error);
      throw error;
    }
  }

  /**
   * Generate SVG QR code
   */
  async generateSVGQR(data) {
    try {
      const options = {
        errorCorrectionLevel: 'H',
        type: 'svg',
        margin: 2,
        color: {
          dark: '#1a3c6e',
          light: '#ffffff'
        }
      };

      return await QRCode.toString(data, options);
    } catch (error) {
      logger.error('Error generating SVG QR:', error);
      throw error;
    }
  }
}

module.exports = new QRService();