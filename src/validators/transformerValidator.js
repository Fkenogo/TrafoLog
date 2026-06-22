const Joi = require('joi');

/**
 * Create transformer schema
 */
const createTransformerSchema = Joi.object({
  // Identity
  manufacturer: Joi.string()
    .required()
    .max(100)
    .trim()
    .messages({
      'any.required': 'Manufacturer is required',
      'string.empty': 'Manufacturer cannot be empty',
      'string.max': 'Manufacturer cannot exceed 100 characters'
    }),
  
  serial_number: Joi.string()
    .optional()
    .max(50)
    .trim()
    .messages({
      'string.max': 'Serial number cannot exceed 50 characters'
    }),
  
  year_manufactured: Joi.number()
    .optional()
    .min(1900)
    .max(new Date().getFullYear())
    .messages({
      'number.min': 'Year manufactured must be 1900 or later',
      'number.max': `Year manufactured cannot be later than ${new Date().getFullYear()}`
    }),
  
  uedcl_reference: Joi.string()
    .optional()
    .max(50)
    .trim()
    .messages({
      'string.max': 'UEDCL reference cannot exceed 50 characters'
    }),
  
  // Rating
  rating_id: Joi.string()
    .optional(),
  
  kva_rating: Joi.number()
    .required()
    .valid(50, 100, 160, 200, 250, 315, 500, 630, 1000)
    .messages({
      'any.required': 'kVA rating is required',
      'any.only': 'Invalid kVA rating. Must be one of: 50, 100, 160, 200, 250, 315, 500, 630, 1000'
    }),
  
  network_voltage_kv: Joi.number()
    .required()
    .valid(11, 33)
    .messages({
      'any.required': 'Network voltage is required',
      'any.only': 'Network voltage must be 11 or 33'
    }),
  
  // Electrical Specifications
  voltage_secondary: Joi.string()
    .valid('415V', '240V', 'Other')
    .default('415V')
    .messages({
      'any.only': 'Invalid secondary voltage'
    }),
  
  phase_type: Joi.string()
    .valid('Single Phase', 'Three Phase')
    .default('Three Phase')
    .messages({
      'any.only': 'Invalid phase type'
    }),
  
  cooling_type: Joi.string()
    .valid('ONAN', 'ONAF', 'OFAF')
    .default('ONAN')
    .messages({
      'any.only': 'Invalid cooling type'
    }),
  
  mounting_type: Joi.string()
    .valid('Pole Mounted', 'Plinth', 'Ground', 'Indoor Substation')
    .default('Pole Mounted')
    .messages({
      'any.only': 'Invalid mounting type'
    }),
  
  vector_group: Joi.string()
    .optional()
    .uppercase()
    .max(10)
    .trim()
    .messages({
      'string.max': 'Vector group cannot exceed 10 characters'
    }),
  
  // Operational Location
  territory_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Territory ID is required',
      'string.empty': 'Territory ID cannot be empty'
    }),
  
  service_area_id: Joi.string()
    .optional(),
  
  feeder_id: Joi.string()
    .optional(),
  
  feeder_name: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Feeder name cannot exceed 100 characters'
    }),
  
  feeder_code: Joi.string()
    .optional()
    .max(20)
    .uppercase()
    .trim()
    .messages({
      'string.max': 'Feeder code cannot exceed 20 characters'
    }),
  
  substation_name: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Substation name cannot exceed 100 characters'
    }),
  
  // Administrative Location
  district_id: Joi.string()
    .required()
    .messages({
      'any.required': 'District ID is required',
      'string.empty': 'District ID cannot be empty'
    }),
  
  sub_county: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Sub-county cannot exceed 100 characters'
    }),
  
  parish: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Parish cannot exceed 100 characters'
    }),
  
  village: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Village cannot exceed 100 characters'
    }),
  
  site_name: Joi.string()
    .required()
    .max(200)
    .trim()
    .messages({
      'any.required': 'Site name is required',
      'string.empty': 'Site name cannot be empty',
      'string.max': 'Site name cannot exceed 200 characters'
    }),
  
  // GPS
  latitude: Joi.number()
    .required()
    .min(-90)
    .max(90)
    .messages({
      'any.required': 'Latitude is required',
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90'
    }),
  
  longitude: Joi.number()
    .required()
    .min(-180)
    .max(180)
    .messages({
      'any.required': 'Longitude is required',
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180'
    }),
  
  gps_method: Joi.string()
    .valid('Field Captured', 'Imported', 'Estimated')
    .default('Field Captured')
    .messages({
      'any.only': 'Invalid GPS method'
    }),
  
  gps_accuracy: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'GPS accuracy cannot be negative'
    }),
  
  // Installation
  install_date: Joi.date()
    .optional()
    .max('now')
    .messages({
      'date.max': 'Install date cannot be in the future'
    }),
  
  installing_contractor: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Installing contractor cannot exceed 100 characters'
    }),
  
  commissioned_by: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Commissioned by cannot exceed 100 characters'
    }),
  
  commissioning_date: Joi.date()
    .optional()
    .max('now')
    .messages({
      'date.max': 'Commissioning date cannot be in the future'
    }),
  
  warranty_expiry: Joi.date()
    .optional()
    .max(Joi.ref('commissioning_date') || 'now')
    .messages({
      'date.max': 'Warranty expiry cannot be before commissioning date'
    })
});

