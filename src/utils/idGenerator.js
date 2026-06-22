const Transformer = require('../models/Transformer');

class IdGenerator {
  async generateAssetId() {
    // Get the last transformer
    const lastTransformer = await Transformer.findOne()
      .sort({ asset_id: -1 })
      .select('asset_id');
    
    let nextNumber = 1;
    
    if (lastTransformer && lastTransformer.asset_id) {
      const match = lastTransformer.asset_id.match(/TRF-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    return `TRF-${String(nextNumber).padStart(6, '0')}`;
  }
  
  async generateBulkAssetIds(count) {
    const lastTransformer = await Transformer.findOne()
      .sort({ asset_id: -1 })
      .select('asset_id');
    
    let startNumber = 1;
    if (lastTransformer && lastTransformer.asset_id) {
      const match = lastTransformer.asset_id.match(/TRF-(\d+)/);
      if (match) {
        startNumber = parseInt(match[1]) + 1;
      }
    }
    
    const ids = [];
    for (let i = 0; i < count; i++) {
      ids.push(`TRF-${String(startNumber + i).padStart(6, '0')}`);
    }
    
    return ids;
  }
}

module.exports = new IdGenerator();