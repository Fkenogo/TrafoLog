const mongoose = require('mongoose');

const serviceAreaSchema = new mongoose.Schema({
  territory_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Territory',
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
  location_town: String,
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
serviceAreaSchema.index({ territory_id: 1, name: 1 });

module.exports = mongoose.model('ServiceArea', serviceAreaSchema);