const mongoose = require('mongoose');

const transformerSchema = new mongoose.Schema({
  asset_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  uedcl_reference: String,
  
  // Identity
  manufacturer: String,
  serial_number: {
    type: String,
    index: true
  },
  year_manufactured: Number,
  record_status: {
    type: String,
    enum: ['Draft', 'Verified', 'Active'],
    default: 'Draft'
  },
  
  // Rating (Denormalized for performance)
  rating_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransformerRating'
  },
  kva_rating: Number,
  network_voltage_kv: {
    type: Number,
    enum: [11, 33],
    required: true
  },
  display_rating: String,
  
  // Electrical Specifications
  voltage_secondary: {
    type: String,
    enum: ['415V', '240V', 'Other']
  },
  phase_type: {
    type: String,
    enum: ['Single Phase', 'Three Phase']
  },
  cooling_type: {
    type: String,
    enum: ['ONAN', 'ONAF', 'OFAF']
  },
  mounting_type: {
    type: String,
    enum: ['Pole Mounted', 'Plinth', 'Ground', 'Indoor Substation']
  },
  vector_group: String,
  
  // Location - Operational
  location_operational: {
    territory_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Territory'
    },
    territory_name: String,
    service_area_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceArea'
    },
    service_area_name: String,
    feeder_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Feeder'
    },
    feeder_name: String,
    feeder_code: String,
    substation_name: String
  },
  
  // Location - Administrative
  location_administrative: {
    district_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District'
    },
    district_name: String,
    sub_county: String,
    parish: String,
    village: String,
    site_name: String
  },
  
  // GPS
  gps: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    method: {
      type: String,
      enum: ['Field Captured', 'Imported', 'Estimated']
    },
    accuracy_metres: Number,
    captured_at: Date
  },
  
  // Installation
  installation: {
    install_date: Date,
    installing_contractor: String,
    commissioned_by: String,
    commissioning_date: Date,
    warranty_expiry: Date
  },
  
  // Status (Auto-maintained)
  operational_status: {
    type: String,
    enum: ['Active', 'Faulty', 'Under Maintenance', 'Decommissioned', 'Unverified'],
    default: 'Unverified'
  },
  has_open_fault: {
    type: Boolean,
    default: false
  },
  last_inspection_date: Date,
  last_maintenance_date: Date,
  last_load_reading_date: Date,
  last_load_percentage: Number,
  overdue_inspection_flag: {
    type: Boolean,
    default: false
  },
  
  // QR Code
  qr_code: String,
  
  // Soft Delete
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: Date,
  
  // Audit
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
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
transformerSchema.index({ asset_id: 1 }, { unique: true });
transformerSchema.index({ serial_number: 1 });
transformerSchema.index({ gps: '2dsphere' });
transformerSchema.index({ operational_status: 1, 'location_operational.territory_id': 1 });
transformerSchema.index({ network_voltage_kv: 1, kva_rating: 1 });
transformerSchema.index({ last_inspection_date: 1 });
transformerSchema.index({ has_open_fault: 1 });
transformerSchema.index({ created_at: -1 });

// Middleware
transformerSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate asset_id if not provided
    if (!this.asset_id) {
      // Will be handled by service
    }
    // Set display_rating
    this.display_rating = `${this.kva_rating}kVA/${this.network_voltage_kv}kV`;
  }
  next();
});

// Methods
transformerSchema.methods.updateStatus = async function() {
  // Logic to update operational status based on related records
};

module.exports = mongoose.model('Transformer', transformerSchema);