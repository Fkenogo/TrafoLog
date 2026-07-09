const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class CompressionService {
  async gzip(buffer) {
    return gzip(buffer);
  }

  async gunzip(buffer) {
    return gunzip(buffer);
  }
}

module.exports = new CompressionService();
