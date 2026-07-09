const Joi = require('joi');

/**
 * Create user schema
 */
const createUserSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(100)
    .trim()
    .messages({
      'any.required': 'Name is required',
      'string.empty': 'Name cannot be empty',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  email: Joi.string()
    .required()
    .email()
    .messages({
      'any.required': 'Email is required',
      'string.empty': 'Email cannot be empty',
      'string.email': 'Please provide a valid email address'
    }),
  
  password: Joi.string()
    .required()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'any.required': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('password'))
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your password'
    }),
  
  phone: Joi.string()
    .optional()
    .pattern(/^[0-9]{10,15}$/)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number (10-15 digits)'
    }),
  
  role: Joi.string()
    .required()
    .valid('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer')
    .messages({
      'any.required': 'Role is required',
      'any.only': 'Invalid role'
    }),
  
  territory_id: Joi.string()
    .when('role', {
      is: Joi.string().valid('Territory Manager', 'Engineer', 'Field Technician'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Territory is required for this role'
    }),
  
  service_area_id: Joi.string()
    .when('role', {
      is: Joi.string().valid('Engineer', 'Field Technician'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Service area is required for this role'
    }),
  
  is_active: Joi.boolean()
    .default(true)
});

/**
 * Update user schema
 */
const updateUserSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  
  email: Joi.string()
    .email()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  
  phone: Joi.string()
    .optional()
    .pattern(/^[0-9]{10,15}$/)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number (10-15 digits)'
    }),
  
  territory_id: Joi.string()
    .optional(),
  
  service_area_id: Joi.string()
    .optional(),
  
  preferences: Joi.object({
    theme: Joi.string()
      .valid('light', 'dark', 'system')
      .messages({
        'any.only': 'Invalid theme'
      }),
    notifications: Joi.object({
      email: Joi.boolean(),
      push: Joi.boolean(),
      sms: Joi.boolean()
    }),
    dashboard_widgets: Joi.array()
      .items(Joi.string())
  }).optional()
});

/**
 * User query schema
 */
const userQuerySchema = Joi.object({
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
  
  role: Joi.string()
    .valid('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer')
    .optional()
    .messages({
      'any.only': 'Invalid role'
    }),
  
  territory_id: Joi.string()
    .optional(),
  
  service_area_id: Joi.string()
    .optional(),
  
  is_active: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'is_active must be a boolean'
    })
});

/**
 * Change user role schema
 */
const changeUserRoleSchema = Joi.object({
  role: Joi.string()
    .required()
    .valid('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer')
    .messages({
      'any.required': 'Role is required',
      'any.only': 'Invalid role'
    }),
  
  territory_id: Joi.string()
    .when('role', {
      is: Joi.string().valid('Territory Manager', 'Engineer', 'Field Technician'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Territory is required for this role'
    }),
  
  service_area_id: Joi.string()
    .when('role', {
      is: Joi.string().valid('Engineer', 'Field Technician'),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': 'Service area is required for this role'
    })
});

/**
 * Activate user schema
 */
const activateUserSchema = Joi.object({
  notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
});

/**
 * Deactivate user schema
 */
const deactivateUserSchema = Joi.object({
  reason: Joi.string()
    .required()
    .max(500)
    .trim()
    .messages({
      'any.required': 'Deactivation reason is required',
      'string.empty': 'Deactivation reason cannot be empty',
      'string.max': 'Reason cannot exceed 500 characters'
    })
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  changeUserRoleSchema,
  activateUserSchema,
  deactivateUserSchema
};
