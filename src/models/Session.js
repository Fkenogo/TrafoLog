const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  session_token: {
    type: String,
    required: true,
    unique: true
  },
  user_agent: String,
  ip_address: String,
  is_active: {
    type: Boolean,
    default: true
  },
  expires_at: {
    type: Date,
    required: true,
    index: true
  },
  last_activity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// TTL index for automatic cleanup
sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Methods
sessionSchema.methods.isExpired = function() {
  return this.expires_at < new Date();
};

sessionSchema.methods.extend = async function(extraTime = 7 * 24 * 60 * 60 * 1000) {
  this.expires_at = new Date(Date.now() + extraTime);
  this.last_activity = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('Session', sessionSchema);