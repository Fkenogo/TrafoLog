const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  territory_id: objectId,
  service_area_id: objectId,
  feeder_id: objectId,
  district_id: objectId,
  network_voltage_kv: Joi.number().valid(11, 33),
  kva_rating: Joi.number().valid(50, 100, 160, 200, 250, 315, 500, 630, 1000)
});

module.exports = { analyticsQuerySchema };
