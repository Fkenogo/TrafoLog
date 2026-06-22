const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
  transformer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transformer',
    required: [true, 'Transformer ID is required'],
    index: true
  },
  event_type: {
    type: String,
    enum: [
      'REGISTERED',
      'VERIFIED',
      'UPDATED',
      'DECOMMISSIONED',
      'INSPECTED',
      'MAINTENANCE_PERFORMED',
      'FAULT_REPORTED',
      'FAULT_ASSIGNED',
      'FAULT_RESOLVED',
      'FAULT_CLOSED',
      'INSTALLED',
      'REPLACED',
      'RELOCATED',
      'LOAD_SPLIT',
      'OVERLOAD_DETECTED',
      'COMPONENT_REPLACED'
    ],
    required: [true, 'Event type is required']
  },
  event_summary: {
    type: String,
    required: [true, 'Event summary is required'],
    trim: true,
    maxlength: [500, 'Event summary cannot exceed 500 characters']
  },
  event_date: {
    type: Date,
    default: Date.now,
    index: true
  },
  event_details: {
    type: String,
    trim: true
  },
  
  // Reference to the related record
  linked_record_type: {
    type: String,
    enum: ['Inspection', 'Maintenance', 'Fault', 'Installation', 'Transformer']
  },
  linked_record_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // User who performed the action
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Human-readable fields for quick display
  display_data: {
    user_name: String,
    user_role: String,
    location: String,
    rating: String,
    status: String
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
timelineSchema.index({ transformer_id: 1, event_date: -1 });
timelineSchema.index({ event_type: 1 });
timelineSchema.index({ linked_record_id: 1 });
timelineSchema.index({ created_at: -1 });
timelineSchema.index({ 'metadata.severity': 1 });

// Virtuals
timelineSchema.virtual('is_automated').get(function() {
  const automatedEvents = ['UPDATED', 'OVERLOAD_DETECTED', 'STATUS_CHANGED'];
  return automatedEvents.includes(this.event_type);
});

timelineSchema.virtual('is_fault_related').get(function() {
  const faultEvents = ['FAULT_REPORTED', 'FAULT_ASSIGNED', 'FAULT_RESOLVED', 'FAULT_CLOSED'];
  return faultEvents.includes(this.event_type);
});

timelineSchema.virtual('is_maintenance_related').get(function() {
  const maintenanceEvents = ['MAINTENANCE_PERFORMED', 'COMPONENT_REPLACED'];
  return maintenanceEvents.includes(this.event_type);
});

// Methods
timelineSchema.methods.getEventIcon = function() {
  const iconMap = {
    'REGISTERED': '📋',
    'VERIFIED': '✅',
    'UPDATED': '📝',
    'DECOMMISSIONED': '⚰️',
    'INSPECTED': '🔍',
    'MAINTENANCE_PERFORMED': '🔧',
    'FAULT_REPORTED': '⚠️',
    'FAULT_ASSIGNED': '📌',
    'FAULT_RESOLVED': '✔️',
    'FAULT_CLOSED': '🔒',
    'INSTALLED': '🔌',
    'REPLACED': '🔄',
    'RELOCATED': '🚚',
    'LOAD_SPLIT': '⚡',
    'OVERLOAD_DETECTED': '🔥',
    'COMPONENT_REPLACED': '🔄'
  };
  return iconMap[this.event_type] || '📌';
};

timelineSchema.methods.getEventColor = function() {
  const colorMap = {
    'REGISTERED': '#28a745',
    'VERIFIED': '#17a2b8',
    'UPDATED': '#6c757d',
    'DECOMMISSIONED': '#dc3545',
    'INSPECTED': '#007bff',
    'MAINTENANCE_PERFORMED': '#fd7e14',
    'FAULT_REPORTED': '#dc3545',
    'FAULT_ASSIGNED': '#ffc107',
    'FAULT_RESOLVED': '#28a745',
    'FAULT_CLOSED': '#6c757d',
    'INSTALLED': '#007bff',
    'REPLACED': '#fd7e14',
    'RELOCATED': '#17a2b8',
    'LOAD_SPLIT': '#6610f2',
    'OVERLOAD_DETECTED': '#dc3545',
    'COMPONENT_REPLACED': '#fd7e14'
  };
  return colorMap[this.event_type] || '#6c757d';
};

// Static methods
timelineSchema.statics.getByTransformer = async function(transformerId, limit = 50) {
  return this.find({ transformer_id: transformerId })
    .sort({ event_date: -1 })
    .limit(limit)
    .populate('created_by', 'name email role');
};

timelineSchema.statics.getRecent = async function(limit = 20, filters = {}) {
  const query = {};
  if (filters.transformer_id) {
    query.transformer_id = filters.transformer_id;
  }
  if (filters.event_type) {
    query.event_type = filters.event_type;
  }
  if (filters.user_id) {
    query.created_by = filters.user_id;
  }
  
  return this.find(query)
    .sort({ event_date: -1 })
    .limit(limit)
    .populate('transformer_id', 'asset_id display_rating location_administrative')
    .populate('created_by', 'name email role');
};

timelineSchema.statics.getTimelineSummary = async function(transformerId) {
  const events = await this.find({ transformer_id: transformerId })
    .sort({ event_date: -1 });
  
  const summary = {
    total: events.length,
    inspections: events.filter(e => e.event_type === 'INSPECTED').length,
    faults: events.filter(e => e.is_fault_related).length,
    maintenance: events.filter(e => e.is_maintenance_related).length,
    installations: events.filter(e => e.event_type === 'INSTALLED').length
  };
  
  return summary;
};

// Pre-save middleware
timelineSchema.pre('save', function(next) {
  // Populate display data if not already set
  if (this.isNew) {
    // This will be populated in service layer
  }
});

// ToJSON transformation
timelineSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('AssetTimeline', timelineSchema);