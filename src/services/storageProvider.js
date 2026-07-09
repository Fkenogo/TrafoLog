const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const Minio = require('minio');
const { ApiError } = require('../utils/error');

class StorageProvider {
  providerName() {
    if (process.env.BACKUP_STORAGE_PROVIDER === 'minio' && process.env.MINIO_BUCKET_BACKUPS) {
      return 'minio';
    }
    return 'local';
  }

  localBackupDir() {
    return process.env.BACKUP_LOCAL_DIR || path.join(os.tmpdir(), 'kvassettracker-backups');
  }

  async store(buffer, filename) {
    if (this.providerName() === 'minio') {
      return this.storeMinio(buffer, filename);
    }
    return this.storeLocal(buffer, filename);
  }

  async read(job) {
    const provider = job.metadata?.storage_provider || this.providerName();
    if (provider === 'minio') {
      return this.readMinio(job);
    }
    return this.readLocal(job);
  }

  async storeLocal(buffer, filename) {
    const backupDir = this.localBackupDir();
    await fs.mkdir(backupDir, { recursive: true });
    const fullPath = path.join(backupDir, filename);
    await fs.writeFile(fullPath, buffer, { flag: 'wx' });
    return {
      provider: 'local',
      storage_key: fullPath,
      size_bytes: buffer.length
    };
  }

  async readLocal(job) {
    try {
      return await fs.readFile(job.storage_key);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new ApiError(404, 'Backup artifact not found');
      }
      throw error;
    }
  }

  async storeMinio(buffer, filename) {
    const client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY
    });
    const bucket = process.env.MINIO_BUCKET_BACKUPS;
    const prefix = process.env.BACKUP_PREFIX || 'backups';
    const objectName = `${prefix}/${filename}`;
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket);
    }
    await client.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': 'application/gzip'
    });
    return {
      provider: 'minio',
      storage_key: `${bucket}/${objectName}`,
      size_bytes: buffer.length
    };
  }

  async readMinio(job) {
    const client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY
    });
    const bucket = process.env.MINIO_BUCKET_BACKUPS;
    const objectName = job.storage_key?.startsWith(`${bucket}/`)
      ? job.storage_key.slice(bucket.length + 1)
      : `${process.env.BACKUP_PREFIX || 'backups'}/${job.filename}`;

    return new Promise((resolve, reject) => {
      client.getObject(bucket, objectName, (error, stream) => {
        if (error) {
          if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
            reject(new ApiError(404, 'Backup artifact not found'));
          } else {
            reject(error);
          }
          return;
        }
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
  }
}

module.exports = new StorageProvider();
