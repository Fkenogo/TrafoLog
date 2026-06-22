const mongoose = require('mongoose');

const inspectionSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: [true, 'Transformer ID is required'],
    index: true
  },
  inspector_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Inspector ID is required']
  },
  
  // Header
  inspection_date: {
    type: Date,
    required: [true, 'Inspection date is required'],
    default: Date.now,
    index: true
  },
  visit_type: {
    type: String,
    enum: ['Routine Inspection', 'Follow-up', 'Audit'],
    default: 'Routine Inspection'
  },
  gps_at_inspection: {
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
  gps_accuracy: {
    type: Number,
    min: 0
  },
  
  // Network Check
  network_voltage_confirmed: {
    type: Boolean,
    default: false
  },
  kva_rating_confirmed: {
    type: Boolean,
    default: false
  },
  rating_discrepancy_flag: {
    type: Boolean,
    default: false
  },
  rating_discrepancy_details: {
    type: String,
    trim: true
  },
  
  // Physical Condition
  physical: {
    overall_condition: {
      type: String,
      enum: ['Good', 'Fair', 'Poor', 'Critical'],
      default: 'Good'
    },
    rust_corrosion: {
      type: String,
      enum: ['None', 'Minor', 'Severe'],
      default: 'None'
    },
    oil_leakage: {
      type: String,
      enum: ['None', 'Slow Drip', 'Active Leak'],
      default: 'None'
    },
    bushing_condition: {
      type: String,
      enum: ['Good', 'Cracked', 'Broken'],
      default: 'Good'
    },
    tank_body_damage: {
      type: String,
      enum: ['None', 'Dents', 'Puncture'],
      default: 'None'
    },
    cooling_fins_condition: {
      type: String,
      enum: ['Good', 'Damaged', 'Blocked'],
      default: 'Good'
    },
    sound_level: {
      type: String,
      enum: ['Normal', 'Unusual', 'Loud'],
      default: 'Normal'
    },
    temperature: {
      type: Number,
      min: -20,
      max: 150
    }
  },
  
  // Oil & Breather
  oil_breather: {
    oil_level: {
      type: String,
      enum: ['Full', 'Adequate', 'Low', 'Very Low'],
      default: 'Adequate'
    },
    silica_gel_color: {
      type: String,
      enum: ['Blue', 'Pink', 'White'],
      default: 'Blue'
    },
    oil_test_required: {
      type: Boolean,
      default: false
    },
    oil_test_notes: {
      type: String,
      trim: true
    },
    oil_temperature: {
      type: Number,
      min: -20,
      max: 150
    }
  },
  
  // Electrical Readings
  electrical: {
    load_current_a: {
      type: Number,
      min: 0
    },
    load_current_b: {
      type: Number,
      min: 0
    },
    load_current_c: {
      type: Number,
      min: 0
    },
    voltage_hv_side: {
      type: Number,
      min: 0
    },
    voltage_lv_side: {
      type: Number,
      min: 0
    },
    load_percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    overload_flag: {
      type: Boolean,
      default: false
    },
    power_factor: {
      type: Number,
      min: 0,
      max: 1
    },
    frequency: {
      type: Number,
      min: 49,
      max: 51
    }
  },
  
  // Site & Safety
  site_safety: {
    security_fencing: {
      type: String,
      enum: ['Present', 'Damaged', 'Absent'],
      default: 'Absent'
    },
    earthing: {
      type: String,
      enum: ['Present', 'Absent'],
      default: 'Absent'
    },
    warning_signs: {
      type: String,
      enum: ['Present', 'Absent'],
      default: 'Absent'
    },
    vegetation_encroachment: {
      type: String,
      enum: ['None', 'Moderate', 'Severe'],
      default: 'None'
    },
    unauthorised_connections: {
      type: Boolean,
      default: false
    },
    safety_notes: {
      type: String,
      trim: true
    }
  },
  
  // Assessment
  condition_narrative: {
    type: String,
    trim: true,
    maxlength: [2000, 'Condition narrative cannot exceed 2000 characters']
  },
  recommended_action: {
    type: String,
    enum: ['No Action', 'Monitor', 'Schedule Maintenance', 'Urgent Repair', 'Replace'],
    default: 'Monitor'
  },
  recommended_action_details: {
    type: String,
    trim: true
  },
  
  // Photos
  photos: [{
    type: String,
    trim: true
  }],
  
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
inspectionSchema.index({ transformer_id: 1, inspection_date: -1 });
inspectionSchema.index({ inspector_id: 1 });
inspectionSchema.index({ 'electrical.overload_flag': 1 });
inspectionSchema.index({ inspection_date: -1 });
inspectionSchema.index({ sync_status: 1 });
inspectionSchema.index({ recommended_action: 1 });
inspectionSchema.index({ 'physical.overall_condition': 1 });

// Compound indexes
inspectionSchema.index({ transformer_id: 1, 'physical.overall_condition': 1 });
inspectionSchema.index({ inspection_date: -1, recommended_action: 1 });

// Pre-save middleware
inspectionSchema.pre('save', function(next) {
  // Set rating discrepancy flag
  if (this.network_voltage_confirmed === false || this.kva_rating_confirmed === false) {
    this.rating_discrepancy_flag = true;
  }
  
  // Calculate load percentage if currents are provided
  if (this.electrical.load_current_a && this.electrical.load_current_b && this.electrical.load_current_c) {
    // This will be calculated in service layer
    // But we can set a default calculation here
    const avgCurrent = (this.electrical.load_current_a + this.electrical.load_current_b + this.electrical.load_current_c) / 3;
    // Assuming 415V, 3-phase
    if (this.transformer_id) {
      // Will be calculated in service
    }
  }
  
});

// Methods
inspectionSchema.methods.isOverload = function() {
  return this.electrical.overload_flag === true;
};

inspectionSchema.methods.needsUrgentAction = function() {
  return ['Urgent Repair', 'Replace'].includes(this.recommended_action);
};

inspectionSchema.methods.isPoorCondition = function() {
  return ['Poor', 'Critical'].includes(this.physical.overall_condition);
};

inspectionSchema.methods.hasSafetyIssues = function() {
  return this.site_safety.security_fencing === 'Absent' ||
         this.site_safety.earthing === 'Absent' ||
         this.site_safety.warning_signs === 'Absent' ||
         this.site_safety.vegetation_encroachment === 'Severe' ||
         this.site_safety.unauthorised_connections === true;
};

// Static methods
inspectionSchema.statics.getLatestForTransformer = async function(transformerId) {
  return this.findOne({ transformer_id: transformerId })
    .sort({ inspection_date: -1 })
    .populate('inspector_id', 'name email');
};

inspectionSchema.statics.getOverdueInspections = async function(days = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    inspection_date: { $lt: cutoffDate }
  })
  .populate('transformer_id')
  .sort({ inspection_date: 1 });
};

inspectionSchema.statics.getInspectionStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.inspection_date = {};
    if (startDate) match.inspection_date.$gte = startDate;
    if (endDate) match.inspection_date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        good: {
          $sum: { $cond: [{ $eq: ['$physical.overall_condition', 'Good'] }, 1, 0] }
        },
        fair: {
          $sum: { $cond: [{ $eq: ['$physical.overall_condition', 'Fair'] }, 1, 0] }
        },
        poor: {
          $sum: { $cond: [{ $eq: ['$physical.overall_condition', 'Poor'] }, 1, 0] }
        },
        critical: {
          $sum: { $cond: [{ $eq: ['$physical.overall_condition', 'Critical'] }, 1, 0] }
        },
        overloaded: {
          $sum: { $cond: [{ $eq: ['$electrical.overload_flag', true] }, 1, 0] }
        },
        urgentAction: {
          $sum: {
            $cond: [
              { $in: ['$recommended_action', ['Urgent Repair', 'Replace']] },
              1,
              0
            ]
          }
        },
        avgLoad: { $avg: '$electrical.load_percentage' }
      }
    }
  ]);
};

// ToJSON transformation
inspectionSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Inspection', inspectionSchema);