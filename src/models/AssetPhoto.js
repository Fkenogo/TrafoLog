const mongoose = require('mongoose');

const assetPhotoSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: [true, 'Transformer ID is required'],
    index: true
  },
  photo_category: {
    type: String,
    enum: [
      'Nameplate',
      'Installation',
      'Inspection',
      'Fault',
      'Maintenance',
      'Before',
      'After',
      'General'
    ],
    required: [true, 'Photo category is required']
  },
  image_url: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true
  },
  thumbnail_url: {
    type: String,
    trim: true
  },
  caption: {
    type: String,
    trim: true,
    maxlength: [500, 'Caption cannot exceed 500 characters']
  },
  gps_location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
  },
  
  // Reference to the source record
  linked_record_type: {
    type: String,
    enum: ['Inspection', 'Maintenance', 'Fault', 'Installation']
  },
  linked_record_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Metadata
  file_size: {
    type: Number,
    min: 0
  },
  mime_type: {
    type: String,
    trim: true
  },
  width: {
    type: Number,
    min: 0
  },
  height: {
    type: Number,
    min: 0
  },
  orientation: {
    type: String,
    enum: ['portrait', 'landscape', 'square'],
    default: 'landscape'
  },
  
  // User who uploaded
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Upload details
  uploaded_at: {
    type: Date,
    default: Date.now
  },
  
  // Sync tracking
  sync_status: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'pending'
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
assetPhotoSchema.index({ transformer_id: 1, photo_category: 1 });
assetPhotoSchema.index({ linked_record_id: 1 });
assetPhotoSchema.index({ uploaded_by: 1 });
assetPhotoSchema.index({ sync_status: 1 });
assetPhotoSchema.index({ uploaded_at: -1 });

// Pre-save middleware
assetPhotoSchema.pre('save', function(next) {
  // Set orientation based on dimensions
  if (this.width && this.height) {
    if (this.width > this.height) {
      this.orientation = 'landscape';
    } else if (this.height > this.width) {
      this.orientation = 'portrait';
    } else {
      this.orientation = 'square';
    }
  }
  next();
});

// Methods
assetPhotoSchema.methods.isNameplate = function() {
  return this.photo_category === 'Nameplate';
};

assetPhotoSchema.methods.getThumbnailUrl = function() {
  return this.thumbnail_url || this.image_url;
};

// Static methods
assetPhotoSchema.statics.getByTransformer = async function(transformerId, category = null) {
  const query = { transformer_id: transformerId, is_deleted: false };
  if (category) {
    query.photo_category = category;
  }
  return this.find(query)
    .sort({ uploaded_at: -1 })
    .populate('uploaded_by', 'name email');
};

assetPhotoSchema.statics.getByRecord = async function(recordType, recordId) {
  return this.find({
    linked_record_type: recordType,
    linked_record_id: recordId,
    is_deleted: false
  }).sort({ uploaded_at: 1 });
};

// ToJSON transformation
assetPhotoSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AssetPhoto', assetPhotoSchema);