const Installation = require('../models/Installation');
const Transformer = require('../models/Transformer');
const AssetTimeline = require('../models/AssetTimeline');
const BaseService = require('./baseService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class InstallationService extends BaseService {
  constructor() {
    super(Installation, 'Installation');
  }

  /**
   * Create a new installation record
   */
  async createInstallation(data, userId, files = {}) {
    try {
      // Verify transformer exists if it's a replacement
      if (data.installation_type === 'Replacement' && data.previous_transformer_id) {
        const previousTransformer = await Transformer.findById(data.previous_transformer_id);
        if (!previousTransformer) {
          throw new ApiError(404, 'Previous transformer not found');
        }
      }

      // Verify new transformer exists
      const transformer = await Transformer.findById(data.transformer_id);
      if (!transformer) {
        throw new ApiError(404, 'Transformer not found');
      }

      // Prepare installation data
      const installationData = {
        ...data,
        photos_before: files.photosBefore?.map(f => f.filename || f.path) || [],
        photos_during: files.photosDuring?.map(f => f.filename || f.path) || [],
        photos_after: files.photosAfter?.map(f => f.filename || f.path) || []
      };

      // Create installation record
      const installation = await this.create(installationData, userId);

      // If it's a replacement, decommission previous transformer
      if (data.installation_type === 'Replacement' && data.previous_transformer_id) {
        await Transformer.findByIdAndUpdate(data.previous_transformer_id, {
          operational_status: 'Decommissioned',
          updated_by: userId
        });

        // Create timeline entry for previous transformer
        const previousTransformer = await Transformer.findById(data.previous_transformer_id);
        await this.createTimelineEntry(previousTransformer, 'REPLACED', userId, {
          new_transformer_id: data.transformer_id,
          reason: data.replacement_reason
        });
      }

      // Update transformer
      await Transformer.findByIdAndUpdate(data.transformer_id, {
        operational_status: 'Active',
        record_status: 'Verified',
        'installation.install_date': data.installation_date || new Date(),
        'installation.installing_contractor': data.installing_team,
        'installation.commissioned_by': data.commissioned_by,
        'installation.commissioning_date': data.handover_date || new Date(),
        updated_by: userId
      });

      // Create timeline entry
      await this.createTimelineEntry(transformer, 'INSTALLED', userId, {
        installation_id: installation._id,
        installation_type: data.installation_type
      });

      return installation;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in InstallationService.createInstallation:', error);
      throw new ApiError(500, 'Failed to create installation record');
    }
  }

  /**
   * Get installations for a transformer
   */
  async getInstallationsByTransformer(transformerId) {
    try {
      return await this.model.find({
        transformer_id: transformerId
      })
      .populate('previous_transformer_id')
      .sort({ installation_date: -1 });
    } catch (error) {
      logger.error('Error in InstallationService.getInstallationsByTransformer:', error);
      throw new ApiError(500, 'Failed to get installations');
    }
  }

  /**
   * Get installation by ID
   */
  async getInstallationById(id) {
    try {
      return await this.getById(id, ['transformer_id', 'previous_transformer_id']);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in InstallationService.getInstallationById:', error);
      throw new ApiError(500, 'Failed to get installation');
    }
  }

  /**
   * Update installation record
   */
  async updateInstallation(id, data, userId, files = {}) {
    try {
      const installation = await this.getById(id);
      if (!installation) {
        throw new ApiError(404, 'Installation record not found');
      }

      // Update photos if provided
      if (files.photosBefore && files.photosBefore.length > 0) {
        data.photos_before = files.photosBefore.map(f => f.filename || f.path);
      }
      if (files.photosDuring && files.photosDuring.length > 0) {
        data.photos_during = files.photosDuring.map(f => f.filename || f.path);
      }
      if (files.photosAfter && files.photosAfter.length > 0) {
        data.photos_after = files.photosAfter.map(f => f.filename || f.path);
      }

      const updated = await this.update(id, data, userId);

      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error in InstallationService.updateInstallation:', error);
      throw new ApiError(500, 'Failed to update installation record');
    }
  }

  /**
   * Get installation statistics
   */
  async getStatistics(filters = {}) {
    try {
      const match = {};

      const stats = await this.model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            newInstallations: {
              $sum: { $cond: [{ $eq: ['$installation_type', 'New Installation'] }, 1, 0] }
            },
            replacements: {
              $sum: { $cond: [{ $eq: ['$installation_type', 'Replacement'] }, 1, 0] }
            },
            relocations: {
              $sum: { $cond: [{ $eq: ['$installation_type', 'Relocation'] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        newInstallations: 0,
        replacements: 0,
        relocations: 0
      };
    } catch (error) {
      logger.error('Error in InstallationService.getStatistics:', error);
      throw new ApiError(500, 'Failed to get installation statistics');
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
    }
  }
}

module.exports = new InstallationService();