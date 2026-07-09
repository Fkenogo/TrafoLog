const mongoose = require('mongoose');

// Import all models
const User = require('./User');
const Transformer = require('./Transformer');
const Inspection = require('./Inspection');
const Maintenance = require('./Maintenance');
const Fault = require('./Fault');
const Installation = require('./Installation');
const AssetTimeline = require('./AssetTimeline');
const AssetPhoto = require('./AssetPhoto');
const QRCode = require('./QRCode');
const Notification = require('./Notification');
const AuditLog = require('./AuditLog');
const ImportLog = require('./ImportLog');
const RefreshToken = require('./RefreshToken');
const Session = require('./Session');
const Territory = require('./Territory');
const ServiceArea = require('./ServiceArea');
const Feeder = require('./Feeder');
const District = require('./District');
const TransformerRating = require('./TransformerRating');
const ExportJob = require('./ExportJob');
const SyncQueue = require('./SyncQueue');
const MaintenanceMode = require('./MaintenanceMode');
const BackupJob = require('./BackupJob');

// 1. Export all models as the primary object
module.exports = {
  User,
  Transformer,
  Inspection,
  Maintenance,
  Fault,
  Installation,
  AssetTimeline,
  AssetPhoto,
  QRCode,
  Notification,
  AuditLog,
  ImportLog,
  RefreshToken,
  Session,
  Territory,
  ServiceArea,
  Feeder,
  District,
  TransformerRating,
  ExportJob,
  SyncQueue,
  MaintenanceMode,
  BackupJob
};

// 2. Export mongoose instance for connection management
module.exports.mongoose = mongoose;

// 3. Function to safely initialize all models and build indexes
module.exports.initModels = async function() {
  try {
    // Get all exports and filter out non-model utilities (like mongoose and this function)
    const models = Object.values(module.exports).filter(
      item => item && typeof item === 'function' && item.prototype instanceof mongoose.Model
    );
    
    console.log(`⏳ Starting index creation for ${models.length} models...`);

    for (const model of models) {
      if (model.schema && model.schema.indexes().length > 0) {
        await model.createIndexes();
        console.log(`✓ Indexes verified/created for: ${model.modelName}`);
      }
    }
    console.log('✅ All model indexes synchronized successfully.');
  } catch (error) {
    console.error('❌ Error during model index initialization:', error);
    throw error;
  }
};
