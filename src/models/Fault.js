const mongoose = require('mongoose');

const faultSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: true,
    index: true
  },
  reported_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Fault Details
  fault_date: {
    type: Date,
    required: true,
    default: Date.now
  },
  fault_source: {
    type: String,
    enum: ['Field Observation', 'Customer Report', 'Supervisor']
  },
  fault_description: {
    type: String,
    required: true
  },
  fault_type: {
    type: String,
    enum: [
      'Overload', 'Oil Leak', 'Bushing Failure', 'Winding Failure',
      'Complete Failure', 'Fire', 'Theft', 'Vandalism',
      'LV Side Fault', 'HV Side Fault', 'Other'
    ]
  },
  severity: {
    type: String,
    enum: ['Minor', 'Major', 'Critical', 'Complete Outage'],
    required: true
  },
  network_voltage_kv: {
    type: Number,
    enum: [11, 33]
  },
  customers_affected: Number,
  area_affected: String,
  
  // Photos
  photos: [String],
  
  // Management
  fault_status: {
    type: String,
    enum: ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  date_assigned: Date,
  target_resolution_date: Date,
  
  // Resolution
  resolved_date: Date,
  resolution_description: String,
  root_cause: String,
  parts_replaced: String,
  downtime_hours: Number,
  resolved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Photos after repair
  photos_after_repair: [String]
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
faultSchema.index({ transformer_id: 1, fault_date: -1 });
faultSchema.index({ fault_status: 1 });
faultSchema.index({ severity: 1 });
faultSchema.index({ assigned_to: 1 });
faultSchema.index({ resolved_date: 1 });

// Pre-save middleware to calculate downtime
faultSchema.pre('save', function(next) {
  if (this.fault_status === 'Resolved' && this.resolved_date) {
    this.downtime_hours = Math.round(
      (this.resolved_date - this.fault_date) / (1000 * 60 * 60)
    );
  }
  next();
});

module.exports = mongoose.model('Fault', faultSchema);