/**
 * Update transformer schema
 */
const updateTransformerSchema = Joi.object({
  manufacturer: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Manufacturer cannot exceed 100 characters'
    }),
  
  serial_number: Joi.string()
    .max(50)
    .trim()
    .messages({
      'string.max': 'Serial number cannot exceed 50 characters'
    }),
  
  year_manufactured: Joi.number()
    .min(1900)
    .max(new Date().getFullYear())
    .messages({
      'number.min': 'Year manufactured must be 1900 or later',
      'number.max': `Year manufactured cannot be later than ${new Date().getFullYear()}`
    }),
  
  uedcl_reference: Joi.string()
    .max(50)
    .trim()
    .messages({
      'string.max': 'UEDCL reference cannot exceed 50 characters'
    }),
  
  kva_rating: Joi.number()
    .valid(50, 100, 160, 200, 250, 315, 500, 630, 1000)
    .messages({
      'any.only': 'Invalid kVA rating'
    }),
  
  network_voltage_kv: Joi.number()
    .valid(11, 33)
    .messages({
      'any.only': 'Network voltage must be 11 or 33'
    }),
  
  voltage_secondary: Joi.string()
    .valid('415V', '240V', 'Other')
    .messages({
      'any.only': 'Invalid secondary voltage'
    }),
  
  phase_type: Joi.string()
    .valid('Single Phase', 'Three Phase')
    .messages({
      'any.only': 'Invalid phase type'
    }),
  
  cooling_type: Joi.string()
    .valid('ONAN', 'ONAF', 'OFAF')
    .messages({
      'any.only': 'Invalid cooling type'
    }),
  
  mounting_type: Joi.string()
    .valid('Pole Mounted', 'Plinth', 'Ground', 'Indoor Substation')
    .messages({
      'any.only': 'Invalid mounting type'
    }),
  
  vector_group: Joi.string()
    .uppercase()
    .max(10)
    .trim()
    .messages({
      'string.max': 'Vector group cannot exceed 10 characters'
    }),
  
  territory_id: Joi.string()
    .messages({
      'string.empty': 'Territory ID cannot be empty'
    }),
  
  service_area_id: Joi.string()
    .optional(),
  
  feeder_id: Joi.string()
    .optional(),
  
  feeder_name: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Feeder name cannot exceed 100 characters'
    }),
  
  feeder_code: Joi.string()
    .max(20)
    .uppercase()
    .trim()
    .messages({
      'string.max': 'Feeder code cannot exceed 20 characters'
    }),
  
  substation_name: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Substation name cannot exceed 100 characters'
    }),
  
  district_id: Joi.string()
    .messages({
      'string.empty': 'District ID cannot be empty'
    }),
  
  sub_county: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Sub-county cannot exceed 100 characters'
    }),
  
  parish: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Parish cannot exceed 100 characters'
    }),
  
  village: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Village cannot exceed 100 characters'
    }),
  
  site_name: Joi.string()
    .max(200)
    .trim()
    .messages({
      'string.max': 'Site name cannot exceed 200 characters'
    }),
  
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90'
    }),
  
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180'
    }),
  
  gps_method: Joi.string()
    .valid('Field Captured', 'Imported', 'Estimated')
    .messages({
      'any.only': 'Invalid GPS method'
    }),
  
  gps_accuracy: Joi.number()
    .min(0)
    .messages({
      'number.min': 'GPS accuracy cannot be negative'
    }),
  
  install_date: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Install date cannot be in the future'
    }),
  
  installing_contractor: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Installing contractor cannot exceed 100 characters'
    }),
  
  commissioned_by: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Commissioned by cannot exceed 100 characters'
    }),
  
  commissioning_date: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Commissioning date cannot be in the future'
    }),
  
  warranty_expiry: Joi.date()
    .max(Joi.ref('commissioning_date') || 'now')
    .messages({
      'date.max': 'Warranty expiry cannot be before commissioning date'
    })
});

