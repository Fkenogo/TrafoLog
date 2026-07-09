const BackupJob = require('../models/BackupJob');
const MaintenanceModeService = require('./maintenanceModeService');
const AuditService = require('./auditService');
const ManifestService = require('./manifestService');
const ChecksumService = require('./checksumService');
const CompressionService = require('./compressionService');
const StorageProvider = require('./storageProvider');
const { ApiError } = require('../utils/error');
const { EJSON } = require('bson');

const BACKUP_ID_PREFIX = 'BKP';

const safeName = (value) => (value || 'backup')
  .toLowerCase()
  .replace(/[^a-z0-9-_]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80);

const buildBackupId = () => `${BACKUP_ID_PREFIX}-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

class BackupService {
  async ensureNoActiveOperation() {
    const active = await BackupJob.findOne({ status: 'RUNNING' });
    if (active) {
      throw new ApiError(409, 'Another backup or restore operation is already running.');
    }
  }

  async ensureMaintenanceMode() {
    const state = await MaintenanceModeService.getState({ useCache: false });
    if (!state.enabled) {
      throw new ApiError(409, 'Enable Maintenance Mode before creating a backup.');
    }
  }

  async createBackup(payload, user, req = null, options = {}) {
    await this.ensureMaintenanceMode();
    if (!options.skipActiveCheck) {
      await this.ensureNoActiveOperation();
    }

    const backupId = buildBackupId();
    const filename = `${backupId}-${safeName(payload.backup_name)}.json.gz`;
    const now = new Date();
    const packageJson = require('../../package.json');

    const job = await BackupJob.create({
      backup_id: backupId,
      filename,
      status: 'RUNNING',
      operation_type: 'BACKUP',
      started_at: now,
      created_by: user._id,
      compression: 'gzip',
      encryption: false,
      schema_version: '1.0',
      app_version: packageJson.version,
      retention_until: payload.retention_until,
      metadata: payload.metadata || {}
    });

    await this.logBackup('SYSTEM_BACKUP_STARTED', job, user, req);

    try {
      const manifest = await ManifestService.buildManifest({
        backupId,
        userId: user._id,
        collectionNames: payload.collections,
        compression: 'gzip',
        encryption: false
      });
      const data = await ManifestService.collectCollectionData(manifest.collections);
      const finalManifest = {
        ...manifest,
        checksum: null
      };
      const finalPayload = Buffer.from(EJSON.stringify({ manifest: finalManifest, data }, null, 2));
      const finalCompressed = await CompressionService.gzip(finalPayload);
      const checksum = ChecksumService.sha256(finalCompressed);
      const storage = await StorageProvider.store(finalCompressed, filename);
      finalManifest.checksum = checksum;

      job.status = 'COMPLETED';
      job.completed_at = new Date();
      job.storage_key = storage.storage_key;
      job.checksum = checksum;
      job.size_bytes = storage.size_bytes;
      job.collections = finalManifest.collections;
      job.manifest = finalManifest;
      job.metadata = {
        ...(job.metadata || {}),
        storage_provider: storage.provider
      };
      await job.save();

      await this.logBackup('SYSTEM_BACKUP_COMPLETED', job, user, req);
      return { job, failed: false };
    } catch (error) {
      job.status = 'FAILED';
      job.completed_at = new Date();
      job.error_message = error.message;
      await job.save();
      await this.logBackup('SYSTEM_BACKUP_FAILED', job, user, req);
      return { job, failed: true };
    }
  }

  async listBackups(query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const filters = { operation_type: { $ne: 'RESTORE' } };
    if (query.status) filters.status = query.status;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      BackupJob.find(filters).sort({ created_at: -1 }).skip(skip).limit(limit).populate('created_by', 'name email role'),
      BackupJob.countDocuments(filters)
    ]);

    return {
      data: data.map((job) => this.toMetadata(job)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  toMetadata(job) {
    const item = typeof job.toJSON === 'function' ? job.toJSON() : job;
    return {
      _id: item._id,
      backup_id: item.backup_id,
      filename: item.filename,
      storage_key: item.storage_key,
      status: item.status,
      operation_type: item.operation_type || 'BACKUP',
      started_at: item.started_at,
      completed_at: item.completed_at,
      created_by: item.created_by,
      checksum: item.checksum,
      compression: item.compression,
      encryption: item.encryption,
      size_bytes: item.size_bytes,
      collections: item.collections || [],
      schema_version: item.schema_version,
      app_version: item.app_version,
      retention_until: item.retention_until,
      metadata: item.metadata || {},
      manifest: item.manifest || {},
      error_message: item.error_message,
      created_at: item.created_at,
      updated_at: item.updated_at
    };
  }

  async logBackup(action, job, user, req) {
    await AuditService.logAction({
      user_id: user._id,
      action,
      action_category: 'SYSTEM',
      details: `${action} ${job.backup_id}`,
      request_method: req?.method,
      request_path: req?.originalUrl,
      ip_address: req?.ip,
      user_agent: req?.get ? req.get('User-Agent') : undefined,
      metadata: {
        backup_id: job.backup_id,
        status: job.status,
        filename: job.filename,
        checksum: job.checksum,
        size_bytes: job.size_bytes,
        storage_provider: job.metadata?.storage_provider
      }
    });
  }
}

module.exports = new BackupService();
