const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const auditQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  action: Joi.string().trim(),
  action_category: Joi.string().valid(
    'AUTH',
    'USER_MANAGEMENT',
    'TRANSFORMER_MANAGEMENT',
    'INSPECTION',
    'FAULT_MANAGEMENT',
    'MAINTENANCE',
    'INSTALLATION',
    'REPORTING',
    'IMPORT',
    'EXPORT',
    'SYSTEM'
  ),
  user_id: objectId,
  target_type: Joi.string().valid('User', 'Transformer', 'Inspection', 'Fault', 'Maintenance', 'Installation', 'Report'),
  target_id: objectId,
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  is_sensitive: Joi.boolean()
});

module.exports = { auditQuerySchema };
