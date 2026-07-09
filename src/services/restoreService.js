const mongoose = require('mongoose');
const { EJSON } = require('bson');
const BackupJob = require('../models/BackupJob');
const AuditService = require('./auditService');
const BackupService = require('./backupService');
const MaintenanceModeService = require('./maintenanceModeService');
const ChecksumService = require('./checksumService');
const CompressionService = require('./compressionService');
const StorageProvider = require('./storageProvider');
const { ApiError } = require('../utils/error');

const RESTORE_ALLOWED_COLLECTIONS = [
  'transformers',
  'inspections',
  'faults',
  'maintenances'
];

class RestoreService {
  async ensureMaintenanceMode() {
    const state = await MaintenanceModeService.getState({ useCache: false });
    if (!state.enabled) {
      throw new ApiError(409, 'Enable Maintenance Mode before restoring a backup.');
    }
  }

  async ensureNoActiveOperation() {
    const active = await BackupJob.findOne({ status: 'RUNNING' });
    if (active) {
      throw new ApiError(409, 'Another backup or restore operation is already running.');
    }
  }

  async restore(backupId, payload, user, req = null) {
    await this.ensureMaintenanceMode();
    await this.ensureNoActiveOperation();

    const job = await this.getCompletedBackup(backupId);
    this.validateConfirmation(backupId, payload.confirmation);
    const verified = await this.verifyBackupArtifact(job, payload.collections);

    if (payload.dryRun) {
      await this.logRestore('SYSTEM_RESTORE_DRY_RUN', {
        backupId,
        user,
        req,
        collections: verified.collections,
        checksumVerified: true
      });

      return {
        dryRun: true,
        backup_id: backupId,
        verified: true,
        collections: verified.collections,
        plan: verified.plan,
        warnings: verified.warnings
      };
    }

    return this.performRestore({ backupId, job, verified, user, req });
  }

  async getCompletedBackup(backupId) {
    const job = await BackupJob.findOne({
      backup_id: backupId,
      operation_type: { $ne: 'RESTORE' }
    });

    if (!job) {
      throw new ApiError(404, 'Backup not found');
    }
    if (job.status !== 'COMPLETED') {
      throw new ApiError(400, 'Backup is not completed and cannot be restored');
    }
    return job;
  }

  validateConfirmation(backupId, confirmation) {
    const expected = `RESTORE BACKUP ${backupId}`;
    if (confirmation !== expected) {
      throw new ApiError(400, `Confirmation must exactly match: ${expected}`);
    }
  }

  async verifyBackupArtifact(job, requestedCollections) {
    const artifact = await StorageProvider.read(job);
    const checksum = ChecksumService.sha256(artifact);
    if (checksum !== job.checksum) {
      throw new ApiError(400, 'Backup artifact checksum verification failed');
    }

    let parsed;
    try {
      const raw = await CompressionService.gunzip(artifact);
      parsed = EJSON.parse(raw.toString('utf8'));
    } catch (error) {
      throw new ApiError(400, 'Backup artifact payload is invalid');
    }

    const manifest = parsed?.manifest;
    const data = parsed?.data;
    if (!manifest || !Array.isArray(data)) {
      throw new ApiError(400, 'Backup artifact payload is invalid');
    }
    if (manifest.backup_id !== job.backup_id) {
      throw new ApiError(400, 'Backup manifest does not match requested backup');
    }
    if (!manifest.schema_version || !manifest.app_version || !Array.isArray(manifest.collections)) {
      throw new ApiError(400, 'Backup manifest is missing required fields');
    }

    const backupCollectionNames = new Set(manifest.collections.map((collection) => collection.name));
    const requested = requestedCollections?.length
      ? requestedCollections
      : manifest.collections.map((collection) => collection.name).filter((name) => RESTORE_ALLOWED_COLLECTIONS.includes(name));

    requested.forEach((collection) => {
      if (!RESTORE_ALLOWED_COLLECTIONS.includes(collection)) {
        throw new ApiError(400, `Collection is not allowed for restore: ${collection}`);
      }
      if (!backupCollectionNames.has(collection)) {
        throw new ApiError(400, `Collection is not present in backup: ${collection}`);
      }
    });

    const collectionData = new Map(data.map((collection) => [collection.name, collection.documents || []]));
    const restoredPlan = requested.map((name) => {
      const manifestCollection = manifest.collections.find((collection) => collection.name === name);
      const documents = collectionData.get(name);
      if (!Array.isArray(documents)) {
        throw new ApiError(400, `Collection payload is missing from backup: ${name}`);
      }
      if (manifestCollection.document_count !== documents.length) {
        throw new ApiError(400, `Collection document count mismatch: ${name}`);
      }
      return {
        name,
        document_count: documents.length
      };
    });

    const packageJson = require('../../package.json');
    const warnings = [];
    if (manifest.app_version !== packageJson.version) {
      warnings.push(`Backup app version ${manifest.app_version} differs from current version ${packageJson.version}`);
    }

    return {
      manifest,
      data: requested.reduce((acc, name) => {
        acc[name] = collectionData.get(name);
        return acc;
      }, {}),
      collections: requested,
      warnings,
      plan: {
        collections: restoredPlan,
        total_documents: restoredPlan.reduce((total, collection) => total + collection.document_count, 0)
      }
    };
  }

