const Territory = require('../models/Territory');
const { asyncHandler, successResponse } = require('../utils/helpers');
const { ApiError } = require('../utils/error');

const getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = parseInt(page);
  const lim = parseInt(limit);
  const skip = (p - 1) * lim;

  const [data, total] = await Promise.all([
    Territory.find().skip(skip).limit(lim).sort({ name: 1 }),
    Territory.countDocuments()
  ]);

  return successResponse(res, 200, 'Territories retrieved successfully', {
    data,
    pagination: { page: p, limit: lim, total, pages: Math.ceil(total / lim) }
  });
});

const getById = asyncHandler(async (req, res) => {
  const territory = await Territory.findById(req.params.id);
  if (!territory) throw new ApiError(404, 'Territory not found');
  return successResponse(res, 200, 'Territory retrieved successfully', territory);
});

const create = asyncHandler(async (req, res) => {
  const territory = new Territory(req.body);
  await territory.save();
  return successResponse(res, 201, 'Territory created successfully', territory);
});

const update = asyncHandler(async (req, res) => {
  const territory = await Territory.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!territory) throw new ApiError(404, 'Territory not found');
  return successResponse(res, 200, 'Territory updated successfully', territory);
});

// Hard delete — Territory model has no is_deleted field.
const del = asyncHandler(async (req, res) => {
  const territory = await Territory.findByIdAndDelete(req.params.id);
  if (!territory) throw new ApiError(404, 'Territory not found');
  return successResponse(res, 200, 'Territory deleted successfully');
});

module.exports = { getAll, getById, create, update, delete: del };
