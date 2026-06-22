const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expires_at: {
    type: Date,
    required: true,
    index: true
  },
  user_agent: String,
  ip_address: String,
  is_revoked: {
    type: Boolean,
    default: false
  },
  revoked_at: Date,
  revoked_reason: String
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Index for cleanup
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Method to check if token is expired
refreshTokenSchema.methods.isExpired = function() {
  return this.expires_at < new Date();
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);