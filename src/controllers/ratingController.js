const TransformerRating = require('../models/TransformerRating');
const { asyncHandler, successResponse } = require('../utils/helpers');
const { ApiError } = require('../utils/error');

const getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = parseInt(page);
  const lim = parseInt(limit);
  const skip = (p - 1) * lim;

  const [data, total] = await Promise.all([
    TransformerRating.find().skip(skip).limit(lim).sort({ network_voltage_kv: 1, kva: 1 }),
    TransformerRating.countDocuments()
  ]);

  return successResponse(res, 200, 'Ratings retrieved successfully', {
    data,
    pagination: { page: p, limit: lim, total, pages: Math.ceil(total / lim) }
  });
});

const getByNetworkVoltage = asyncHandler(async (req, res) => {
  const voltage = parseInt(req.params.networkVoltage);
  const ratings = await TransformerRating.find({ network_voltage_kv: voltage }).sort({ kva: 1 });
  return successResponse(res, 200, 'Ratings retrieved successfully', ratings);
});

const create = asyncHandler(async (req, res) => {
  const rating = new TransformerRating(req.body);
  await rating.save();
  return successResponse(res, 201, 'Rating created successfully', rating);
});

const update = asyncHandler(async (req, res) => {
  const rating = await TransformerRating.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!rating) throw new ApiError(404, 'Rating not found');
  return successResponse(res, 200, 'Rating updated successfully', rating);
});

// Hard delete — TransformerRating model has no is_deleted field.
const del = asyncHandler(async (req, res) => {
  const rating = await TransformerRating.findByIdAndDelete(req.params.id);
  if (!rating) throw new ApiError(404, 'Rating not found');
  return successResponse(res, 200, 'Rating deleted successfully');
});

module.exports = { getAll, getByNetworkVoltage, create, update, delete: del };
