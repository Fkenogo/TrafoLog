const mongoose = require('mongoose');

const backupJobSchema = new mongoose.Schema({
  backup_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  filename: {
    type: String,
    required: true,
    trim: true
  },
  storage_key: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'],
    default: 'QUEUED',
    index: true
  },
  operation_type: {
    type: String,
    enum: ['BACKUP', 'RESTORE'],
    default: 'BACKUP',
    index: true
  },
  started_at: Date,
  completed_at: Date,
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  checksum: {
    type: String,
    trim: true
  },
  compression: {
    type: String,
    enum: ['none', 'gzip'],
    default: 'gzip'
  },
  encryption: {
    type: Boolean,
    default: false
  },
  size_bytes: {
    type: Number,
    min: 0,
    default: 0
  },
  collections: [{
    name: String,
    document_count: Number
  }],
  schema_version: {
    type: String,
    default: '1.0'
  },
  app_version: {
    type: String,
    default: 'unknown'
  },
  retention_until: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  manifest: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error_message: {
    type: String,
    trim: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

backupJobSchema.index({ status: 1, created_at: -1 });
backupJobSchema.index({ operation_type: 1, status: 1 });
backupJobSchema.index({ created_by: 1, created_at: -1 });
backupJobSchema.index({ retention_until: 1 });

backupJobSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('BackupJob', backupJobSchema);
