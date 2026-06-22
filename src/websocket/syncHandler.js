const SyncQueue = require('../models/SyncQueue');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const { logger } = require('../utils/logger');

class SyncHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.syncQueue = new Map(); // userId -> Set of pending sync items
    this.syncInterval = null;
    this.startSyncInterval();
  }
  
  /**
   * Start sync interval
   */
  startSyncInterval() {
    this.syncInterval = setInterval(async () => {
      await this.processPendingSyncs();
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Stop sync interval
   */
  stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Process pending syncs
   */
  async processPendingSyncs() {
    try {
      const pendingItems = await SyncQueue.find({
        status: 'pending',
        attempts: { $lt: 5 }
      }).sort({ created_at: 1 });
      
      if (pendingItems.length === 0) return;
      
      logger.debug(`Processing ${pendingItems.length} pending sync items`);
      
      for (const item of pendingItems) {
        await this.processSyncItem(item);
      }
    } catch (error) {
      logger.error('Error processing pending syncs:', error);
    }
  }
  
  /**
   * Process individual sync item
   */
  async processSyncItem(item) {
    try {
      // Check if user is connected
      const isConnected = this.wsManager.isUserConnected(item.user_id);
      
      if (!isConnected) {
        // User offline, keep in queue
        return;
      }
      
      // Mark as processing
      item.status = 'processing';
      item.last_attempt_at = new Date();
      item.attempts += 1;
      await item.save();
      
      // Process based on collection and operation
      let result;
      switch (item.collection) {
        case 'transformers':
          result = await this.processTransformerSync(item);
          break;
        case 'inspections':
          result = await this.processInspectionSync(item);
          break;
        case 'faults':
          result = await this.processFaultSync(item);
          break;
        case 'maintenance':
          result = await this.processMaintenanceSync(item);
          break;
        default:
          throw new Error(`Unsupported collection: ${item.collection}`);
      }
      
      // Mark as synced
      item.status = 'synced';
      item.synced_at = new Date();
      await item.save();
      
      // Notify user
      this.wsManager.sendToUser(item.user_id, 'sync-complete', {
        id: item._id,
        collection: item.collection,
        operation: item.operation_type,
        result
      });
      
    } catch (error) {
      logger.error(`Error processing sync item ${item._id}:`, error);
      
      // Mark as failed or conflict
      if (error.message.includes('conflict')) {
        item.status = 'conflict';
        item.error_message = 'Conflict detected';
      } else if (item.attempts >= 5) {
        item.status = 'failed';
        item.error_message = error.message;
      } else {
        item.status = 'pending'; // Retry later
      }
      
      await item.save();
      
      // Notify user of error
      this.wsManager.sendToUser(item.user_id, 'sync-error', {
        id: item._id,
        collection: item.collection,
        error: error.message,
        status: item.status
      });
    }
  }
  
  /**
   * Process transformer sync
   */
  async processTransformerSync(item) {
    const data = item.data;
    
    switch (item.operation_type) {
      case 'create':
        return await Transformer.create({
          ...data,
          created_by: item.user_id
        });
      
      case 'update':
        const transformer = await Transformer.findById(item.record_id);
        if (!transformer) {
          throw new Error('Transformer not found');
        }
        
        // Check for conflicts
        if (transformer.sync_version > (data.sync_version || 0)) {
          throw new Error('Conflict detected - transformer has been modified');
        }
        
        Object.assign(transformer, data);
        transformer.updated_by = item.user_id;
        transformer.sync_version = (transformer.sync_version || 0) + 1;
        await transformer.save();
        return transformer;
      
      case 'delete':
        await Transformer.findByIdAndUpdate(item.record_id, {
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: item.user_id
        });
        return { deleted: true };
      
      default:
        throw new Error(`Unsupported operation: ${item.operation_type}`);
    }
  }
  
  /**
   * Process inspection sync
   */
  async processInspectionSync(item) {
    const data = item.data;
    
    switch (item.operation_type) {
      case 'create':
        return await Inspection.create({
          ...data,
          inspector_id: item.user_id
        });
      
      case 'update':
        const inspection = await Inspection.findById(item.record_id);
        if (!inspection) {
          throw new Error('Inspection not found');
        }
        
        if (inspection.sync_version > (data.sync_version || 0)) {
          throw new Error('Conflict detected - inspection has been modified');
        }
        
        Object.assign(inspection, data);
        inspection.sync_version = (inspection.sync_version || 0) + 1;
        await inspection.save();
        return inspection;
      
      default:
        throw new Error(`Unsupported operation: ${item.operation_type}`);
    }
  }
  
  /**
   * Process fault sync
   */
  async processFaultSync(item) {
    const data = item.data;
    
    switch (item.operation_type) {
      case 'create':
        return await Fault.create({
          ...data,
          reported_by: item.user_id
        });
      
      case 'update':
        const fault = await Fault.findById(item.record_id);
        if (!fault) {
          throw new Error('Fault not found');
        }
        
        if (fault.sync_version > (data.sync_version || 0)) {
          throw new Error('Conflict detected - fault has been modified');
        }
        
        Object.assign(fault, data);
        fault.sync_version = (fault.sync_version || 0) + 1;
        await fault.save();
        return fault;
      
      default:
        throw new Error(`Unsupported operation: ${item.operation_type}`);
    }
  }
  
  /**
   * Process maintenance sync
   */
  async processMaintenanceSync(item) {
    const data = item.data;
    
    switch (item.operation_type) {
      case 'create':
        return await Maintenance.create({
          ...data,
          technician_id: item.user_id
        });
      
      case 'update':
        const maintenance = await Maintenance.findById(item.record_id);
        if (!maintenance) {
          throw new Error('Maintenance not found');
        }
        
        if (maintenance.sync_version > (data.sync_version || 0)) {
          throw new Error('Conflict detected - maintenance has been modified');
        }
        
        Object.assign(maintenance, data);
        maintenance.sync_version = (maintenance.sync_version || 0) + 1;
        await maintenance.save();
        return maintenance;
      
      default:
        throw new Error(`Unsupported operation: ${item.operation_type}`);
    }
  }
  
  /**
   * Add item to sync queue
   */
  async addToSyncQueue(userId, collection, operationType, recordId, data) {
    const syncItem = new SyncQueue({
      user_id: userId,
      collection,
      operation_type: operationType,
      record_id: recordId,
      data,
      status: 'pending',
      attempts: 0,
      max_attempts: 5
    });
    
    await syncItem.save();
    
    // Notify user
    this.wsManager.sendToUser(userId, 'sync-queued', {
      id: syncItem._id,
      collection,
      operation: operationType,
      timestamp: new Date().toISOString()
    });
    
    return syncItem;
  }
  
  /**
   * Handle sync request from client
   */
  async handleSyncRequest(userId, data) {
    const { collection, operation, recordId, itemData, version } = data;
    
    // Add to queue
    const syncItem = await this.addToSyncQueue(
      userId,
      collection,
      operation,
      recordId,
      {
        ...itemData,
        sync_version: version || 0
      }
    );
    
    // Attempt immediate sync if user is connected
    if (this.wsManager.isUserConnected(userId)) {
      setTimeout(() => {
        this.processSyncItem(syncItem);
      }, 100);
    }
    
    return {
      queued: true,
      id: syncItem._id,
      status: syncItem.status
    };
  }
  
  /**
   * Get pending sync items for user
   */
  async getPendingSyncs(userId) {
    return await SyncQueue.find({
      user_id: userId,
      status: { $in: ['pending', 'processing'] }
    }).sort({ created_at: 1 });
  }
  
  /**
   * Get sync history for user
   */
  async getSyncHistory(userId, page = 1, limit = 20) {
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
  }
  
  /**
   * Get sync status for user
   */
  async getSyncStatus(userId) {
    const [pending, processing, failed, conflicts] = await Promise.all([
      SyncQueue.countDocuments({ user_id: userId, status: 'pending' }),
      SyncQueue.countDocuments({ user_id: userId, status: 'processing' }),
      SyncQueue.countDocuments({ user_id: userId, status: 'failed' }),
      SyncQueue.countDocuments({ user_id: userId, status: 'conflict' })
    ]);
    
    return {
      pending,
      processing,
      failed,
      conflicts,
      total: pending + processing + failed + conflicts,
      isSynced: pending === 0 && processing === 0 && conflicts === 0
    };
  }
  
  /**
   * Resolve conflict
   */
  async resolveConflict(userId, conflictId, resolution, resolvedData = null) {
    const conflict = await SyncQueue.findOne({
      _id: conflictId,
      user_id: userId,
      status: 'conflict'
    });
    
    if (!conflict) {
      throw new Error('Conflict not found');
    }
    
    if (resolution === 'server') {
      // Keep server version
      conflict.status = 'synced';
      conflict.resolved_at = new Date();
      await conflict.save();
      
      return { resolved: true, resolution: 'server' };
    } else if (resolution === 'client' && resolvedData) {
      // Apply client changes
      const result = await this.processSyncItem({
        ...conflict.toObject(),
        data: { ...conflict.data, ...resolvedData }
      });
      
      conflict.status = 'synced';
      conflict.resolved_at = new Date();
      await conflict.save();
      
      return { resolved: true, resolution: 'client', result };
    } else {
      throw new Error('Invalid resolution or missing data');
    }
  }
  
  /**
   * Clear sync queue
   */
  async clearSyncQueue(userId, status = 'pending') {
    const result = await SyncQueue.deleteMany({
      user_id: userId,
      status
    });
    
    return { deleted: result.deletedCount };
  }
  
  /**
   * Get sync statistics
   */
  async getSyncStats(userId) {
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
      completionRate: total > 0 
        ? (stats.find(s => s._id === 'synced')?.count || 0) / total * 100 
        : 100
    };
  }
  
  /**
   * Clean up old sync items
   */
  async cleanupOldSyncs(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await SyncQueue.deleteMany({
      status: { $in: ['synced', 'failed'] },
      synced_at: { $lt: cutoffDate }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old sync items`);
    return result;
  }
}

module.exports = SyncHandler;