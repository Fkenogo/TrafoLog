const Joi = require('joi');

/**
 * Create inspection schema
 */
const createInspectionSchema = Joi.object({
  transformer_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Transformer ID is required',
      'string.empty': 'Transformer ID cannot be empty'
    }),
  
  inspection_date: Joi.date()
    .default(Date.now)
    .max('now')
    .messages({
      'date.max': 'Inspection date cannot be in the future'
    }),
  
  visit_type: Joi.string()
    .valid('Routine Inspection', 'Follow-up', 'Audit')
    .default('Routine Inspection')
    .messages({
      'any.only': 'Invalid visit type'
    }),
  
  gps_lat: Joi.number()
    .optional()
    .min(-90)
    .max(90)
    .messages({
      'number.min': 'GPS latitude must be between -90 and 90',
      'number.max': 'GPS latitude must be between -90 and 90'
    }),
  
  gps_lng: Joi.number()
    .optional()
    .min(-180)
    .max(180)
    .messages({
      'number.min': 'GPS longitude must be between -180 and 180',
      'number.max': 'GPS longitude must be between -180 and 180'
    }),
  
  gps_accuracy: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'GPS accuracy cannot be negative'
    }),
  
  network_voltage_confirmed: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Network voltage confirmed must be a boolean'
    }),
  
  kva_rating_confirmed: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'kVA rating confirmed must be a boolean'
    }),
  
  rating_discrepancy_details: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Rating discrepancy details cannot exceed 500 characters'
    }),
  
  // Physical
  physical: Joi.object({
    overall_condition: Joi.string()
      .valid('Good', 'Fair', 'Poor', 'Critical')
      .default('Good')
      .messages({
        'any.only': 'Invalid overall condition'
      }),
    
    rust_corrosion: Joi.string()
      .valid('None', 'Minor', 'Severe')
      .default('None')
      .messages({
        'any.only': 'Invalid rust/corrosion status'
      }),
    
    oil_leakage: Joi.string()
      .valid('None', 'Slow Drip', 'Active Leak')
      .default('None')
      .messages({
        'any.only': 'Invalid oil leakage status'
      }),
    
    bushing_condition: Joi.string()
      .valid('Good', 'Cracked', 'Broken')
      .default('Good')
      .messages({
        'any.only': 'Invalid bushing condition'
      }),
    
    tank_body_damage: Joi.string()
      .valid('None', 'Dents', 'Puncture')
      .default('None')
      .messages({
        'any.only': 'Invalid tank/body damage status'
      }),
    
    cooling_fins_condition: Joi.string()
      .valid('Good', 'Damaged', 'Blocked')
      .default('Good')
      .messages({
        'any.only': 'Invalid cooling fins condition'
      }),
    
    sound_level: Joi.string()
      .valid('Normal', 'Unusual', 'Loud')
      .default('Normal')
      .messages({
        'any.only': 'Invalid sound level'
      }),
    
    temperature: Joi.number()
      .optional()
      .min(-20)
      .max(150)
      .messages({
        'number.min': 'Temperature must be at least -20°C',
        'number.max': 'Temperature cannot exceed 150°C'
      })
  }).optional(),
  
  // Oil & Breather
  oil_breather: Joi.object({
    oil_level: Joi.string()
      .valid('Full', 'Adequate', 'Low', 'Very Low')
      .default('Adequate')
      .messages({
        'any.only': 'Invalid oil level'
      }),
    
    silica_gel_color: Joi.string()
      .valid('Blue', 'Pink', 'White')
      .default('Blue')
      .messages({
        'any.only': 'Invalid silica gel color'
      }),
    
    oil_test_required: Joi.boolean()
      .default(false)
      .messages({
        'boolean.base': 'Oil test required must be a boolean'
      }),
    
    oil_test_notes: Joi.string()
      .optional()
      .max(500)
      .trim()
      .messages({
        'string.max': 'Oil test notes cannot exceed 500 characters'
      }),
    
    oil_temperature: Joi.number()
      .optional()
      .min(-20)
      .max(150)
      .messages({
        'number.min': 'Oil temperature must be at least -20°C',
        'number.max': 'Oil temperature cannot exceed 150°C'
      })
  }).optional(),
  
  // Electrical
  electrical: Joi.object({
    load_current_a: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Load current A cannot be negative'
      }),
    
    load_current_b: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Load current B cannot be negative'
      }),
    
    load_current_c: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Load current C cannot be negative'
      }),
    
    voltage_hv_side: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'HV voltage cannot be negative'
      }),
    
    voltage_lv_side: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'LV voltage cannot be negative'
      }),
    
    load_percentage: Joi.number()
      .optional()
      .min(0)
      .max(100)
      .messages({
        'number.min': 'Load percentage must be between 0 and 100',
        'number.max': 'Load percentage must be between 0 and 100'
      }),
    
    power_factor: Joi.number()
      .optional()
      .min(0)
      .max(1)
      .messages({
        'number.min': 'Power factor must be between 0 and 1',
        'number.max': 'Power factor must be between 0 and 1'
      }),
    
    frequency: Joi.number()
      .optional()
      .min(49)
      .max(51)
      .messages({
        'number.min': 'Frequency must be between 49 and 51 Hz',
        'number.max': 'Frequency must be between 49 and 51 Hz'
      })
  }).optional(),
  
  // Site & Safety
  site_safety: Joi.object({
    security_fencing: Joi.string()
      .valid('Present', 'Damaged', 'Absent')
      .default('Absent')
      .messages({
        'any.only': 'Invalid security fencing status'
      }),
    
    earthing: Joi.string()
      .valid('Present', 'Absent')
      .default('Absent')
      .messages({
        'any.only': 'Invalid earthing status'
      }),
    
    warning_signs: Joi.string()
      .valid('Present', 'Absent')
      .default('Absent')
      .messages({
        'any.only': 'Invalid warning signs status'
      }),
    
    vegetation_encroachment: Joi.string()
      .valid('None', 'Moderate', 'Severe')
      .default('None')
      .messages({
        'any.only': 'Invalid vegetation encroachment status'
      }),
    
    unauthorised_connections: Joi.boolean()
      .default(false)
      .messages({
        'boolean.base': 'Unauthorised connections must be a boolean'
      }),
    
    safety_notes: Joi.string()
      .optional()
      .max(500)
      .trim()
      .messages({
        'string.max': 'Safety notes cannot exceed 500 characters'
      })
  }).optional(),
  
  condition_narrative: Joi.string()
    .optional()
    .max(2000)
    .trim()
    .messages({
      'string.max': 'Condition narrative cannot exceed 2000 characters'
    }),
  
  recommended_action: Joi.string()
    .valid('No Action', 'Monitor', 'Schedule Maintenance', 'Urgent Repair', 'Replace')
    .default('Monitor')
    .messages({
      'any.only': 'Invalid recommended action'
    }),
  
  recommended_action_details: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Recommended action details cannot exceed 500 characters'
    })
});

