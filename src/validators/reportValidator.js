const Joi = require('joi');

const reportQuerySchema = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
  territory_id: Joi.string(),
  format: Joi.string().valid('excel', 'pdf', 'csv').default('excel')
});

const exportOptionsSchema = Joi.object({
  format: Joi.string().valid('excel', 'pdf', 'csv').default('excel'),
  filters: Joi.object()
});

module.exports = { reportQuerySchema, exportOptionsSchema };
