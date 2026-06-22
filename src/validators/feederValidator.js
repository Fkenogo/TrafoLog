const Joi = require('joi');

const createFeederSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string(),
  territory_id: Joi.string().required(),
  voltage_kv: Joi.number().valid(11, 33)
});

const updateFeederSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  territory_id: Joi.string(),
  voltage_kv: Joi.number().valid(11, 33)
});

module.exports = { createFeederSchema, updateFeederSchema };
