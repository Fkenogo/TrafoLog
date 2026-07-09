const crypto = require('crypto');

class ChecksumService {
  sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

module.exports = new ChecksumService();
