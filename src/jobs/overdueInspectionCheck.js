const cron = require('node-cron');
const Transformer = require('../models/Transformer');
const NotificationService = require('../services/notificationService');

class OverdueInspectionChecker {
  start() {
    // Run daily at midnight
    cron.schedule('0 0 * * *', async () => {
      console.log('Running overdue inspection check...');
      await this.checkOverdueInspections();
    });
  }
  
  async checkOverdueInspections() {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const oneHundredEightyDaysAgo = new Date();
    oneHundredEightyDaysAgo.setDate(oneHundredEightyDaysAgo.getDate() - 180);
    
    try {
      // Find transformers not inspected in 90+ days
      const overdue90Days = await Transformer.find({
        operational_status: 'Active',
        $or: [
          { last_inspection_date: { $lt: ninetyDaysAgo } },
          { last_inspection_date: { $exists: false } }
        ]
      }).populate('location_operational.territory_id');
      
      // Find transformers not inspected in 180+ days (urgent)
      const overdue180Days = await Transformer.find({
        operational_status: 'Active',
        $or: [
          { last_inspection_date: { $lt: oneHundredEightyDaysAgo } },
          { last_inspection_date: { $exists: false } }
        ]
      }).populate('location_operational.territory_id');
      
      // Send notifications for each territory
      for (const transformer of overdue90Days) {
        if (overdue180Days.some(t => t._id.equals(transformer._id))) {
          // This is an urgent notification (180+ days)
          await NotificationService.sendOverdueInspectionAlert(
            transformer,
            'urgent'
          );
        } else {
          // Standard notification (90+ days)
          await NotificationService.sendOverdueInspectionAlert(
            transformer,
            'normal'
          );
        }
        
        // Update transformer flag
        await Transformer.findByIdAndUpdate(transformer._id, {
          overdue_inspection_flag: true
        });
      }
      
      console.log(`Checked ${overdue90Days.length} overdue transformers`);
    } catch (error) {
      console.error('Error checking overdue inspections:', error);
    }
  }
}

module.exports = new OverdueInspectionChecker();