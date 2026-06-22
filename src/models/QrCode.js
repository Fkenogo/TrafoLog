const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: [true, 'Transformer ID is required'],
    unique: true,
    index: true
  },
  qr_code_string: {
    type: String,
    required: [true, 'QR code string is required'],
    unique: true,
    index: true,
    trim: true
  },
  qr_code_image: {
    type: String,
    required: [true, 'QR code image is required']
  },
  qr_code_image_thumbnail: {
    type: String
  },
  version: {
    type: Number,
    default: 1
  },
  format: {
    type: String,
    enum: ['png', 'svg', 'jpeg'],
    default: 'png'
  },
  size: {
    type: Number,
    default: 300,
    min: 100,
    max: 1000
  },
  error_correction_level: {
    type: String,
    enum: ['L', 'M', 'Q', 'H'],
    default: 'H'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'active',
    index: true
  },
  
  // Generation details
  generated_at: {
    type: Date,
    default: Date.now
  },
  generated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  generated_from: {
    type: String,
    enum: ['manual', 'import', 'system'],
    default: 'manual'
  },
  
  // Scan tracking
  last_scanned_at: Date,
  scan_count: {
    type: Number,
    default: 0
  },
  scan_history: [{
    scanned_at: {
      type: Date,
      default: Date.now
    },
    scanned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    location: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: [Number]
    },
    device_info: {
      type: String,
      trim: true
    },
    user_agent: String,
    ip_address: String
  }],
  
  // Expiry
  expires_at: {
    type: Date
  },
  
  // QR code data
  qr_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Custom styling
  custom_color: {
    dark: {
      type: String,
      default: '#000000'
    },
    light: {
      type: String,
      default: '#FFFFFF'
    }
  },
  
  // Download tracking
  download_count: {
    type: Number,
    default: 0
  },
  last_downloaded_at: Date,
  
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
qrCodeSchema.index({ qr_code_string: 1 });
qrCodeSchema.index({ status: 1 });
qrCodeSchema.index({ expires_at: 1 });
qrCodeSchema.index({ generated_at: -1 });
qrCodeSchema.index({ scan_count: -1 });

// Pre-save middleware
qrCodeSchema.pre('save', function(next) {
  // Set expiry if not provided
  if (!this.expires_at) {
    // Default expiry: 5 years from generation
    this.expires_at = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);
  }
  
  // Set QR data if not provided
  if (!this.qr_data || Object.keys(this.qr_data).length === 0) {
    // This will be populated in service layer
  }
  
  next();
});

// Methods
qrCodeSchema.methods.scan = async function(userId, location = null, deviceInfo = null) {
  this.scan_count += 1;
  this.last_scanned_at = new Date();
  
  this.scan_history.push({
    scanned_at: new Date(),
    scanned_by: userId,
    location: location,
    device_info: deviceInfo
  });
  
  await this.save();
  return this;
};

qrCodeSchema.methods.download = async function() {
  this.download_count += 1;
  this.last_downloaded_at = new Date();
  await this.save();
  return this;
};

qrCodeSchema.methods.isExpired = function() {
  if (!this.expires_at) return false;
  return this.expires_at < new Date();
};

qrCodeSchema.methods.isActive = function() {
  return this.status === 'active' && !this.isExpired();
};

qrCodeSchema.methods.getScanFrequency = function() {
  if (this.scan_count === 0) return 0;
  const daysSinceCreation = (Date.now() - this.generated_at) / (1000 * 60 * 60 * 24);
  return daysSinceCreation > 0 ? this.scan_count / daysSinceCreation : this.scan_count;
};

// Static methods
qrCodeSchema.statics.getByTransformer = async function(transformerId) {
  return this.findOne({ transformer_id: transformerId });
};

qrCodeSchema.statics.getActiveByTransformer = async function(transformerId) {
  return this.findOne({
    transformer_id: transformerId,
    status: 'active',
    is_deleted: false
  });
};

qrCodeSchema.statics.getScanStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.last_scanned_at = {};
    if (startDate) match.last_scanned_at.$gte = startDate;
    if (endDate) match.last_scanned_at.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalScans: { $sum: '$scan_count' },
        uniqueQRCodes: { $sum: 1 },
        avgScans: { $avg: '$scan_count' },
        maxScans: { $max: '$scan_count' }
      }
    }
  ]);
};

qrCodeSchema.statics.getTopScanned = async function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ scan_count: -1 })
    .limit(limit)
    .populate('transformer_id', 'asset_id display_rating location_administrative');
};

qrCodeSchema.statics.expireOld = async function(days = 365) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - days);
  
  return this.updateMany(
    {
      generated_at: { $lt: expiryDate },
      status: 'active'
    },
    {
      status: 'expired'
    }
  );
};

// ToJSON transformation
qrCodeSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('QRCode', qrCodeSchema);