const Transformer = require('../models/Transformer');
const AssetTimeline = require('../models/AssetTimeline');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const Installation = require('../models/Installation');
const BaseService = require('./baseService');
const { generateAssetId } = require('../utils/idGenerator');
const qrGeneratorUtil = require('../utils/qrGenerator');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class TransformerService extends BaseService {
  constructor() {
    super(Transformer, 'Transformer');
  }

  /**
   * Create a new transformer
   */
  async createTransformer(data, userId) {
    try {
      // Check for duplicate serial number
      if (data.serial_number) {
        const exists = await this.exists({ serial_number: data.serial_number });
        if (exists) {
          throw new ApiError(400, 'Transformer with this serial number already exists');
        }
      }

      // Generate unique asset ID
      const assetId = await generateAssetId();
      data.asset_id = assetId;

      // Generate display rating
      data.display_rating = `${data.kva_rating}kVA/${data.network_voltage_kv}kV`;

      // Generate QR code
      const qrData = {
        id: assetId,
        url: `${process.env.APP_URL}/assets/${assetId}`
      };
      data.qr_code = await qrGeneratorUtil.generate(JSON.stringify(qrData));

      // Set GPS location
      if (data.latitude && data.longitude) {
        data.gps = {
          type: 'Point',
          coordinates: [data.longitude, data.latitude],
          method: data.gps_method || 'Field Captured',
          accuracy_metres: data.gps_accuracy || 0,
          captured_at: new Date()
        };
      }

      // Create transformer
      const transformer = await this.create(data, userId);

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'REGISTERED', userId);

      return transformer;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.createTransformer:', error);
      throw new ApiError(500, 'Failed to create transformer');
    }
  }

  /**
   * Update transformer
   */
  async updateTransformer(id, data, userId) {
    try {
      const transformer = await this.getById(id);
      
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Check permissions
      // This should be handled by middleware

      // Update display rating if kVA or network voltage changed
      if (data.kva_rating || data.network_voltage_kv) {
        const kva = data.kva_rating || transformer.kva_rating;
        const voltage = data.network_voltage_kv || transformer.network_voltage_kv;
        data.display_rating = `${kva}kVA/${voltage}kV`;
      }

      // Update GPS if coordinates provided
      if (data.latitude && data.longitude) {
        data.gps = {
          type: 'Point',
          coordinates: [data.longitude, data.latitude],
          method: data.gps_method || 'Updated',
          accuracy_metres: data.gps_accuracy || 0,
          captured_at: new Date()
        };
      }

      // Update transformer
      const updated = await this.update(id, data, userId);

      // Create timeline entry
      await this.createTimelineEntry(updated, 'UPDATED', userId);

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.updateTransformer:', error);
      throw new ApiError(500, 'Failed to update transformer');
    }
  }

  /**
   * Verify transformer
   */
  async verifyTransformer(id, userId) {
    try {
      const transformer = await this.getById(id);
      
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      if (transformer.record_status === 'Verified') {
        throw new ApiError(400, 'Transformer already verified');
      }

      transformer.record_status = 'Verified';
      transformer.operational_status = 'Active';
      transformer.updated_by = userId;
      await transformer.save();

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'VERIFIED', userId);

      return transformer;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.verifyTransformer:', error);
      throw new ApiError(500, 'Failed to verify transformer');
    }
  }

  /**
   * Decommission transformer
   */
  async decommissionTransformer(id, reason, userId) {
    try {
      const transformer = await this.getById(id);
      
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      if (transformer.operational_status === 'Decommissioned') {
        throw new ApiError(400, 'Transformer already decommissioned');
      }

      transformer.operational_status = 'Decommissioned';
      transformer.updated_by = userId;
      await transformer.save();

      // Create timeline entry
      await this.createTimelineEntry(
        transformer, 
        'DECOMMISSIONED', 
        userId,
        { reason }
      );

      return transformer;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.decommissionTransformer:', error);
      throw new ApiError(500, 'Failed to decommission transformer');
    }
  }

  /**
   * Search transformers
   */
  async searchTransformers(filters, options = {}) {
    try {
      const query = { is_deleted: false };

      // Text search
      if (filters.search) {
        query.$or = [
          { asset_id: { $regex: filters.search, $options: 'i' } },
          { serial_number: { $regex: filters.search, $options: 'i' } },
          { 'location_administrative.site_name': { $regex: filters.search, $options: 'i' } },
          { manufacturer: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Filter by territory
      if (filters.territory_id) {
        query['location_operational.territory_id'] = filters.territory_id;
      }

      // Filter by service area
      if (filters.service_area_id) {
        query['location_operational.service_area_id'] = filters.service_area_id;
      }

      // Filter by network voltage
      if (filters.network_voltage_kv) {
        query.network_voltage_kv = parseInt(filters.network_voltage_kv);
      }

      // Filter by kVA rating
      if (filters.kva_rating) {
        query.kva_rating = parseInt(filters.kva_rating);
      }

      // Filter by operational status
      if (filters.operational_status) {
        query.operational_status = filters.operational_status;
      }

      // Filter by record status
      if (filters.record_status) {
        query.record_status = filters.record_status;
      }

      // Filter by district
      if (filters.district_id) {
        query['location_administrative.district_id'] = filters.district_id;
      }

      // Filter by condition (from latest inspection)
      if (filters.condition) {
        // This would require a more complex aggregation
        // For now, we'll filter after getting results
      }

      // Geo-near query
      if (filters.latitude && filters.longitude && filters.radius) {
        query.gps = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(filters.longitude), parseFloat(filters.latitude)]
            },
            $maxDistance: parseFloat(filters.radius) * 1000 // Convert km to meters
          }
        };
      }

      const result = await this.getAll(query, options);

      // If condition filter is provided, filter results
      if (filters.condition && result.data.length > 0) {
        // Get latest inspections for these transformers
        const transformerIds = result.data.map(t => t._id);
        const latestInspections = await Inspection.aggregate([
          {
            $match: {
              transformer_id: { $in: transformerIds }
            }
          },
          {
            $sort: { transformer_id: 1, inspection_date: -1 }
          },
          {
            $group: {
              _id: '$transformer_id',
              latest: { $first: '$$ROOT' }
            }
          }
        ]);

        // Create a map of transformer ID to condition
        const conditionMap = {};
        latestInspections.forEach(item => {
          conditionMap[item._id.toString()] = item.latest.physical.overall_condition;
        });

        // Filter transformers by condition
        result.data = result.data.filter(t => {
          const condition = conditionMap[t._id.toString()];
          return condition === filters.condition;
        });
      }

      return result;
    } catch (error) {
      logger.error('Error in TransformerService.searchTransformers:', error);
      throw new ApiError(500, 'Failed to search transformers');
    }
  }

  /**
   * Get transformer by asset ID
   */
  async getByAssetId(assetId) {
    try {
      const transformer = await this.model.findOne({
        asset_id: assetId,
        is_deleted: false
      }).populate('rating_id');

      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      return transformer;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.getByAssetId:', error);
      throw new ApiError(500, 'Failed to get transformer');
    }
  }

  /**
   * Get transformer with full details including related records
   */
  async getTransformerWithDetails(id) {
    try {
      const transformer = await this.getById(id, [
        'rating_id',
        'location_operational.territory_id',
        'location_operational.service_area_id',
        'location_administrative.district_id'
      ]);

      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Get latest inspection
      const latestInspection = await Inspection.findOne({
        transformer_id: transformer._id
      }).sort({ inspection_date: -1 });

      // Get open faults
      const openFaults = await Fault.find({
        transformer_id: transformer._id,
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
      });

      // Get recent maintenance
      const recentMaintenance = await Maintenance.find({
        transformer_id: transformer._id
      }).sort({ maintenance_date: -1 }).limit(5);

      // Get installation history
      const installations = await Installation.find({
        transformer_id: transformer._id
      }).sort({ installation_date: -1 });

      return {
        ...transformer.toObject(),
        latest_inspection: latestInspection,
        open_faults: openFaults,
        recent_maintenance: recentMaintenance,
        installations: installations
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.getTransformerWithDetails:', error);
      throw new ApiError(500, 'Failed to get transformer details');
    }
  }

  /**
   * Get transformer statistics
   */
  async getStatistics(filters = {}) {
    try {
      const match = { is_deleted: false };

      if (filters.territory_id) {
        match['location_operational.territory_id'] = filters.territory_id;
      }

      if (filters.service_area_id) {
        match['location_operational.service_area_id'] = filters.service_area_id;
      }

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$operational_status', 'Active'] }, 1, 0] }
            },
            faulty: {
              $sum: { $cond: [{ $eq: ['$has_open_fault', true] }, 1, 0] }
            },
            underMaintenance: {
              $sum: { $cond: [{ $eq: ['$operational_status', 'Under Maintenance'] }, 1, 0] }
            },
            decommissioned: {
              $sum: { $cond: [{ $eq: ['$operational_status', 'Decommissioned'] }, 1, 0] }
            },
            unverified: {
              $sum: { $cond: [{ $eq: ['$record_status', 'Draft'] }, 1, 0] }
            },
            total11kV: {
              $sum: { $cond: [{ $eq: ['$network_voltage_kv', 11] }, 1, 0] }
            },
            total33kV: {
              $sum: { $cond: [{ $eq: ['$network_voltage_kv', 33] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            _id: 0,
            total: 1,
            active: 1,
            faulty: 1,
            underMaintenance: 1,
            decommissioned: 1,
            unverified: 1,
            '11kV': '$total11kV',
            '33kV': '$total33kV'
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        active: 0,
        faulty: 0,
        underMaintenance: 0,
        decommissioned: 0,
        unverified: 0,
        '11kV': 0,
        '33kV': 0
      };
    } catch (error) {
      logger.error('Error in TransformerService.getStatistics:', error);
      throw new ApiError(500, 'Failed to get transformer statistics');
    }
  }

  /**
   * Get transformers by territory with counts
   */
  async getTransformersByTerritory(territoryId) {
    try {
      const transformers = await this.model.find({
        'location_operational.territory_id': territoryId,
        is_deleted: false
      }).populate('rating_id');

      const stats = await this.getStatistics({ territory_id: territoryId });

      return {
        transformers,
        stats
      };
    } catch (error) {
      logger.error('Error in TransformerService.getTransformersByTerritory:', error);
      throw new ApiError(500, 'Failed to get transformers by territory');
    }
  }

  /**
   * Get transformers by service area
   */
  async getTransformersByServiceArea(serviceAreaId) {
    try {
      const transformers = await this.model.find({
        'location_operational.service_area_id': serviceAreaId,
        is_deleted: false
      }).populate('rating_id');

      const stats = await this.getStatistics({ service_area_id: serviceAreaId });

      return { transformers, stats };
    } catch (error) {
      logger.error('Error in TransformerService.getTransformersByServiceArea:', error);
      throw new ApiError(500, 'Failed to get transformers by service area');
    }
  }

  /**
   * Get nearby transformers
   */
  async getNearbyTransformers(latitude, longitude, radius = 5, limit = 20) {
    try {
      const transformers = await this.model.find({
        gps: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        },
        is_deleted: false
      }).limit(limit).populate('rating_id');

      return transformers;
    } catch (error) {
      logger.error('Error in TransformerService.getNearbyTransformers:', error);
      throw new ApiError(500, 'Failed to get nearby transformers');
    }
  }

  /**
   * Create timeline entry
   */
  async createTimelineEntry(transformer, eventType, userId, metadata = {}) {
    try {
      const timeline = new AssetTimeline({
        transformer_id: transformer._id,
        event_type: eventType,
        event_summary: `${eventType} - ${transformer.asset_id}`,
        metadata: metadata,
        created_by: userId
      });
      await timeline.save();
    } catch (error) {
      logger.error('Error creating timeline entry:', error);
      // Don't throw, just log
    }
  }

  /**
   * Bulk create transformers
   */
  async bulkCreate(transformersData, userId) {
    try {
      const results = {
        success: [],
        failed: [],
        errors: []
      };

      for (let i = 0; i < transformersData.length; i++) {
        try {
          const data = transformersData[i];
          const transformer = await this.createTransformer(data, userId);
          results.success.push(transformer);
        } catch (error) {
          results.failed.push({
            index: i,
            data: transformersData[i],
            error: error.message
          });
          results.errors.push(error.message);
        }
      }

      return results;
    } catch (error) {
      logger.error('Error in TransformerService.bulkCreate:', error);
      throw new ApiError(500, 'Failed to bulk create transformers');
    }
  }

  /**
   * Update operational status based on related records
   */
  async updateOperationalStatus(transformerId) {
    try {
      const transformer = await this.getById(transformerId);
      
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Check for open faults
      const hasOpenFault = await Fault.exists({
        transformer_id: transformer._id,
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
      });

      if (hasOpenFault && transformer.operational_status !== 'Faulty') {
        transformer.operational_status = 'Faulty';
        transformer.has_open_fault = true;
        await transformer.save();
        return transformer;
      }

      // If no open faults and status is Faulty, revert to Active
      if (!hasOpenFault && transformer.operational_status === 'Faulty') {
        transformer.operational_status = 'Active';
        transformer.has_open_fault = false;
        await transformer.save();
        return transformer;
      }

      return transformer;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in TransformerService.updateOperationalStatus:', error);
      throw new ApiError(500, 'Failed to update operational status');
    }
  }
}

module.exports = new TransformerService();