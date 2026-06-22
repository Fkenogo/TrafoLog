const mongoose = require('mongoose');

const syncQueueSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  operation_type: {
    type: String,
    enum: ['create', 'update', 'delete'],
    required: true
  },
  collection_name: {
    type: String,
    required: true
  },
  record_id: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'synced', 'failed', 'conflict'],
    default: 'pending'
  },
  attempts: {
    type: Number,
    default: 0
  },
  max_attempts: {
    type: Number,
    default: 5
  },
  error_message: String,
  synced_at: Date,
  last_attempt_at: Date
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
syncQueueSchema.index({ user_id: 1, status: 1 });
syncQueueSchema.index({ created_at: 1 });
syncQueueSchema.index({ status: 1, attempts: 1 });

module.exports = mongoose.model('SyncQueue', syncQueueSchema);