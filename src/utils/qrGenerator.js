const QRCode = require('qrcode');

class QRGenerator {
  generate(data) {
    // Generate QR code as data URL
    return new Promise((resolve, reject) => {
      QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        width: 300
      }, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      });
    });
  }
  
  async generateForTransformer(transformer) {
    const data = JSON.stringify({
      id: transformer.asset_id,
      url: `${process.env.APP_URL}/assets/${transformer.asset_id}`
    });
    
    return await this.generate(data);
  }
}

module.exports = new QRGenerator();