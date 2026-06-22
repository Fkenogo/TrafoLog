const cron = require('node-cron');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const NotificationService = require('../services/notificationService');

class OverloadDetector {
  start() {
    // Run every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running overload detection...');
      await this.detectOverloads();
    });
  }
  
  async detectOverloads() {
    try {
      // Get latest inspections for all transformers
      const latestInspections = await Inspection.aggregate([
        {
          $sort: { transformer_id: 1, inspection_date: -1 }
        },
        {
          $group: {
            _id: '$transformer_id',
            latest: { $first: '$$ROOT' }
          }
        }
      ]);
      
      for (const item of latestInspections) {
        const inspection = item.latest;
        if (inspection.electrical?.overload_flag) {
          // Notify manager
          const transformer = await Transformer.findById(inspection.transformer_id);
          await NotificationService.sendOverloadAlert(transformer, inspection);
        }
      }
    } catch (error) {
      console.error('Error detecting overloads:', error);
    }
  }
}

module.exports = new OverloadDetector();