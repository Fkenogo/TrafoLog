const mongoose = require('mongoose');

const importLogSchema = new mongoose.Schema({
  imported_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  file_name: {
    type: String,
    required: true
  },
  file_size: Number,
  total_rows: {
    type: Number,
    required: true
  },
  success_count: {
    type: Number,
    default: 0
  },
  skip_count: {
    type: Number,
    default: 0
  },
  error_count: {
    type: Number,
    default: 0
  },
  errors: [{
    row_number: Number,
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],
  import_type: {
    type: String,
    enum: ['transformers', 'inspections', 'maintenance'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  started_at: Date,
  completed_at: Date
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
importLogSchema.index({ imported_by: 1, created_at: -1 });
importLogSchema.index({ status: 1 });

module.exports = mongoose.model('ImportLog', importLogSchema);