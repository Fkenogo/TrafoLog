const mongoose = require('mongoose');

const feederSchema = new mongoose.Schema({
  service_area_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceArea',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true
  },
  network_voltage_kv: {
    type: Number,
    enum: [11, 33],
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
feederSchema.index({ service_area_id: 1, code: 1 });

module.exports = mongoose.model('Feeder', feederSchema);