const mongoose = require('mongoose');

const installationSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: [true, 'Transformer ID is required'],
    index: true
  },
  
  // Installation Details
  installation_date: {
    type: Date,
    required: [true, 'Installation date is required'],
    default: Date.now,
    index: true
  },
  installation_type: {
    type: String,
    enum: ['New Installation', 'Replacement', 'Relocation'],
    required: [true, 'Installation type is required']
  },
  previous_transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer'
  },
  replacement_reason: {
    type: String,
    enum: ['Overload', 'Failure', 'Upgrade', 'Load Split', 'Other'],
    required: function() {
      return this.installation_type === 'Replacement';
    }
  },
  replacement_reason_details: {
    type: String,
    trim: true
  },
  
  // Network Details
  network_voltage_kv: {
    type: Number,
    enum: [11, 33],
    required: [true, 'Network voltage is required']
  },
  kva_rating: {
    type: Number,
    required: [true, 'kVA rating is required'],
    enum: [50, 100, 160, 200, 250, 315, 500, 630, 1000]
  },
  
  // Location Details
  previous_location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: [Number]
  },
  previous_site_name: {
    type: String,
    trim: true
  },
  
  // Team Details
  installing_team: {
    type: String,
    required: [true, 'Installing team is required'],
    trim: true
  },
  supervised_by: {
    type: String,
    trim: true
  },
  
  // Source
  transformer_source: {
    type: String,
    enum: ['New Purchase', 'Refurbished', 'Transferred from Store'],
    default: 'New Purchase'
  },
  source_reference: {
    type: String,
    trim: true
  },
  
  // Testing & Commissioning
  pre_install_test_results: {
    type: String,
    trim: true
  },
  commissioning_readings: {
    type: String,
    trim: true
  },
  commissioned_by: {
    type: String,
    trim: true
  },
  handover_date: {
    type: Date
  },
  test_report_url: {
    type: String,
    trim: true
  },
  
  // Photos
  photos_before: [{
    type: String,
    trim: true
  }],
  photos_during: [{
    type: String,
    trim: true
  }],
  photos_after: [{
    type: String,
    trim: true
  }],
  
  // Notes
  installation_notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Installation notes cannot exceed 2000 characters']
  },
  challenges_encountered: {
    type: String,
    trim: true
  },
  
  // Sync tracking
  sync_status: {
    type: String,
    enum: ['synced', 'pending', 'conflict'],
    default: 'synced'
  },
  sync_version: {
    type: Number,
    default: 1
  },
  
  // Soft delete
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: Date,
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
installationSchema.index({ transformer_id: 1, installation_date: -1 });
installationSchema.index({ previous_transformer_id: 1 });
installationSchema.index({ installation_type: 1 });
installationSchema.index({ sync_status: 1 });
installationSchema.index({ installation_date: -1 });

// Compound indexes
installationSchema.index({ transformer_id: 1, installation_type: 1 });
installationSchema.index({ previous_transformer_id: 1, installation_date: -1 });

// Pre-save middleware
installationSchema.pre('save', function(next) {
  // Validate replacement reason for replacement installations
  if (this.installation_type === 'Replacement' && !this.replacement_reason) {
    const error = new Error('Replacement reason is required for replacement installations');
    error.status = 400;
    return next(error);
  }
  
  // Auto-set handover date if commissioning date is provided
  if (this.commissioned_by && !this.handover_date) {
    this.handover_date = new Date();
  }
  
  next();
});

// Methods
installationSchema.methods.isReplacement = function() {
  return this.installation_type === 'Replacement';
};

installationSchema.methods.isRelocation = function() {
  return this.installation_type === 'Relocation';
};

installationSchema.methods.isNewInstallation = function() {
  return this.installation_type === 'New Installation';
};

installationSchema.methods.hasChallenges = function() {
  return this.challenges_encountered && this.challenges_encountered.length > 0;
};

// Static methods
installationSchema.statics.getByTransformer = async function(transformerId) {
  return this.find({ transformer_id: transformerId })
    .sort({ installation_date: -1 })
    .populate('previous_transformer_id', 'asset_id display_rating');
};

installationSchema.statics.getInstallationHistory = async function(transformerId) {
  return this.find({
    $or: [
      { transformer_id: transformerId },
      { previous_transformer_id: transformerId }
    ]
  })
  .sort({ installation_date: -1 })
  .populate('transformer_id', 'asset_id display_rating')
  .populate('previous_transformer_id', 'asset_id display_rating');
};

installationSchema.statics.getInstallationStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.installation_date = {};
    if (startDate) match.installation_date.$gte = startDate;
    if (endDate) match.installation_date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$installation_type',
        count: { $sum: 1 }
      }
    }
  ]);
};

installationSchema.statics.getLatestInstallation = async function(transformerId) {
  return this.findOne({ transformer_id: transformerId })
    .sort({ installation_date: -1 });
};

// ToJSON transformation
installationSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Installation', installationSchema);