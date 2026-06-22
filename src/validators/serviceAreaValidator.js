const Joi = require('joi');

const createServiceAreaSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string(),
  territory_id: Joi.string().required()
});

const updateServiceAreaSchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  territory_id: Joi.string()
});

module.exports = { createServiceAreaSchema, updateServiceAreaSchema };
