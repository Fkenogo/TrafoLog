const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: [true, 'Transformer ID is required'],
    index: true
  },
  technician_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Technician ID is required']
  },
  
  // Header
  maintenance_date: {
    type: Date,
    required: [true, 'Maintenance date is required'],
    default: Date.now,
    index: true
  },
  maintenance_type: {
    type: String,
    enum: ['Preventive', 'Corrective', 'Emergency'],
    required: [true, 'Maintenance type is required']
  },
  team_contractor: {
    type: String,
    trim: true
  },
  supervised_by: {
    type: String,
    trim: true
  },
  work_order_number: {
    type: String,
    trim: true
  },
  
  // Work Performed
  work_performed: {
    oil_top_up: {
      performed: {
        type: Boolean,
        default: false
      },
      litres_added: {
        type: Number,
        min: 0
      }
    },
    oil_replacement: {
      type: Boolean,
      default: false
    },
    oil_filtration: {
      type: Boolean,
      default: false
    },
    silica_gel_replaced: {
      type: Boolean,
      default: false
    },
    bushing_replacement: {
      type: Boolean,
      default: false
    },
    tap_changer_service: {
      type: Boolean,
      default: false
    },
    cooling_system_service: {
      type: Boolean,
      default: false
    },
    physical_cleaning: {
      type: Boolean,
      default: false
    },
    painting: {
      type: Boolean,
      default: false
    },
    earthing_repair: {
      type: Boolean,
      default: false
    },
    other_work: {
      type: String,
      trim: true
    }
  },
  
  parts_used: [{
    part: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      default: 'piece'
    },
    serial_number: String,
    manufacturer: String,
    cost: {
      type: Number,
      min: 0
    },
    notes: String
  }],
  
  // Pre-maintenance readings
  pre_maintenance_load: {
    phase_a: Number,
    phase_b: Number,
    phase_c: Number
  },
  pre_maintenance_notes: {
    type: String,
    trim: true
  },
  
  // Post-Maintenance
  post_condition_narrative: {
    type: String,
    trim: true,
    maxlength: [2000, 'Condition narrative cannot exceed 2000 characters']
  },
  post_maintenance_load: {
    phase_a: Number,
    phase_b: Number,
    phase_c: Number
  },
  post_maintenance_readings: {
    voltage_hv: Number,
    voltage_lv: Number,
    oil_temperature: Number,
    ambient_temperature: Number
  },
  completed_by: {
    type: String,
    trim: true
  },
  reviewed_by: {
    type: String,
    trim: true
  },
  reviewed_at: Date,
  review_notes: {
    type: String,
    trim: true
  },
  
  // Photos
  photos_before: [{
    type: String,
    trim: true
  }],
  photos_after: [{
    type: String,
    trim: true
  }],
  
  // Scheduling
  next_maintenance_date: {
    type: Date
  },
  next_maintenance_notes: {
    type: String,
    trim: true
  },
  
  // Costs
  total_cost: {
    type: Number,
    min: 0
  },
  parts_cost: {
    type: Number,
    min: 0
  },
  labour_cost: {
    type: Number,
    min: 0
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
maintenanceSchema.index({ transformer_id: 1, maintenance_date: -1 });
maintenanceSchema.index({ technician_id: 1 });
maintenanceSchema.index({ next_maintenance_date: 1 });
maintenanceSchema.index({ maintenance_type: 1 });
maintenanceSchema.index({ sync_status: 1 });
maintenanceSchema.index({ maintenance_date: -1 });

// Compound indexes
maintenanceSchema.index({ transformer_id: 1, maintenance_type: 1 });
maintenanceSchema.index({ next_maintenance_date: 1, maintenance_type: 1 });

// Pre-save middleware
maintenanceSchema.pre('save', function(next) {
  // Calculate total cost if not provided
  if (this.parts_used && this.parts_used.length > 0) {
    const partsTotal = this.parts_used.reduce((sum, part) => {
      return sum + (part.cost || 0);
    }, 0);
    this.parts_cost = partsTotal;
    
    if (!this.total_cost) {
      this.total_cost = (this.parts_cost || 0) + (this.labour_cost || 0);
    }
  }
  
});

// Methods
maintenanceSchema.methods.isEmergency = function() {
  return this.maintenance_type === 'Emergency';
};

maintenanceSchema.methods.isPreventive = function() {
  return this.maintenance_type === 'Preventive';
};

maintenanceSchema.methods.needsReview = function() {
  return !this.reviewed_by;
};

maintenanceSchema.methods.hasParts = function() {
  return this.parts_used && this.parts_used.length > 0;
};

maintenanceSchema.methods.getWorkSummary = function() {
  const performed = [];
  const work = this.work_performed;
  
  if (work.oil_top_up.performed) performed.push('Oil Top-up');
  if (work.oil_replacement) performed.push('Oil Replacement');
  if (work.oil_filtration) performed.push('Oil Filtration');
  if (work.silica_gel_replaced) performed.push('Silica Gel Replaced');
  if (work.bushing_replacement) performed.push('Bushing Replacement');
  if (work.tap_changer_service) performed.push('Tap Changer Service');
  if (work.cooling_system_service) performed.push('Cooling System Service');
  if (work.physical_cleaning) performed.push('Physical Cleaning');
  if (work.painting) performed.push('Painting');
  if (work.earthing_repair) performed.push('Earthing Repair');
  if (work.other_work) performed.push(`Other: ${work.other_work}`);
  
  return performed;
};

// Static methods
maintenanceSchema.statics.getByTransformer = async function(transformerId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find({ transformer_id: transformerId })
      .sort({ maintenance_date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('technician_id', 'name email'),
    this.countDocuments({ transformer_id: transformerId })
  ]);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

maintenanceSchema.statics.getUpcomingMaintenance = async function(days = 30) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return this.find({
    next_maintenance_date: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .populate('transformer_id', 'asset_id display_rating location_administrative')
  .sort({ next_maintenance_date: 1 });
};

maintenanceSchema.statics.getMaintenanceStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.maintenance_date = {};
    if (startDate) match.maintenance_date.$gte = startDate;
    if (endDate) match.maintenance_date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        preventive: {
          $sum: { $cond: [{ $eq: ['$maintenance_type', 'Preventive'] }, 1, 0] }
        },
        corrective: {
          $sum: { $cond: [{ $eq: ['$maintenance_type', 'Corrective'] }, 1, 0] }
        },
        emergency: {
          $sum: { $cond: [{ $eq: ['$maintenance_type', 'Emergency'] }, 1, 0] }
        },
        avgCost: { $avg: '$total_cost' },
        totalCost: { $sum: '$total_cost' }
      }
    }
  ]);
};

// ToJSON transformation
maintenanceSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);