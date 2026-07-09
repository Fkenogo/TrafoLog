const mongoose = require('mongoose');

const maintenanceModeSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'global',
    unique: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: false,
    index: true
  },
  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Maintenance message cannot exceed 500 characters'],
    default: 'System is under maintenance'
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Maintenance reason cannot exceed 500 characters']
  },
  enabled_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  enabled_at: Date,
  disabled_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  disabled_at: Date
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

maintenanceModeSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('MaintenanceMode', maintenanceModeSchema);
