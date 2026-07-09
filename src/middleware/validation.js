const Joi = require('joi');
const { errorResponse } = require('../utils/helpers');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source] || {}, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return errorResponse(res, 400, 'Validation failed', errors);
    }

    req[source] = value;
    
    next();
  };
};

// Example validation schemas
const createTransformerSchema = Joi.object({
  manufacturer: Joi.string().required(),
  serial_number: Joi.string(),
  kva_rating: Joi.number().valid(50, 100, 160, 200, 250, 315, 500, 630, 1000).required(),
  network_voltage_kv: Joi.number().valid(11, 33).required(),
  voltage_secondary: Joi.string().valid('415V', '240V', 'Other'),
  phase_type: Joi.string().valid('Single Phase', 'Three Phase'),
  cooling_type: Joi.string().valid('ONAN', 'ONAF', 'OFAF'),
  mounting_type: Joi.string().valid('Pole Mounted', 'Plinth', 'Ground', 'Indoor Substation'),
  territory_id: Joi.string().required(),
  service_area_id: Joi.string(),
  feeder_name: Joi.string(),
  district_id: Joi.string().required(),
  site_name: Joi.string().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  install_date: Joi.date(),
  installing_contractor: Joi.string()
});

const reportFaultSchema = Joi.object({
  transformer_id: Joi.string().required(),
  fault_date: Joi.date().default(Date.now),
  fault_description: Joi.string().required().min(10),
  fault_type: Joi.string().valid(
    'Overload', 'Oil Leak', 'Bushing Failure', 'Winding Failure',
    'Complete Failure', 'Fire', 'Theft', 'Vandalism',
    'LV Side Fault', 'HV Side Fault', 'Other'
  ).required(),
  severity: Joi.string().valid('Minor', 'Major', 'Critical', 'Complete Outage').required(),
  fault_source: Joi.string().valid('Field Observation', 'Customer Report', 'Supervisor'),
  customers_affected: Joi.number().integer().min(0),
  area_affected: Joi.string()
});

module.exports = { validate, createTransformerSchema, reportFaultSchema };