/**
 * Update inspection schema
 */
const updateInspectionSchema = Joi.object({
  inspection_date: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Inspection date cannot be in the future'
    }),
  
  visit_type: Joi.string()
    .valid('Routine Inspection', 'Follow-up', 'Audit')
    .messages({
      'any.only': 'Invalid visit type'
    }),
  
  network_voltage_confirmed: Joi.boolean()
    .messages({
      'boolean.base': 'Network voltage confirmed must be a boolean'
    }),
  
  kva_rating_confirmed: Joi.boolean()
    .messages({
      'boolean.base': 'kVA rating confirmed must be a boolean'
    }),
  
  physical: Joi.object({
    overall_condition: Joi.string()
      .valid('Good', 'Fair', 'Poor', 'Critical')
      .messages({
        'any.only': 'Invalid overall condition'
      }),
    
    rust_corrosion: Joi.string()
      .valid('None', 'Minor', 'Severe')
      .messages({
        'any.only': 'Invalid rust/corrosion status'
      }),
    
    oil_leakage: Joi.string()
      .valid('None', 'Slow Drip', 'Active Leak')
      .messages({
        'any.only': 'Invalid oil leakage status'
      }),
    
    bushing_condition: Joi.string()
      .valid('Good', 'Cracked', 'Broken')
      .messages({
        'any.only': 'Invalid bushing condition'
      }),
    
    tank_body_damage: Joi.string()
      .valid('None', 'Dents', 'Puncture')
      .messages({
        'any.only': 'Invalid tank/body damage status'
      }),
    
    cooling_fins_condition: Joi.string()
      .valid('Good', 'Damaged', 'Blocked')
      .messages({
        'any.only': 'Invalid cooling fins condition'
      })
  }).optional(),
  
  oil_breather: Joi.object({
    oil_level: Joi.string()
      .valid('Full', 'Adequate', 'Low', 'Very Low')
      .messages({
        'any.only': 'Invalid oil level'
      }),
    
    silica_gel_color: Joi.string()
      .valid('Blue', 'Pink', 'White')
      .messages({
        'any.only': 'Invalid silica gel color'
      }),
    
    oil_test_required: Joi.boolean()
      .messages({
        'boolean.base': 'Oil test required must be a boolean'
      })
  }).optional(),
  
  electrical: Joi.object({
    load_current_a: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Load current A cannot be negative'
      }),
    
    load_current_b: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Load current B cannot be negative'
      }),
    
    load_current_c: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Load current C cannot be negative'
      }),
    
    voltage_hv_side: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'HV voltage cannot be negative'
      }),
    
    voltage_lv_side: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'LV voltage cannot be negative'
      })
  }).optional(),
  
  site_safety: Joi.object({
    security_fencing: Joi.string()
      .valid('Present', 'Damaged', 'Absent')
      .messages({
        'any.only': 'Invalid security fencing status'
      }),
    
    earthing: Joi.string()
      .valid('Present', 'Absent')
      .messages({
        'any.only': 'Invalid earthing status'
      }),
    
    warning_signs: Joi.string()
      .valid('Present', 'Absent')
      .messages({
        'any.only': 'Invalid warning signs status'
      }),
    
    vegetation_encroachment: Joi.string()
      .valid('None', 'Moderate', 'Severe')
      .messages({
        'any.only': 'Invalid vegetation encroachment status'
      }),
    
    unauthorised_connections: Joi.boolean()
      .messages({
        'boolean.base': 'Unauthorised connections must be a boolean'
      })
  }).optional(),
  
  condition_narrative: Joi.string()
    .optional()
    .max(2000)
    .trim()
    .messages({
      'string.max': 'Condition narrative cannot exceed 2000 characters'
    }),
  
  recommended_action: Joi.string()
    .valid('No Action', 'Monitor', 'Schedule Maintenance', 'Urgent Repair', 'Replace')
    .messages({
      'any.only': 'Invalid recommended action'
    }),
  
  recommended_action_details: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Recommended action details cannot exceed 500 characters'
    })
});

