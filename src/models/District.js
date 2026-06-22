const mongoose = require('mongoose');

const districtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true
  },
  region: {
    type: String,
    enum: ['Central', 'Eastern', 'Northern', 'Western'],
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
districtSchema.index({ name: 1 });
districtSchema.index({ region: 1 });

module.exports = mongoose.model('District', districtSchema);