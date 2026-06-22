const mongoose = require('mongoose');

const exportJobSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  export_type: {
    type: String,
    enum: ['excel', 'pdf', 'csv'],
    required: true
  },
  data_type: {
    type: String,
    enum: ['transformers', 'inspections', 'faults', 'maintenance', 'all'],
    required: true
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued'
  },
  file_url: String,
  file_size: Number,
  error_message: String,
  started_at: Date,
  completed_at: Date,
  expires_at: Date
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
exportJobSchema.index({ user_id: 1, created_at: -1 });
exportJobSchema.index({ status: 1 });
exportJobSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ExportJob', exportJobSchema);