const Joi = require('joi');
const { reportQuerySchema } = require('./reportValidator');

const exportFiltersSchema = reportQuerySchema.fork(['format'], (schema) => schema.optional().strip());

const exportOptionsSchema = Joi.object({
  report_type: Joi.string().valid('transformers', 'inspections', 'faults', 'maintenance', 'asset-register').required(),
  filters: exportFiltersSchema.default({})
});

const exportFormatParamSchema = Joi.object({
  format: Joi.string().valid('csv', 'json').required()
});

module.exports = { exportOptionsSchema, exportFormatParamSchema };
