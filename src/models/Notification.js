const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: [
      'FAULT_ALERT',
      'FAULT_ASSIGNED',
      'FAULT_RESOLVED',
      'FAULT_ESCALATED',
      'FAULT_REOPENED',
      'INSPECTION_ALERT',
      'OVERLOAD_ALERT',
      'OVERDUE_INSPECTION',
      'MAINTENANCE_ALERT',
      'MAINTENANCE_SCHEDULED',
      'SYSTEM_ALERT',
      'USER_ACTION_REQUIRED',
      'TRANSFORMER_VERIFIED',
      'TRANSFORMER_DECOMMISSIONED',
      'IMPORT_COMPLETED',
      'REPORT_READY'
    ],
    required: [true, 'Notification type is required']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal',
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Related record
  linked_record_type: {
    type: String,
    enum: ['Transformer', 'Fault', 'Inspection', 'Maintenance', 'Installation', 'Report']
  },
  linked_record_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Read status
  is_read: {
    type: Boolean,
    default: false,
    index: true
  },
  read_at: Date,
  
  // Delivery
  delivered_at: Date,
  delivery_methods: [{
    type: String,
    enum: ['app', 'email', 'sms', 'push']
  }],
  delivery_status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'delivered'],
    default: 'pending'
  },
  delivery_errors: [{
    method: String,
    error: String,
    attempted_at: Date
  }],
  
  // Expiry
  expires_at: {
    type: Date,
    index: true
  },
  
  // Read receipts
  read_receipts: [{
    method: String,
    read_at: Date
  }]
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
notificationSchema.index({ user_id: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, is_read: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ linked_record_id: 1 });

// Compound indexes
notificationSchema.index({ user_id: 1, priority: 1, is_read: 1 });
notificationSchema.index({ created_at: -1, is_read: 1 });

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set expiry if not provided
  if (!this.expires_at) {
    const expiryMap = {
      'low': 30,
      'normal': 14,
      'high': 7,
      'critical': 3
    };
    const days = expiryMap[this.priority] || 30;
    this.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  next();
});

// Methods
notificationSchema.methods.markAsRead = async function() {
  this.is_read = true;
  this.read_at = new Date();
  await this.save();
  return this;
};

notificationSchema.methods.markAsDelivered = async function(method = 'app') {
  if (!this.delivered_at) {
    this.delivered_at = new Date();
  }
  if (!this.delivery_methods.includes(method)) {
    this.delivery_methods.push(method);
  }
  this.delivery_status = 'delivered';
  await this.save();
  return this;
};

notificationSchema.methods.addDeliveryError = async function(method, error) {
  this.delivery_errors.push({
    method,
    error,
    attempted_at: new Date()
  });
  this.delivery_status = 'failed';
  await this.save();
  return this;
};

notificationSchema.methods.isExpired = function() {
  if (!this.expires_at) return false;
  return this.expires_at < new Date();
};

// Static methods
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({
    user_id: userId,
    is_read: false
  });
};

notificationSchema.statics.getUserNotifications = async function(userId, page = 1, limit = 20, filters = {}) {
  const query = { user_id: userId };
  
  if (filters.is_read !== undefined) {
    query.is_read = filters.is_read;
  }
  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.priority) {
    query.priority = filters.priority;
  }
  
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('linked_record_id'),
    this.countDocuments(query)
  ]);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      unread: await this.getUnreadCount(userId)
    }
  };
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user_id: userId, is_read: false },
    {
      is_read: true,
      read_at: new Date()
    }
  );
};

notificationSchema.statics.deleteExpired = async function() {
  return this.deleteMany({
    expires_at: { $lt: new Date() }
  });
};

notificationSchema.statics.getNotificationStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user_id: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $eq: ['$is_read', true] }, 1, 0] } },
        unread: { $sum: { $cond: [{ $eq: ['$is_read', false] }, 1, 0] } },
        critical: {
          $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
        },
        high: {
          $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    total: 0,
    read: 0,
    unread: 0,
    critical: 0,
    high: 0
  };
};

// ToJSON transformation
notificationSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Notification', notificationSchema);