  async performRestore({ backupId, verified, user, req }) {
    const lock = await BackupJob.create({
      backup_id: `RST-${backupId}-${Date.now()}`,
      filename: `${backupId}-restore-operation`,
      status: 'RUNNING',
      operation_type: 'RESTORE',
      started_at: new Date(),
      created_by: user._id,
      compression: 'none',
      encryption: false,
      metadata: {
        restore_source_backup_id: backupId,
        collections: verified.collections
      }
    });

    try {
      await this.logRestore('SYSTEM_RESTORE_STARTED', {
        backupId,
        user,
        req,
        collections: verified.collections,
        checksumVerified: true
      });

      const preRestore = await BackupService.createBackup({
        backup_name: `pre-restore-${backupId}`,
        collections: verified.collections,
        metadata: {
          purpose: 'pre-restore safety backup',
          restore_source_backup_id: backupId
        }
      }, user, req, { skipActiveCheck: true });

      if (preRestore.failed) {
        throw new ApiError(500, 'Pre-restore backup failed');
      }

      const restoredCounts = {};
      for (const collectionName of verified.collections) {
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = verified.data[collectionName];
        await collection.deleteMany({});
        if (documents.length > 0) {
          await collection.insertMany(documents, { ordered: true });
        }
        restoredCounts[collectionName] = documents.length;
      }

      lock.status = 'COMPLETED';
      lock.completed_at = new Date();
      lock.metadata = {
        ...(lock.metadata || {}),
        pre_restore_backup_id: preRestore.job.backup_id,
        restored_counts: restoredCounts
      };
      await lock.save();

      await this.logRestore('SYSTEM_RESTORE_COMPLETED', {
        backupId,
        preRestoreBackupId: preRestore.job.backup_id,
        user,
        req,
        collections: verified.collections,
        checksumVerified: true,
        restoredCounts
      });

      return {
        dryRun: false,
        backup_id: backupId,
        pre_restore_backup_id: preRestore.job.backup_id,
        restored_collections: verified.collections,
        restored_counts: restoredCounts,
        completed_at: lock.completed_at.toISOString()
      };
    } catch (error) {
      lock.status = 'FAILED';
      lock.completed_at = new Date();
      lock.error_message = error.message;
      await lock.save();
      await this.logRestore('SYSTEM_RESTORE_FAILED', {
        backupId,
        user,
        req,
        collections: verified.collections,
        checksumVerified: true,
        error: error.message
      });
      throw error;
    }
  }

  async logRestore(action, { backupId, preRestoreBackupId, user, req, collections, checksumVerified, restoredCounts, error }) {
    await AuditService.logAction({
      user_id: user._id,
      action,
      action_category: 'SYSTEM',
      details: `${action} ${backupId}`,
      request_method: req?.method,
      request_path: req?.originalUrl,
      ip_address: req?.ip,
      user_agent: req?.get ? req.get('User-Agent') : undefined,
      metadata: {
        backup_id: backupId,
        pre_restore_backup_id: preRestoreBackupId,
        collections,
        checksum_verified: checksumVerified,
        restored_counts: restoredCounts,
        error
      }
    });
  }
}

module.exports = new RestoreService();
