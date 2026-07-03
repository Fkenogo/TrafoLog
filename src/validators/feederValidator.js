const Joi = require('joi');

const createFeederSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string(),
  service_area_id: Joi.string().required(),
  network_voltage_kv: Joi.number().valid(11, 33)
});

const updateFeederSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  service_area_id: Joi.string(),
  network_voltage_kv: Joi.number().valid(11, 33)
});

module.exports = { createFeederSchema, updateFeederSchema };
