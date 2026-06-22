const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer'],
    required: true,
    default: 'Viewer'
  },
  territory_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Territory',
    validate: {
      validator: function(value) {
        if (this.role === 'Super Admin') return true;
        if (this.role === 'Viewer') return true;
        return value != null;
      },
      message: 'Territory is required for this role'
    }
  },
  service_area_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceArea',
    validate: {
      validator: function(value) {
        if (this.role === 'Super Admin') return true;
        if (this.role === 'Viewer') return true;
        if (this.role === 'Territory Manager') return true;
        return value != null;
      },
      message: 'Service area is required for Field Technician and Engineer roles'
    }
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_login: Date,
  login_attempts: {
    type: Number,
    default: 0
  },
  lock_until: Date,
  
  // Password reset
  reset_password_token: String,
  reset_password_expires: Date,
  
  // Email verification
  email_verified: {
    type: Boolean,
    default: false
  },
  email_verification_token: String,
  email_verification_expires: Date,
  
  // Two-factor authentication
  two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: String,
  
  // Refresh tokens
  refresh_tokens: [{
    token: String,
    created_at: {
      type: Date,
      default: Date.now
    },
    expires_at: Date,
    user_agent: String,
    ip_address: String
  }],
  
  // Push notification tokens
  push_tokens: [{
    token: String,
    platform: {
      type: String,
      enum: ['web', 'android', 'ios']
    },
    device_name: String,
    created_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    dashboard_widgets: [String]
  },
  
  // Audit
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ territory_id: 1 });
userSchema.index({ service_area_id: 1 });
userSchema.index({ is_active: 1 });
userSchema.index({ reset_password_token: 1 });
userSchema.index({ email_verification_token: 1 });

// Pre-save middleware
userSchema.pre('save', async function() {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Set email verification token for new users
  if (this.isNew) {
    this.email_verification_token = crypto.randomBytes(32).toString('hex');
    this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );
};

userSchema.methods.generateRefreshToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d' }
  );
};

userSchema.methods.generatePasswordResetToken = function() {
  this.reset_password_token = crypto.randomBytes(32).toString('hex');
  this.reset_password_expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
  return this.reset_password_token;
};

userSchema.methods.generateEmailVerificationToken = function() {
  this.email_verification_token = crypto.randomBytes(32).toString('hex');
  this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return this.email_verification_token;
};

userSchema.methods.incrementLoginAttempts = async function() {
  this.login_attempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.login_attempts >= 5) {
    this.lock_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.resetLoginAttempts = async function() {
  this.login_attempts = 0;
  this.lock_until = undefined;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.isLocked = function() {
  if (!this.lock_until) return false;
  return this.lock_until > new Date();
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.reset_password_token;
  delete user.reset_password_expires;
  delete user.email_verification_token;
  delete user.email_verification_expires;
  delete user.two_factor_secret;
  delete user.refresh_tokens;
  return user;
};

module.exports = mongoose.model('User', userSchema);