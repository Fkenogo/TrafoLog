const Joi = require('joi');

/**
 * Import transformers schema (for file upload validation)
 */
const importTransformersSchema = Joi.object({
  file: Joi.any()
    .required()
    .messages({
      'any.required': 'File is required'
    })
});

/**
 * Import inspections schema
 */
const importInspectionsSchema = Joi.object({
  file: Joi.any()
    .required()
    .messages({
      'any.required': 'File is required'
    })
});

/**
 * Import validation schema (for preview)
 */
const importValidationSchema = Joi.object({
  skipDuplicates: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Skip duplicates must be a boolean'
    }),
  
  autoVerify: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Auto verify must be a boolean'
    }),
  
  dryRun: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'Dry run must be a boolean'
    })
});

/**
 * Transformer row validation (for import)
 */
const transformerImportRowSchema = Joi.object({
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
  
  territory_name: Joi.string()
    .required()
    .max(100)
    .trim()
    .messages({
      'any.required': 'Territory name is required',
      'string.empty': 'Territory name cannot be empty',
      'string.max': 'Territory name cannot exceed 100 characters'
    }),
  
  service_area_name: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Service area name cannot exceed 100 characters'
    }),
  
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
  
  district_name: Joi.string()
    .required()
    .max(100)
    .trim()
    .messages({
      'any.required': 'District name is required',
      'string.empty': 'District name cannot be empty',
      'string.max': 'District name cannot exceed 100 characters'
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
  
  year_manufactured: Joi.number()
    .optional()
    .min(1900)
    .max(new Date().getFullYear())
    .messages({
      'number.min': 'Year manufactured must be 1900 or later',
      'number.max': `Year manufactured cannot be later than ${new Date().getFullYear()}`
    })
});

/**
 * Inspection import row validation
 */
const inspectionImportRowSchema = Joi.object({
  asset_id: Joi.string()
    .required()
    .pattern(/^TRF-\d{6}$/)
    .messages({
      'any.required': 'Asset ID is required',
      'string.empty': 'Asset ID cannot be empty',
      'string.pattern.base': 'Invalid asset ID format. Must be TRF-000001'
    }),
  
  inspection_date: Joi.date()
    .required()
    .max('now')
    .messages({
      'any.required': 'Inspection date is required',
      'date.max': 'Inspection date cannot be in the future'
    }),
  
  visit_type: Joi.string()
    .valid('Routine Inspection', 'Follow-up', 'Audit')
    .default('Routine Inspection')
    .messages({
      'any.only': 'Invalid visit type'
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
  
  load_percentage: Joi.number()
    .optional()
    .min(0)
    .max(100)
    .messages({
      'number.min': 'Load percentage must be between 0 and 100',
      'number.max': 'Load percentage must be between 0 and 100'
    }),
  
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
    })
});

/**
 * Import query schema
 */
const importQuerySchema = Joi.object({
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
  
  status: Joi.string()
    .valid('pending', 'processing', 'completed', 'failed')
    .optional()
    .messages({
      'any.only': 'Invalid status'
    }),
  
  import_type: Joi.string()
    .valid('transformers', 'inspections', 'maintenance')
    .optional()
    .messages({
      'any.only': 'Invalid import type'
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
  importTransformersSchema,
  importInspectionsSchema,
  importValidationSchema,
  transformerImportRowSchema,
  inspectionImportRowSchema,
  importQuerySchema
};