/**
 * Search transformer schema
 */
const searchTransformerSchema = Joi.object({
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
  
  search: Joi.string()
    .optional()
    .trim()
    .messages({
      'string.empty': 'Search term cannot be empty'
    }),
  
  territory_id: Joi.string()
    .optional(),
  
  service_area_id: Joi.string()
    .optional(),
  
  network_voltage_kv: Joi.number()
    .valid(11, 33)
    .optional()
    .messages({
      'any.only': 'Network voltage must be 11 or 33'
    }),
  
  kva_rating: Joi.number()
    .valid(50, 100, 160, 200, 250, 315, 500, 630, 1000)
    .optional()
    .messages({
      'any.only': 'Invalid kVA rating'
    }),
  
  operational_status: Joi.string()
    .valid('Active', 'Faulty', 'Under Maintenance', 'Decommissioned', 'Unverified')
    .optional()
    .messages({
      'any.only': 'Invalid operational status'
    }),
  
  record_status: Joi.string()
    .valid('Draft', 'Verified', 'Active')
    .optional()
    .messages({
      'any.only': 'Invalid record status'
    }),
  
  district_id: Joi.string()
    .optional(),
  
  condition: Joi.string()
    .valid('Good', 'Fair', 'Poor', 'Critical')
    .optional()
    .messages({
      'any.only': 'Invalid condition'
    }),
  
  has_open_fault: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Has open fault must be a boolean'
    }),
  
  latitude: Joi.number()
    .optional()
    .min(-90)
    .max(90)
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90'
    }),
  
  longitude: Joi.number()
    .optional()
    .min(-180)
    .max(180)
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180'
    }),
  
  radius: Joi.number()
    .when('latitude', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .min(0.1)
    .max(100)
    .messages({
      'any.required': 'Radius is required when latitude is provided',
      'number.min': 'Radius must be at least 0.1 km',
      'number.max': 'Radius cannot exceed 100 km'
    }),
  
  sortBy: Joi.string()
    .valid('created_at', 'updated_at', 'asset_id', 'kva_rating', 'last_inspection_date')
    .default('created_at')
    .messages({
      'any.only': 'Invalid sort field'
    }),
  
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Sort order must be asc or desc'
    })
});

/**
 * Bulk create transformer schema
 */
const bulkCreateTransformerSchema = Joi.array()
  .items(createTransformerSchema)
  .min(1)
  .max(100)
  .required()
  .messages({
    'array.min': 'At least one transformer must be provided',
    'array.max': 'Cannot create more than 100 transformers at once',
    'any.required': 'Transformers array is required'
  });

/**
 * Verify transformer schema
 */
const verifyTransformerSchema = Joi.object({
  verify_notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Verify notes cannot exceed 500 characters'
    })
});

/**
 * Decommission transformer schema
 */
const decommissionTransformerSchema = Joi.object({
  reason: Joi.string()
    .required()
    .valid('End of Life', 'Damaged', 'Theft', 'Vandalism', 'Replaced', 'Other')
    .messages({
      'any.required': 'Decommission reason is required',
      'any.only': 'Invalid decommission reason'
    }),
  
  notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
});

module.exports = {
  createTransformerSchema,
  updateTransformerSchema,
  searchTransformerSchema,
  bulkCreateTransformerSchema,
  verifyTransformerSchema,
  decommissionTransformerSchema
};