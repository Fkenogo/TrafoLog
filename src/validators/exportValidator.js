const Joi = require('joi');

const exportOptionsSchema = Joi.object({
  format: Joi.string().valid('excel', 'pdf', 'csv').default('excel'),
  filters: Joi.object()
});

module.exports = { exportOptionsSchema };
