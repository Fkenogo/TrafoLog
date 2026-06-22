const Joi = require('joi');

/**
 * Create fault validation schema
 */
const createFaultSchema = Joi.object({
  transformer_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Transformer ID is required',
      'string.empty': 'Transformer ID cannot be empty'
    }),
  
  fault_date: Joi.date()
    .default(Date.now)
    .max('now')
    .messages({
      'date.max': 'Fault date cannot be in the future'
    }),
  
  fault_source: Joi.string()
    .valid('Field Observation', 'Customer Report', 'Supervisor')
    .default('Field Observation')
    .messages({
      'any.only': 'Fault source must be one of: Field Observation, Customer Report, Supervisor'
    }),
  
  fault_description: Joi.string()
    .required()
    .min(10)
    .max(2000)
    .trim()
    .messages({
      'any.required': 'Fault description is required',
      'string.empty': 'Fault description cannot be empty',
      'string.min': 'Fault description must be at least 10 characters',
      'string.max': 'Fault description cannot exceed 2000 characters'
    }),
  
  fault_type: Joi.string()
    .required()
    .valid(
      'Overload',
      'Oil Leak',
      'Bushing Failure',
      'Winding Failure',
      'Complete Failure',
      'Fire',
      'Theft',
      'Vandalism',
      'LV Side Fault',
      'HV Side Fault',
      'Other'
    )
    .messages({
      'any.required': 'Fault type is required',
      'any.only': 'Invalid fault type'
    }),
  
  severity: Joi.string()
    .required()
    .valid('Minor', 'Major', 'Critical', 'Complete Outage')
    .messages({
      'any.required': 'Severity is required',
      'any.only': 'Invalid severity level'
    }),
  
  network_voltage_kv: Joi.number()
    .valid(11, 33)
    .optional()
    .messages({
      'any.only': 'Network voltage must be 11 or 33'
    }),
  
  customers_affected: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Customers affected cannot be negative',
      'number.integer': 'Customers affected must be a whole number'
    }),
  
  area_affected: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Area affected cannot exceed 500 characters'
    })
});

/**
 * Update fault schema
 */
const updateFaultSchema = Joi.object({
  fault_description: Joi.string()
    .min(10)
    .max(2000)
    .trim()
    .messages({
      'string.min': 'Fault description must be at least 10 characters',
      'string.max': 'Fault description cannot exceed 2000 characters'
    }),
  
  fault_type: Joi.string()
    .valid(
      'Overload',
      'Oil Leak',
      'Bushing Failure',
      'Winding Failure',
      'Complete Failure',
      'Fire',
      'Theft',
      'Vandalism',
      'LV Side Fault',
      'HV Side Fault',
      'Other'
    )
    .messages({
      'any.only': 'Invalid fault type'
    }),
  
  severity: Joi.string()
    .valid('Minor', 'Major', 'Critical', 'Complete Outage')
    .messages({
      'any.only': 'Invalid severity level'
    }),
  
  customers_affected: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Customers affected cannot be negative',
      'number.integer': 'Customers affected must be a whole number'
    }),
  
  area_affected: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Area affected cannot exceed 500 characters'
    })
});

/**
 * Assign fault schema
 */
const assignFaultSchema = Joi.object({
  assigned_to: Joi.string()
    .required()
    .messages({
      'any.required': 'Assigned to user ID is required',
      'string.empty': 'Assigned to user ID cannot be empty'
    }),
  
  target_resolution_date: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Target resolution date must be in the future'
    })
});

/**
 * Resolve fault schema
 */
const resolveFaultSchema = Joi.object({
  resolution_description: Joi.string()
    .required()
    .min(10)
    .max(2000)
    .trim()
    .messages({
      'any.required': 'Resolution description is required',
      'string.empty': 'Resolution description cannot be empty',
      'string.min': 'Resolution description must be at least 10 characters',
      'string.max': 'Resolution description cannot exceed 2000 characters'
    }),
  
  root_cause: Joi.string()
    .max(1000)
    .trim()
    .optional()
    .messages({
      'string.max': 'Root cause cannot exceed 1000 characters'
    }),
  
  parts_replaced: Joi.string()
    .max(1000)
    .trim()
    .optional()
    .messages({
      'string.max': 'Parts replaced cannot exceed 1000 characters'
    }),
  
  resolved_date: Joi.date()
    .default(Date.now)
    .max('now')
    .messages({
      'date.max': 'Resolved date cannot be in the future'
    })
});

/**
 * Close fault schema
 */
const closeFaultSchema = Joi.object({
  review_notes: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Review notes cannot exceed 500 characters'
    })
});

/**
 * Escalate fault schema
 */
const escalateFaultSchema = Joi.object({
  reason: Joi.string()
    .required()
    .min(10)
    .max(500)
    .trim()
    .messages({
      'any.required': 'Escalation reason is required',
      'string.empty': 'Escalation reason cannot be empty',
      'string.min': 'Escalation reason must be at least 10 characters',
      'string.max': 'Escalation reason cannot exceed 500 characters'
    })
});

/**
 * Fault query schema
 */
const faultQuerySchema = Joi.object({
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
  
  status: Joi.string()
    .valid('Open', 'Assigned', 'In Progress', 'Resolved', 'Closed')
    .optional()
    .messages({
      'any.only': 'Invalid status'
    }),
  
  severity: Joi.string()
    .valid('Minor', 'Major', 'Critical', 'Complete Outage')
    .optional()
    .messages({
      'any.only': 'Invalid severity'
    }),
  
  fault_type: Joi.string()
    .valid(
      'Overload',
      'Oil Leak',
      'Bushing Failure',
      'Winding Failure',
      'Complete Failure',
      'Fire',
      'Theft',
      'Vandalism',
      'LV Side Fault',
      'HV Side Fault',
      'Other'
    )
    .optional()
    .messages({
      'any.only': 'Invalid fault type'
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
    }),
  
  assigned_to: Joi.string()
    .optional()
});

module.exports = {
  createFaultSchema,
  updateFaultSchema,
  assignFaultSchema,
  resolveFaultSchema,
  closeFaultSchema,
  escalateFaultSchema,
  faultQuerySchema
};