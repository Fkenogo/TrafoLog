const Joi = require('joi');

const maintenanceModeSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Maintenance mode status is required',
      'boolean.base': 'Maintenance mode status must be true or false'
    }),
  message: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Maintenance message cannot exceed 500 characters'
    }),
  reason: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .optional()
    .messages({
      'string.max': 'Maintenance reason cannot exceed 500 characters'
    })
});

const backupName = Joi.string()
  .trim()
  .min(3)
  .max(80)
  .pattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  .messages({
    'string.min': 'Backup name must be at least 3 characters',
    'string.max': 'Backup name cannot exceed 80 characters',
    'string.pattern.base': 'Backup name may contain only letters, numbers, hyphens, and underscores, and must start with a letter or number'
  });

const backupRequestSchema = Joi.object({
  backup_name: backupName.default('backup'),
  retention_until: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Retention date must be in the future'
    }),
  collections: Joi.array()
    .items(Joi.string().trim().min(1).max(120))
    .min(1)
    .optional()
    .messages({
      'array.min': 'At least one collection is required when filtering collections'
    }),
  metadata: Joi.object()
    .unknown(true)
    .default({})
});

const backupQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),
  status: Joi.string()
    .valid('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')
    .optional()
});

const restoreRequestSchema = Joi.object({
  confirmation: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Restore confirmation is required'
    }),
  dryRun: Joi.boolean()
    .default(true),
  collections: Joi.array()
    .items(Joi.string().trim().min(1).max(120))
    .min(1)
    .optional()
    .messages({
      'array.min': 'At least one collection is required when filtering restore collections'
    })
});

module.exports = {
  maintenanceModeSchema,
  backupRequestSchema,
  backupQuerySchema,
  restoreRequestSchema
};
