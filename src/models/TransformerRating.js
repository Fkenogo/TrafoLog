const mongoose = require('mongoose');

const transformerRatingSchema = new mongoose.Schema({
  kva: {
    type: Number,
    required: true,
    enum: [50, 100, 160, 200, 250, 315, 500, 630, 1000]
  },
  network_voltage_kv: {
    type: Number,
    required: true,
    enum: [11, 33]
  },
  display_label: {
    type: String,
    required: true
  },
  is_standard: {
    type: Boolean,
    default: true
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

// Unique compound index
transformerRatingSchema.index(
  { kva: 1, network_voltage_kv: 1 },
  { unique: true }
);

// Pre-save middleware
transformerRatingSchema.pre('save', function(next) {
  this.display_label = `${this.kva}kVA/${this.network_voltage_kv}kV`;
});

module.exports = mongoose.model('TransformerRating', transformerRatingSchema);