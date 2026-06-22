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
  SyncQueue
};

// Export mongoose instance for connection
module.exports.mongoose = mongoose;