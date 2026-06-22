const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    index: true,
    trim: true
  },
  action_category: {
    type: String,
    enum: [
      'AUTH',
      'USER_MANAGEMENT',
      'TRANSFORMER_MANAGEMENT',
      'INSPECTION',
      'FAULT_MANAGEMENT',
      'MAINTENANCE',
      'INSTALLATION',
      'REPORTING',
      'IMPORT',
      'EXPORT',
      'SYSTEM'
    ],
    required: true,
    index: true
  },
  target_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  target_transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer'
  },
  target_record_type: {
    type: String,
    enum: ['User', 'Transformer', 'Inspection', 'Fault', 'Maintenance', 'Installation', 'Report']
  },
  target_record_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Details
  details: {
    type: String,
    trim: true,
    maxlength: [2000, 'Details cannot exceed 2000 characters']
  },
  
  // Request context
  ip_address: {
    type: String,
    trim: true
  },
  user_agent: {
    type: String,
    trim: true
  },
  request_method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  request_path: {
    type: String,
    trim: true
  },
  
  // Changes
  old_values: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  new_values: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Security
  is_sensitive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
auditLogSchema.index({ user_id: 1, created_at: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ action_category: 1 });
auditLogSchema.index({ target_record_id: 1 });
auditLogSchema.index({ created_at: -1 });
auditLogSchema.index({ ip_address: 1 });
auditLogSchema.index({ is_sensitive: 1 });

// Compound indexes for common queries
auditLogSchema.index({ user_id: 1, action_category: 1 });
auditLogSchema.index({ target_transformer_id: 1, created_at: -1 });

// Methods
auditLogSchema.methods.isAuthenticationAction = function() {
  return this.action_category === 'AUTH';
};

auditLogSchema.methods.isUserManagementAction = function() {
  return this.action_category === 'USER_MANAGEMENT';
};

auditLogSchema.methods.isTransformerAction = function() {
  return this.action_category === 'TRANSFORMER_MANAGEMENT';
};

// Static methods
auditLogSchema.statics.getUserAuditTrail = async function(userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate('user_id', 'name email')
    .populate('target_user_id', 'name email')
    .populate('target_transformer_id', 'asset_id');
};

auditLogSchema.statics.getTransformerAuditTrail = async function(transformerId, limit = 50) {
  return this.find({ target_transformer_id: transformerId })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate('user_id', 'name email');
};

auditLogSchema.statics.getActionsByCategory = async function(category, startDate, endDate) {
  const query = {
    action_category: category
  };
  
  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) query.created_at.$gte = startDate;
    if (endDate) query.created_at.$lte = endDate;
  }
  
  return this.find(query)
    .sort({ created_at: -1 })
    .populate('user_id', 'name email');
};

auditLogSchema.statics.getActionStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.created_at = {};
    if (startDate) match.created_at.$gte = startDate;
    if (endDate) match.created_at.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$action_category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Check if this is a sensitive action
  const sensitiveActions = [
    'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
    'USER_ROLE_CHANGE', 'USER_CREATE', 'USER_DELETE'
  ];
  this.is_sensitive = sensitiveActions.includes(this.action);
});

// ToJSON transformation
auditLogSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    // Remove sensitive data if needed
    if (ret.old_values && ret.old_values.password) {
      delete ret.old_values.password;
    }
    if (ret.new_values && ret.new_values.password) {
      delete ret.new_values.password;
    }
    return ret;
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);