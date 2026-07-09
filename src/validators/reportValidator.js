const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const reportQuerySchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  territory_id: objectId,
  service_area_id: objectId,
  feeder_id: objectId,
  district_id: objectId,
  transformer_id: objectId,
  network_voltage_kv: Joi.number().valid(11, 33),
  kva_rating: Joi.number().valid(50, 100, 160, 200, 250, 315, 500, 630, 1000),
  operational_status: Joi.string().valid('Active', 'Inactive', 'Decommissioned', 'Under Maintenance', 'Faulty'),
  fault_status: Joi.string().valid('Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'),
  severity: Joi.string().valid('Minor', 'Major', 'Critical', 'Complete Outage'),
  fault_type: Joi.string().valid(
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
  ),
  maintenance_type: Joi.string().valid('Preventive', 'Corrective', 'Emergency'),
  condition: Joi.string().valid('Good', 'Fair', 'Poor', 'Critical'),
  format: Joi.string().valid('json', 'excel', 'pdf').default('json')
});

const assetRegisterQuerySchema = reportQuerySchema.fork(
  ['fault_status', 'severity', 'fault_type', 'maintenance_type', 'condition', 'transformer_id'],
  (schema) => schema.optional().strip()
);

const exportOptionsSchema = Joi.object({
  report_type: Joi.string().valid('transformers', 'inspections', 'faults', 'maintenance', 'asset-register').required(),
  format: Joi.string().valid('excel', 'pdf').default('excel'),
  filters: reportQuerySchema.default({})
});

module.exports = { reportQuerySchema, assetRegisterQuerySchema, exportOptionsSchema };
