const ServiceArea = require('../models/ServiceArea');
const { asyncHandler, successResponse } = require('../utils/helpers');
const { ApiError } = require('../utils/error');

const getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = parseInt(page);
  const lim = parseInt(limit);
  const skip = (p - 1) * lim;

  const [data, total] = await Promise.all([
    ServiceArea.find().skip(skip).limit(lim).sort({ name: 1 }),
    ServiceArea.countDocuments()
  ]);

  return successResponse(res, 200, 'Service areas retrieved successfully', {
    data,
    pagination: { page: p, limit: lim, total, pages: Math.ceil(total / lim) }
  });
});

const getById = asyncHandler(async (req, res) => {
  const serviceArea = await ServiceArea.findById(req.params.id);
  if (!serviceArea) throw new ApiError(404, 'Service area not found');
  return successResponse(res, 200, 'Service area retrieved successfully', serviceArea);
});

const getByTerritory = asyncHandler(async (req, res) => {
  const serviceAreas = await ServiceArea.find({ territory_id: req.params.territoryId }).sort({ name: 1 });
  return successResponse(res, 200, 'Service areas retrieved successfully', serviceAreas);
});

const create = asyncHandler(async (req, res) => {
  const serviceArea = new ServiceArea(req.body);
  await serviceArea.save();
  return successResponse(res, 201, 'Service area created successfully', serviceArea);
});

const update = asyncHandler(async (req, res) => {
  const serviceArea = await ServiceArea.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!serviceArea) throw new ApiError(404, 'Service area not found');
  return successResponse(res, 200, 'Service area updated successfully', serviceArea);
});

// Hard delete — ServiceArea model has no is_deleted field.
const del = asyncHandler(async (req, res) => {
  const serviceArea = await ServiceArea.findByIdAndDelete(req.params.id);
  if (!serviceArea) throw new ApiError(404, 'Service area not found');
  return successResponse(res, 200, 'Service area deleted successfully');
});

module.exports = { getAll, getById, getByTerritory, create, update, delete: del };
