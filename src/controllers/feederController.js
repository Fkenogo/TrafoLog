const Feeder = require('../models/Feeder');
const { asyncHandler, successResponse } = require('../utils/helpers');
const { ApiError } = require('../utils/error');

const getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = parseInt(page);
  const lim = parseInt(limit);
  const skip = (p - 1) * lim;

  const [data, total] = await Promise.all([
    Feeder.find().skip(skip).limit(lim).sort({ name: 1 }),
    Feeder.countDocuments()
  ]);

  return successResponse(res, 200, 'Feeders retrieved successfully', {
    data,
    pagination: { page: p, limit: lim, total, pages: Math.ceil(total / lim) }
  });
});

const getById = asyncHandler(async (req, res) => {
  const feeder = await Feeder.findById(req.params.id);
  if (!feeder) throw new ApiError(404, 'Feeder not found');
  return successResponse(res, 200, 'Feeder retrieved successfully', feeder);
});

const getByServiceArea = asyncHandler(async (req, res) => {
  const feeders = await Feeder.find({ service_area_id: req.params.serviceAreaId }).sort({ name: 1 });
  return successResponse(res, 200, 'Feeders retrieved successfully', feeders);
});

const create = asyncHandler(async (req, res) => {
  const feeder = new Feeder(req.body);
  await feeder.save();
  return successResponse(res, 201, 'Feeder created successfully', feeder);
});

const update = asyncHandler(async (req, res) => {
  const feeder = await Feeder.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!feeder) throw new ApiError(404, 'Feeder not found');
  return successResponse(res, 200, 'Feeder updated successfully', feeder);
});

// Hard delete — Feeder model has no is_deleted field.
const del = asyncHandler(async (req, res) => {
  const feeder = await Feeder.findByIdAndDelete(req.params.id);
  if (!feeder) throw new ApiError(404, 'Feeder not found');
  return successResponse(res, 200, 'Feeder deleted successfully');
});

module.exports = { getAll, getById, getByServiceArea, create, update, delete: del };
