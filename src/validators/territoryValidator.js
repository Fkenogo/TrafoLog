const Joi = require('joi');

const createTerritorySchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().required(),
  region: Joi.string()
});

const updateTerritorySchema = Joi.object({
  name: Joi.string(),
  code: Joi.string(),
  region: Joi.string()
});

module.exports = { createTerritorySchema, updateTerritorySchema };
