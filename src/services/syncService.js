const SyncQueue = require('../models/SyncQueue');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class SyncService {
  /**
   * Process offline queue
   */
  async processOfflineQueue(userId, operations) {
    try {
      const results = {
        successful: [],
        failed: [],
        conflicts: []
      };

      for (const operation of operations) {
        try {
          // Check for conflicts
          const hasConflict = await this.checkForConflict(
            operation.collection,
            operation.record_id,
            operation.version
          );

          if (hasConflict) {
            results.conflicts.push({
              operation,
              message: 'Conflict detected - record has been modified since offline edit'
            });
            continue;
          }

          // Process operation
          const result = await this.processOperation(
            userId,
            operation
          );

          if (result.success) {
            results.successful.push(result);
          } else {
            results.failed.push(result);
          }
        } catch (error) {
          results.failed.push({
            operation,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing offline queue:', error);
      throw new ApiError(500, 'Failed to process offline queue');
    }
  }

  /**
   * Check for conflicts
   */
  async checkForConflict(collection, recordId, version) {
    try {
      let record;
      
      switch (collection) {
        case 'transformers':
          record = await Transformer.findById(recordId);
          break;
        case 'inspections':
          record = await Inspection.findById(recordId);
          break;
        case 'faults':
          record = await Fault.findById(recordId);
          break;
        case 'maintenance':
          record = await Maintenance.findById(recordId);
          break;
        default:
          return false;
      }

      if (!record) return true; // Record deleted

      // Check if record was updated after offline version
      const recordVersion = record.sync_version || 1;
      return recordVersion > version;
    } catch (error) {
      logger.error('Error checking for conflict:', error);
      return true; // Assume conflict on error
    }
  }

  /**
   * Process operation
   */
  async processOperation(userId, operation) {
    try {
      const { collection, operation_type, record_id, data } = operation;

      let result;
      
      switch (operation_type) {
        case 'create':
          result = await this.handleCreate(collection, data, userId);
          break;
        case 'update':
          result = await this.handleUpdate(collection, record_id, data, userId);
          break;
        case 'delete':
          result = await this.handleDelete(collection, record_id, userId);
          break;
        default:
          throw new Error('Unsupported operation type');
      }

      // Remove from queue if successful
      if (result.success) {
        await SyncQueue.findOneAndDelete({
          user_id: userId,
          record_id: record_id || result.recordId,
          status: 'pending'
        });
      }

      return result;
    } catch (error) {
      logger.error('Error processing operation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle create operation
   */
  async handleCreate(collection, data, userId) {
    try {
      let record;
      
      switch (collection) {
        case 'transformers':
          record = await Transformer.create({ ...data, created_by: userId });
          break;
        case 'inspections':
          record = await Inspection.create({ ...data, inspector_id: userId });
          break;
        case 'faults':
          record = await Fault.create({ ...data, reported_by: userId });
          break;
        case 'maintenance':
          record = await Maintenance.create({ ...data, technician_id: userId });
          break;
        default:
          throw new Error('Unsupported collection');
      }

      return {
        success: true,
        recordId: record._id,
        collection,
        operation: 'create'
      };
    } catch (error) {
      throw new Error(`Create failed: ${error.message}`);
    }
  }

  /**
   * Handle update operation
   */
  async handleUpdate(collection, recordId, data, userId) {
    try {
      let record;
      
      switch (collection) {
        case 'transformers':
          record = await Transformer.findByIdAndUpdate(
            recordId,
            { ...data, updated_by: userId, sync_version: { $inc: 1 } },
            { new: true }
          );
          break;
        case 'inspections':
          record = await Inspection.findByIdAndUpdate(
            recordId,
            { ...data, sync_version: { $inc: 1 } },
            { new: true }
          );
          break;
        case 'faults':
          record = await Fault.findByIdAndUpdate(
            recordId,
            { ...data, sync_version: { $inc: 1 } },
            { new: true }
          );
          break;
        case 'maintenance':
          record = await Maintenance.findByIdAndUpdate(
            recordId,
            { ...data, sync_version: { $inc: 1 } },
            { new: true }
          );
          break;
        default:
          throw new Error('Unsupported collection');
      }

      if (!record) {
        throw new Error('Record not found');
      }

      return {
        success: true,
        recordId: record._id,
        collection,
        operation: 'update',
        record
      };
    } catch (error) {
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Handle delete operation
   */
  async handleDelete(collection, recordId, userId) {
    try {
      let result;
      
      switch (collection) {
        case 'transformers':
          result = await Transformer.findByIdAndUpdate(recordId, {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: userId
          });
          break;
        case 'inspections':
          result = await Inspection.findByIdAndUpdate(recordId, {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: userId
          });
          break;
        case 'faults':
          // For faults, we might want to keep them but mark as deleted
          result = await Fault.findByIdAndUpdate(recordId, {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: userId
          });
          break;
        case 'maintenance':
          result = await Maintenance.findByIdAndUpdate(recordId, {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: userId
          });
          break;
        default:
          throw new Error('Unsupported collection');
      }

      if (!result) {
        throw new Error('Record not found');
      }

      return {
        success: true,
        recordId,
        collection,
        operation: 'delete'
      };
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get transformers for offline cache
   */
  async getOfflineTransformers(userId, userRole, territoryId, serviceAreaId, lastSync) {
    try {
      const query = { is_deleted: false };

      // Apply role-based filters
      if (userRole === 'Field Technician' && serviceAreaId) {
        query['location_operational.service_area_id'] = serviceAreaId;
      } else if (userRole === 'Engineer' && serviceAreaId) {
        query['location_operational.service_area_id'] = serviceAreaId;
      } else if (userRole === 'Territory Manager' && territoryId) {
        query['location_operational.territory_id'] = territoryId;
      }

      // Filter by last sync
      if (lastSync) {
        query.updated_at = { $gte: new Date(lastSync) };
      }

      const transformers = await Transformer.find(query)
        .select('-__v -deleted_by');

      // Get related data for offline use
      const transformerIds = transformers.map(t => t._id);
      
      const [inspections, faults, maintenance] = await Promise.all([
        Inspection.find({
          transformer_id: { $in: transformerIds }
        }).limit(1000),
        Fault.find({
          transformer_id: { $in: transformerIds },
          fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
        }),
        Maintenance.find({
          transformer_id: { $in: transformerIds }
        }).limit(500)
      ]);

      return {
        transformers,
        inspections,
        faults,
        maintenance,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting offline transformers:', error);
      throw new ApiError(500, 'Failed to get offline transformers');
    }
  }

  /**
   * Resolve conflicts
   */
  async resolveConflicts(userId, conflicts) {
    try {
      const results = [];

      for (const conflict of conflicts) {
        try {
          const { collection, record_id, resolution, resolved_data } = conflict;
          
          let record;
          switch (collection) {
            case 'transformers':
              record = await Transformer.findById(record_id);
              break;
            case 'inspections':
              record = await Inspection.findById(record_id);
              break;
            case 'faults':
              record = await Fault.findById(record_id);
              break;
            case 'maintenance':
              record = await Maintenance.findById(record_id);
              break;
            default:
              throw new Error('Unsupported collection');
          }

          if (!record) {
            results.push({
              conflict,
              success: false,
              error: 'Record not found'
            });
            continue;
          }

          if (resolution === 'server') {
            // Keep server version - no changes needed
            results.push({
              conflict,
              success: true,
              resolution: 'server'
            });
          } else if (resolution === 'client') {
            // Apply client changes
            Object.assign(record, resolved_data);
            record.updated_by = userId;
            record.sync_version = (record.sync_version || 1) + 1;
            await record.save();
            
            results.push({
              conflict,
              success: true,
              resolution: 'client'
            });
          } else if (resolution === 'merge') {
            // Merge both versions (custom logic)
            Object.assign(record, resolved_data);
            record.updated_by = userId;
            record.sync_version = (record.sync_version || 1) + 1;
            await record.save();
            
            results.push({
              conflict,
              success: true,
              resolution: 'merge'
            });
          } else {
            results.push({
              conflict,
              success: false,
              error: 'Invalid resolution type'
            });
          }
        } catch (error) {
          results.push({
            conflict,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error resolving conflicts:', error);
      throw new ApiError(500, 'Failed to resolve conflicts');
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId) {
    try {
      const pendingCount = await SyncQueue.countDocuments({
        user_id: userId,
        status: 'pending'
      });

      const failedCount = await SyncQueue.countDocuments({
        user_id: userId,
        status: 'failed'
      });

      const conflictsCount = await SyncQueue.countDocuments({
        user_id: userId,
        status: 'conflict'
      });

      return {
        pending: pendingCount,
        failed: failedCount,
        conflicts: conflictsCount,
        lastSync: await this.getLastSyncTime(userId),
        isSynced: pendingCount === 0 && conflictsCount === 0
      };
    } catch (error) {
      logger.error('Error getting sync status:', error);
      throw new ApiError(500, 'Failed to get sync status');
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime(userId) {
    try {
      const lastSync = await SyncQueue.findOne({
        user_id: userId,
        status: 'synced'
      }).sort({ synced_at: -1 });

      return lastSync ? lastSync.synced_at : null;
    } catch (error) {
      logger.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Get pending items
   */
  async getPendingItems(userId) {
    try {
      return await SyncQueue.find({
        user_id: userId,
        status: 'pending'
      }).sort({ created_at: 1 });
    } catch (error) {
      logger.error('Error getting pending items:', error);
      throw new ApiError(500, 'Failed to get pending items');
    }
  }

  /**
   * Force sync specific record
   */
  async forceSync(userId, collection, recordId) {
    try {
      const queueItem = await SyncQueue.findOne({
        user_id: userId,
        collection,
        record_id: recordId,
        status: 'pending'
      });

      if (!queueItem) {
        throw new ApiError(404, 'No pending sync item found');
      }

      return await this.processOperation(userId, {
        collection,
        operation_type: queueItem.operation_type,
        record_id: queueItem.record_id,
        data: queueItem.data
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error forcing sync:', error);
      throw new ApiError(500, 'Failed to force sync');
    }
  }

  /**
   * Clear sync queue
   */
  async clearQueue(userId, status = 'pending') {
    try {
      const result = await SyncQueue.deleteMany({
        user_id: userId,
        status
      });

      return {
        deleted: result.deletedCount
      };
    } catch (error) {
      logger.error('Error clearing sync queue:', error);
      throw new ApiError(500, 'Failed to clear sync queue');
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(userId) {
    try {
      const stats = await SyncQueue.aggregate([
        { $match: { user_id: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = stats.reduce((sum, item) => sum + item.count, 0);

      return {
        total,
        byStatus: stats,
        completionRate: total > 0 ? (stats.find(s => s._id === 'synced')?.count || 0) / total * 100 : 100
      };
    } catch (error) {
      logger.error('Error getting sync stats:', error);
      throw new ApiError(500, 'Failed to get sync stats');
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(userId, lastCheck) {
    try {
      const query = {
        updated_at: { $gt: new Date(lastCheck || 0) }
      };

      const [transformers, inspections, faults, maintenance] = await Promise.all([
        Transformer.find(query).countDocuments(),
        Inspection.find(query).countDocuments(),
        Fault.find(query).countDocuments(),
        Maintenance.find(query).countDocuments()
      ]);

      return {
        hasUpdates: transformers > 0 || inspections > 0 || faults > 0 || maintenance > 0,
        updates: {
          transformers,
          inspections,
          faults,
          maintenance
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error checking for updates:', error);
      throw new ApiError(500, 'Failed to check for updates');
    }
  }

  /**
   * Get sync logs
   */
  async getSyncLogs(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const [data, total] = await Promise.all([
        SyncQueue.find({ user_id: userId })
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit),
        SyncQueue.countDocuments({ user_id: userId })
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting sync logs:', error);
      throw new ApiError(500, 'Failed to get sync logs');
    }
  }

  /**
   * Set sync priority
   */
  async setSyncPriority(userId, collection, priority) {
    try {
      await SyncQueue.updateMany(
        {
          user_id: userId,
          collection,
          status: 'pending'
        },
        { priority }
      );

      return { success: true };
    } catch (error) {
      logger.error('Error setting sync priority:', error);
      throw new ApiError(500, 'Failed to set sync priority');
    }
  }

  /**
   * Process batch sync
   */
  async processBatchSync(userId, items) {
    try {
      const results = {
        successful: [],
        failed: []
      };

      for (const item of items) {
        try {
          const result = await this.processOperation(userId, item);
          if (result.success) {
            results.successful.push(result);
          } else {
            results.failed.push(result);
          }
        } catch (error) {
          results.failed.push({
            item,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing batch sync:', error);
      throw new ApiError(500, 'Failed to process batch sync');
    }
  }

  /**
   * Get user conflicts
   */
  async getUserConflicts(userId) {
    try {
      return await SyncQueue.find({
        user_id: userId,
        status: 'conflict'
      });
    } catch (error) {
      logger.error('Error getting user conflicts:', error);
      throw new ApiError(500, 'Failed to get user conflicts');
    }
  }

  /**
   * Resolve specific conflict
   */
  async resolveSpecificConflict(userId, conflictId, resolution, resolvedData) {
    try {
      const conflict = await SyncQueue.findOne({
        _id: conflictId,
        user_id: userId,
        status: 'conflict'
      });

      if (!conflict) {
        throw new ApiError(404, 'Conflict not found');
      }

      // Apply resolution
      if (resolution === 'server') {
        conflict.status = 'synced';
        conflict.resolved_at = new Date();
        await conflict.save();
      } else if (resolution === 'client') {
        // Apply client changes
        const result = await this.processOperation(userId, {
          collection: conflict.collection,
          operation_type: conflict.operation_type,
          record_id: conflict.record_id,
          data: resolvedData || conflict.data
        });

        if (result.success) {
          conflict.status = 'synced';
          conflict.resolved_at = new Date();
          await conflict.save();
        } else {
          throw new Error('Failed to apply client changes');
        }
      } else {
        throw new Error('Invalid resolution type');
      }

      return {
        success: true,
        conflictId,
        resolution
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error resolving specific conflict:', error);
      throw new ApiError(500, 'Failed to resolve conflict');
    }
  }

  /**
   * Get sync health
   */
  async getSyncHealth(userId) {
    try {
      const totalPending = await SyncQueue.countDocuments({
        user_id: userId,
        status: 'pending'
      });

      const totalFailed = await SyncQueue.countDocuments({
        user_id: userId,
        status: 'failed'
      });

      const totalConflicts = await SyncQueue.countDocuments({
        user_id: userId,
        status: 'conflict'
      });

      const healthStatus = totalPending === 0 && totalConflicts === 0 ? 'healthy' :
                          totalPending > 0 && totalFailed === 0 ? 'pending' :
                          'needs_attention';

      return {
        status: healthStatus,
        pendingCount: totalPending,
        failedCount: totalFailed,
        conflictCount: totalConflicts,
        lastSync: await this.getLastSyncTime(userId),
        recommendations: this.getHealthRecommendations(totalPending, totalFailed, totalConflicts)
      };
    } catch (error) {
      logger.error('Error getting sync health:', error);
      throw new ApiError(500, 'Failed to get sync health');
    }
  }

  /**
   * Get health recommendations
   */
  getHealthRecommendations(pending, failed, conflicts) {
    const recommendations = [];

    if (pending > 0) {
      recommendations.push(`${pending} items pending sync. Ensure you have an internet connection.`);
    }

    if (failed > 0) {
      recommendations.push(`${failed} items failed to sync. Check error logs and retry.`);
    }

    if (conflicts > 0) {
      recommendations.push(`${conflicts} conflicts detected. Review and resolve conflicts.`);
    }

    if (pending === 0 && failed === 0 && conflicts === 0) {
      recommendations.push('All data is in sync. No action needed.');
    }

    return recommendations;
  }
}

module.exports = new SyncService();