/**
 * Inspection query schema
 */
const inspectionQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Page must be at least 1',
      'number.integer': 'Page must be a whole number'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
      'number.integer': 'Limit must be a whole number'
    }),
  
  transformer_id: Joi.string()
    .optional(),
  
  inspector_id: Joi.string()
    .optional(),
  
  visit_type: Joi.string()
    .valid('Routine Inspection', 'Follow-up', 'Audit')
    .optional()
    .messages({
      'any.only': 'Invalid visit type'
    }),
  
  condition: Joi.string()
    .valid('Good', 'Fair', 'Poor', 'Critical')
    .optional()
    .messages({
      'any.only': 'Invalid condition'
    }),
  
  overloaded: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Overloaded must be a boolean'
    }),
  
  recommended_action: Joi.string()
    .valid('No Action', 'Monitor', 'Schedule Maintenance', 'Urgent Repair', 'Replace')
    .optional()
    .messages({
      'any.only': 'Invalid recommended action'
    }),
  
  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid start date'
    }),
  
  endDate: Joi.date()
    .optional()
    .min(Joi.ref('startDate'))
    .messages({
      'date.min': 'End date must be after start date'
    })
});

module.exports = {
  createInspectionSchema,
  updateInspectionSchema,
  inspectionQuerySchema
};