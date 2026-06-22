const Joi = require('joi');

/**
 * Create installation schema
 */
const createInstallationSchema = Joi.object({
  transformer_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Transformer ID is required',
      'string.empty': 'Transformer ID cannot be empty'
    }),
  
  installation_date: Joi.date()
    .default(Date.now)
    .max('now')
    .messages({
      'date.max': 'Installation date cannot be in the future'
    }),
  
  installation_type: Joi.string()
    .required()
    .valid('New Installation', 'Replacement', 'Relocation')
    .messages({
      'any.required': 'Installation type is required',
      'any.only': 'Invalid installation type'
    }),
  
  previous_transformer_id: Joi.string()
    .when('installation_type', {
      is: 'Replacement',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Previous transformer ID is required for replacement'
    }),
  
  replacement_reason: Joi.string()
    .when('installation_type', {
      is: 'Replacement',
      then: Joi.required()
        .valid('Overload', 'Failure', 'Upgrade', 'Load Split', 'Other'),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Replacement reason is required for replacement',
      'any.only': 'Invalid replacement reason'
    }),
  
  replacement_reason_details: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Replacement reason details cannot exceed 500 characters'
    }),
  
  network_voltage_kv: Joi.number()
    .required()
    .valid(11, 33)
    .messages({
      'any.required': 'Network voltage is required',
      'any.only': 'Network voltage must be 11 or 33'
    }),
  
  kva_rating: Joi.number()
    .required()
    .valid(50, 100, 160, 200, 250, 315, 500, 630, 1000)
    .messages({
      'any.required': 'kVA rating is required',
      'any.only': 'Invalid kVA rating'
    }),
  
  previous_location: Joi.object({
    type: Joi.string()
      .valid('Point')
      .default('Point'),
    coordinates: Joi.array()
      .items(Joi.number())
      .length(2)
  }).optional(),
  
  previous_site_name: Joi.string()
    .optional()
    .max(200)
    .trim()
    .messages({
      'string.max': 'Previous site name cannot exceed 200 characters'
    }),
  
  installing_team: Joi.string()
    .required()
    .max(100)
    .trim()
    .messages({
      'any.required': 'Installing team is required',
      'string.empty': 'Installing team cannot be empty',
      'string.max': 'Installing team cannot exceed 100 characters'
    }),
  
  supervised_by: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Supervised by cannot exceed 100 characters'
    }),
  
  transformer_source: Joi.string()
    .valid('New Purchase', 'Refurbished', 'Transferred from Store')
    .default('New Purchase')
    .messages({
      'any.only': 'Invalid transformer source'
    }),
  
  source_reference: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Source reference cannot exceed 100 characters'
    }),
  
  pre_install_test_results: Joi.string()
    .optional()
    .max(1000)
    .trim()
    .messages({
      'string.max': 'Pre-install test results cannot exceed 1000 characters'
    }),
  
  commissioning_readings: Joi.string()
    .optional()
    .max(1000)
    .trim()
    .messages({
      'string.max': 'Commissioning readings cannot exceed 1000 characters'
    }),
  
  commissioned_by: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Commissioned by cannot exceed 100 characters'
    }),
  
  handover_date: Joi.date()
    .optional()
    .max('now')
    .messages({
      'date.max': 'Handover date cannot be in the future'
    }),
  
  test_report_url: Joi.string()
    .optional()
    .uri()
    .max(500)
    .messages({
      'string.uri': 'Invalid test report URL',
      'string.max': 'Test report URL cannot exceed 500 characters'
    }),
  
  installation_notes: Joi.string()
    .optional()
    .max(2000)
    .trim()
    .messages({
      'string.max': 'Installation notes cannot exceed 2000 characters'
    }),
  
  challenges_encountered: Joi.string()
    .optional()
    .max(1000)
    .trim()
    .messages({
      'string.max': 'Challenges encountered cannot exceed 1000 characters'
    })
});

/**
 * Update installation schema
 */
const updateInstallationSchema = Joi.object({
  installation_date: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Installation date cannot be in the future'
    }),
  
  installation_type: Joi.string()
    .valid('New Installation', 'Replacement', 'Relocation')
    .messages({
      'any.only': 'Invalid installation type'
    }),
  
  replacement_reason: Joi.string()
    .valid('Overload', 'Failure', 'Upgrade', 'Load Split', 'Other')
    .messages({
      'any.only': 'Invalid replacement reason'
    }),
  
  replacement_reason_details: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Replacement reason details cannot exceed 500 characters'
    }),
  
  network_voltage_kv: Joi.number()
    .valid(11, 33)
    .messages({
      'any.only': 'Network voltage must be 11 or 33'
    }),
  
  kva_rating: Joi.number()
    .valid(50, 100, 160, 200, 250, 315, 500, 630, 1000)
    .messages({
      'any.only': 'Invalid kVA rating'
    }),
  
  installing_team: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Installing team cannot exceed 100 characters'
    }),
  
  supervised_by: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Supervised by cannot exceed 100 characters'
    }),
  
  transformer_source: Joi.string()
    .valid('New Purchase', 'Refurbished', 'Transferred from Store')
    .messages({
      'any.only': 'Invalid transformer source'
    }),
  
  pre_install_test_results: Joi.string()
    .max(1000)
    .trim()
    .messages({
      'string.max': 'Pre-install test results cannot exceed 1000 characters'
    }),
  
  commissioning_readings: Joi.string()
    .max(1000)
    .trim()
    .messages({
      'string.max': 'Commissioning readings cannot exceed 1000 characters'
    }),
  
  commissioned_by: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Commissioned by cannot exceed 100 characters'
    }),
  
  handover_date: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Handover date cannot be in the future'
    }),
  
  installation_notes: Joi.string()
    .max(2000)
    .trim()
    .messages({
      'string.max': 'Installation notes cannot exceed 2000 characters'
    }),
  
  challenges_encountered: Joi.string()
    .max(1000)
    .trim()
    .messages({
      'string.max': 'Challenges encountered cannot exceed 1000 characters'
    })
});

/**
 * Installation query schema
 */
const installationQuerySchema = Joi.object({
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
  
  installation_type: Joi.string()
    .valid('New Installation', 'Replacement', 'Relocation')
    .optional()
    .messages({
      'any.only': 'Invalid installation type'
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
  createInstallationSchema,
  updateInstallationSchema,
  installationQuerySchema
};