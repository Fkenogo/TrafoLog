const District = require('../models/District');
const { asyncHandler, successResponse } = require('../utils/helpers');
const { ApiError } = require('../utils/error');

const getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = parseInt(page);
  const lim = parseInt(limit);
  const skip = (p - 1) * lim;

  const [data, total] = await Promise.all([
    District.find().skip(skip).limit(lim).sort({ name: 1 }),
    District.countDocuments()
  ]);

  return successResponse(res, 200, 'Districts retrieved successfully', {
    data,
    pagination: { page: p, limit: lim, total, pages: Math.ceil(total / lim) }
  });
});

const getById = asyncHandler(async (req, res) => {
  const district = await District.findById(req.params.id);
  if (!district) throw new ApiError(404, 'District not found');
  return successResponse(res, 200, 'District retrieved successfully', district);
});

const getByRegion = asyncHandler(async (req, res) => {
  const districts = await District.find({ region: req.params.region }).sort({ name: 1 });
  return successResponse(res, 200, 'Districts retrieved successfully', districts);
});

module.exports = { getAll, getById, getByRegion };
