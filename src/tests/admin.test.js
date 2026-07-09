const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const BackupJob = require('../models/BackupJob');
const Transformer = require('../models/Transformer');

jest.setTimeout(30000);

const ADMIN_EMAIL = 'admin.readonly@example.com';
const VIEWER_EMAIL = 'viewer.readonly@example.com';
const TARGET_EMAIL = 'target.readonly@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TEST_BACKUP_PREFIX = 'admin-test-backup';

let adminToken;
let viewerToken;
let adminId;
let viewerId;
let targetId;
let territoryId;
let serviceAreaId;
let restoreBackupId;
let restoreTransformerId;
let restoreTransformerOriginalSite;

const emails = [ADMIN_EMAIL, VIEWER_EMAIL, TARGET_EMAIL];

const authed = (method, path, token = adminToken) => request(app.getApp())
  [method](path)
  .set('Authorization', `Bearer ${token}`);

const expectSafeUser = (user) => {
  expect(user).toBeDefined();
  expect(user).not.toHaveProperty('password');
  expect(user).not.toHaveProperty('refresh_tokens');
  expect(user).not.toHaveProperty('reset_password_token');
  expect(user).not.toHaveProperty('email_verification_token');
  expect(user).not.toHaveProperty('two_factor_secret');
  expect(user).not.toHaveProperty('push_tokens');
};

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  const oldUsers = await User.find({ email: { $in: emails } });
  const oldUserIds = oldUsers.map((user) => user._id);
  await AuditLog.deleteMany({
    $or: [
      { user_id: { $in: oldUserIds } },
      { target_user_id: { $in: oldUserIds } },
      { target_record_id: { $in: oldUserIds } }
    ]
  });
  await User.deleteMany({ email: { $in: emails } });
  await BackupJob.deleteMany({ filename: { $regex: TEST_BACKUP_PREFIX } });
  await Transformer.deleteMany({ asset_id: { $regex: /^RESTORE-TEST-/ } });

  territoryId = new mongoose.Types.ObjectId();
  serviceAreaId = new mongoose.Types.ObjectId();

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Read Only Admin',
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Super Admin'
    });

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Read Only Viewer',
      email: VIEWER_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Viewer'
    });

  const adminLogin = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });
  adminToken = adminLogin.body.data.accessToken;

  const viewerLogin = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: VIEWER_EMAIL, password: TEST_PASSWORD });
  viewerToken = viewerLogin.body.data.accessToken;

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const viewer = await User.findOne({ email: VIEWER_EMAIL });
  adminId = admin._id;
  viewerId = viewer._id;

  const target = await User.create({
    name: 'Read Only Target Engineer',
    email: TARGET_EMAIL,
    password: TEST_PASSWORD,
    role: 'Engineer',
    territory_id: territoryId,
    service_area_id: serviceAreaId,
    created_by: adminId
  });
  targetId = target._id;

  await AuditLog.create([
    {
      user_id: adminId,
      action: 'USER_UPDATE',
      action_category: 'USER_MANAGEMENT',
      target_user_id: targetId,
      target_record_type: 'User',
      target_record_id: targetId,
      details: 'Admin read-only test update'
    },
    {
      user_id: viewerId,
      action: 'LOGIN',
      action_category: 'AUTH',
      details: 'Viewer login for admin read-only test'
    }
  ]);
});

afterAll(async () => {
  const users = await User.find({ email: { $in: emails } });
  const userIds = users.map((user) => user._id);
  await AuditLog.deleteMany({
    $or: [
      { user_id: { $in: userIds } },
      { target_user_id: { $in: userIds } },
      { target_record_id: { $in: userIds } }
    ],
    action: { $not: /^SYSTEM_BACKUP_/ }
  });
  await AuditLog.deleteMany({
    user_id: adminId,
    action: /^SYSTEM_BACKUP_/
  });
  await User.deleteMany({ email: { $in: emails } });
  await Transformer.deleteMany({ asset_id: { $regex: /^RESTORE-TEST-/ } });
  await BackupJob.deleteMany({ filename: { $regex: TEST_BACKUP_PREFIX } });
  await database.disconnect();
  await redis.disconnect();
});

describe('Admin Read-Only API', () => {
  test('requires authentication', async () => {
    const res = await request(app.getApp()).get('/api/admin/system-stats');

    expect(res.statusCode).toBe(401);
  });

  test('rejects non-Super Admin users', async () => {
    const res = await authed('get', '/api/admin/system-stats', viewerToken);

    expect(res.statusCode).toBe(403);
  });

  test('Super Admin can get system stats', async () => {
    const res = await authed('get', '/api/admin/system-stats');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('system stats response shape is read-only operational summary', async () => {
    const res = await authed('get', '/api/admin/system-stats');

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      users: {
        total: expect.any(Number),
        active: expect.any(Number),
        by_role: expect.any(Object)
      },
      transformers: {
        total: expect.any(Number),
        by_status: expect.any(Object)
      },
      faults: {
        open: expect.any(Number)
      },
      inspections: {
        overdue: expect.any(Number)
      },
      maintenance: {
        upcoming: expect.any(Number)
      },
      audit: {
        recent_activity_count: expect.any(Number)
      },
      generated_at: expect.any(String)
    });
  });

  test('admin users returns sanitized users', async () => {
    const res = await authed('get', '/api/admin/users?limit=2');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: expect.any(Number),
      pages: expect.any(Number)
    });
    res.body.data.forEach(expectSafeUser);
  });

  test('admin users filters work', async () => {
    const res = await authed('get', '/api/admin/users?search=target.readonly&role=Engineer');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((user) => user.email === TARGET_EMAIL)).toBe(true);
    expect(res.body.data.every((user) => user.role === 'Engineer')).toBe(true);
  });

  test('admin audit logs returns paginated logs', async () => {
    const res = await authed('get', '/api/admin/audit-logs?limit=1');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: expect.any(Number),
      pages: expect.any(Number)
    });
  });

  test('admin audit filters work', async () => {
    const res = await authed('get', '/api/admin/audit-logs?action_category=USER_MANAGEMENT&action=USER_UPDATE');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((log) => log.action === 'USER_UPDATE')).toBe(true);
    expect(res.body.data.every((log) => log.action_category === 'USER_MANAGEMENT')).toBe(true);
  });

  test('restore endpoint requires authentication', async () => {
    const res = await request(app.getApp())
      .post(`/api/admin/restore/${new mongoose.Types.ObjectId()}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${new mongoose.Types.ObjectId()}`
      });

    expect(res.statusCode).toBe(401);
  });

  test('restore endpoint rejects non-Super Admin users', async () => {
    const backupId = new mongoose.Types.ObjectId().toString();
    const res = await authed('post', `/api/admin/restore/${backupId}`, viewerToken)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${backupId}`
      });

    expect(res.statusCode).toBe(403);
  });

  test('maintenance endpoint requires authentication', async () => {
    const res = await request(app.getApp())
      .post('/api/admin/maintenance')
      .send({ enabled: true, message: 'System is under maintenance' });

    expect(res.statusCode).toBe(401);
  });

  test('maintenance endpoint rejects non-Super Admin users', async () => {
    const res = await authed('post', '/api/admin/maintenance', viewerToken)
      .send({ enabled: true, message: 'System is under maintenance' });

    expect(res.statusCode).toBe(403);
  });

  test('Super Admin can enable maintenance mode', async () => {
    const res = await authed('post', '/api/admin/maintenance')
      .send({
        enabled: true,
        message: 'System is under maintenance',
        reason: 'Admin test window'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      enabled: true,
      message: 'System is under maintenance',
      reason: 'Admin test window',
      enabled_by: expect.any(String),
      disabled_by: null
    });
    expect(res.body.data.enabled_at).toEqual(expect.any(String));
    expect(res.body.data.updated_at).toEqual(expect.any(String));
  });

  test('maintenance state persists and can be read by Super Admin', async () => {
    const res = await authed('get', '/api/admin/maintenance');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      enabled: true,
      message: 'System is under maintenance',
      reason: 'Admin test window'
    });
  });

  test('normal user write request returns 503 while maintenance is enabled', async () => {
    const res = await authed('post', '/api/transformers', viewerToken)
      .set('X-Maintenance-Test-Enforce', 'true')
      .send({});

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      message: 'System is under maintenance',
      maintenance: {
        enabled: true,
        message: 'System is under maintenance',
        reason: 'Admin test window'
      }
    });
  });

  test('normal user GET request still works while maintenance is enabled', async () => {
    const res = await authed('get', '/api/transformers', viewerToken);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Super Admin can still call admin maintenance endpoint while enabled', async () => {
    const res = await authed('post', '/api/admin/maintenance')
      .send({
        enabled: false,
        reason: 'Admin test complete'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      enabled: false,
      reason: 'Admin test complete',
      disabled_by: expect.any(String)
    });
    expect(res.body.data.disabled_at).toEqual(expect.any(String));
  });

  test('maintenance changes write SYSTEM audit logs', async () => {
    const logs = await AuditLog.find({
      user_id: adminId,
      action: { $in: ['SYSTEM_MAINTENANCE_ENABLED', 'SYSTEM_MAINTENANCE_DISABLED'] },
      action_category: 'SYSTEM'
    });

    expect(logs.some((log) => log.action === 'SYSTEM_MAINTENANCE_ENABLED')).toBe(true);
    expect(logs.some((log) => log.action === 'SYSTEM_MAINTENANCE_DISABLED')).toBe(true);
  });

  test('backup requires maintenance mode before starting', async () => {
    const res = await authed('post', '/api/admin/backup')
      .send({ backup_name: `${TEST_BACKUP_PREFIX}-maintenance-required` });

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Enable Maintenance Mode before creating a backup.'
    });
  });

  test('restore requires maintenance mode before validation', async () => {
    const backupId = new mongoose.Types.ObjectId().toString();
    const res = await authed('post', `/api/admin/restore/${backupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${backupId}`
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Enable Maintenance Mode before restoring a backup.');
  });

  test('Super Admin can create a completed backup while maintenance mode is enabled', async () => {
    await authed('post', '/api/admin/maintenance')
      .send({
        enabled: true,
        message: 'System is under maintenance',
        reason: 'Backup test window'
      });

    const transformer = await Transformer.create({
      asset_id: `RESTORE-TEST-${Date.now()}`,
      manufacturer: 'Restore Test Manufacturer',
      serial_number: `RESTORE-SN-${Date.now()}`,
      kva_rating: 100,
      network_voltage_kv: 11,
      display_rating: '100kVA/11kV',
      operational_status: 'Active',
      location_administrative: {
        site_name: 'Restore Original Site'
      },
      gps: {
        type: 'Point',
        coordinates: [32.58, 0.34]
      },
      created_by: adminId
    });
    restoreTransformerId = transformer._id;
    restoreTransformerOriginalSite = transformer.location_administrative.site_name;

    const res = await authed('post', '/api/admin/backup')
      .send({
        backup_name: `${TEST_BACKUP_PREFIX}-completed`,
        retention_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        collections: ['transformers'],
        metadata: { purpose: 'admin test' }
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      backup_id: expect.stringMatching(/^BKP-/),
      filename: expect.stringContaining(TEST_BACKUP_PREFIX),
      storage_key: expect.any(String),
      status: 'COMPLETED',
      created_by: expect.any(String),
      checksum: expect.any(String),
      compression: 'gzip',
      encryption: false,
      size_bytes: expect.any(Number),
      schema_version: expect.any(String),
      app_version: expect.any(String),
      metadata: expect.objectContaining({ purpose: 'admin test' })
    });
    expect(res.body.data.collections.length).toBeGreaterThan(0);
    expect(res.body.data.manifest).toMatchObject({
      backup_id: res.body.data.backup_id,
      checksum: res.body.data.checksum,
      compression: 'gzip',
      encryption: false,
      collections: expect.any(Array)
    });
    restoreBackupId = res.body.data.backup_id;
  });

  test('restore requires an existing completed backup', async () => {
    const backupId = 'BKP-DOES-NOT-EXIST';
    const res = await authed('post', `/api/admin/restore/${backupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${backupId}`
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Backup not found');
  });

  test('restore requires typed confirmation', async () => {
    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: 'RESTORE BACKUP wrong-id'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(`Confirmation must exactly match: RESTORE BACKUP ${restoreBackupId}`);
  });

  test('dry-run validates artifact without mutation', async () => {
    await Transformer.findByIdAndUpdate(restoreTransformerId, {
      'location_administrative.site_name': 'Restore Mutated Site'
    });

    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['transformers']
      });

    const transformer = await Transformer.findById(restoreTransformerId);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        dryRun: true,
        backup_id: restoreBackupId,
        verified: true,
        collections: ['transformers'],
        plan: {
          collections: expect.any(Array),
          total_documents: expect.any(Number)
        },
        warnings: expect.any(Array)
      }
    });
    expect(transformer.location_administrative.site_name).toBe('Restore Mutated Site');
  });

  test('checksum mismatch rejects restore', async () => {
    const job = await BackupJob.findOne({ backup_id: restoreBackupId });
    const originalChecksum = job.checksum;
    job.checksum = 'bad-checksum';
    await job.save();

    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['transformers']
      });

    job.checksum = originalChecksum;
    await job.save();

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Backup artifact checksum verification failed');
  });

  test('missing artifact rejects restore', async () => {
    const job = await BackupJob.findOne({ backup_id: restoreBackupId });
    const originalKey = job.storage_key;
    job.storage_key = '/tmp/kvassettracker-backups/missing-restore-artifact.json.gz';
    await job.save();

    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['transformers']
      });

    job.storage_key = originalKey;
    await job.save();

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Backup artifact not found');
  });

  test('malformed payload rejects restore', async () => {
    const job = await BackupJob.findOne({ backup_id: restoreBackupId });
    const originalKey = job.storage_key;
    const originalChecksum = job.checksum;
    const malformedPath = `${originalKey}.malformed`;
    await fs.writeFile(malformedPath, Buffer.from('not a gzip payload'));
    job.storage_key = malformedPath;
    job.checksum = require('crypto').createHash('sha256').update(Buffer.from('not a gzip payload')).digest('hex');
    await job.save();

    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['transformers']
      });

    job.storage_key = originalKey;
    job.checksum = originalChecksum;
    await job.save();
    await fs.unlink(malformedPath).catch(() => {});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Backup artifact payload is invalid');
  });

  test('invalid collection rejects restore', async () => {
    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['sessions']
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Collection is not allowed for restore: sessions');
  });

  test('concurrent backup or restore operations are blocked', async () => {
    const running = await BackupJob.create({
      backup_id: 'BKP-RUNNING-RESTORE-LOCK',
      filename: `${TEST_BACKUP_PREFIX}-running-lock.json.gz`,
      status: 'RUNNING',
      started_at: new Date(),
      created_by: adminId,
      compression: 'gzip',
      encryption: false
    });

    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['transformers']
      });

    await BackupJob.deleteOne({ _id: running._id });
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Another backup or restore operation is already running.');
  });

  test('successful restore creates pre-restore backup and mutates only allowlisted collections', async () => {
    await Transformer.findByIdAndUpdate(restoreTransformerId, {
      'location_administrative.site_name': 'Restore Mutated Site'
    });

    const res = await authed('post', `/api/admin/restore/${restoreBackupId}`)
      .send({
        dryRun: false,
        confirmation: `RESTORE BACKUP ${restoreBackupId}`,
        collections: ['transformers']
      });

    const restored = await Transformer.findById(restoreTransformerId);
    const preRestore = await BackupJob.findOne({ backup_id: res.body.data.pre_restore_backup_id });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        dryRun: false,
        backup_id: restoreBackupId,
        pre_restore_backup_id: expect.stringMatching(/^BKP-/),
        restored_collections: ['transformers'],
        restored_counts: {
          transformers: expect.any(Number)
        },
        completed_at: expect.any(String)
      }
    });
    expect(preRestore).toBeTruthy();
    expect(preRestore.metadata.restore_source_backup_id).toBe(restoreBackupId);
    expect(restored.location_administrative.site_name).toBe(restoreTransformerOriginalSite);
  });

  test('restore audit logs are written', async () => {
    const logs = await AuditLog.find({
      user_id: adminId,
      action: {
        $in: ['SYSTEM_RESTORE_DRY_RUN', 'SYSTEM_RESTORE_STARTED', 'SYSTEM_RESTORE_COMPLETED']
      },
      action_category: 'SYSTEM'
    });

    expect(logs.some((log) => log.action === 'SYSTEM_RESTORE_DRY_RUN')).toBe(true);
    expect(logs.some((log) => log.action === 'SYSTEM_RESTORE_STARTED')).toBe(true);
    expect(logs.some((log) => log.action === 'SYSTEM_RESTORE_COMPLETED')).toBe(true);
  });

  test('backup history returns metadata without download URLs', async () => {
    const res = await authed('get', '/api/admin/backups?limit=5');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 5,
      total: expect.any(Number),
      pages: expect.any(Number)
    });
    expect(res.body.data.some((backup) => backup.status === 'COMPLETED')).toBe(true);
    res.body.data.forEach((backup) => {
      expect(backup).not.toHaveProperty('download_url');
      expect(backup).not.toHaveProperty('signed_url');
    });
  });

  test('backup writes started and completed audit logs', async () => {
    const logs = await AuditLog.find({
      user_id: adminId,
      action: { $in: ['SYSTEM_BACKUP_STARTED', 'SYSTEM_BACKUP_COMPLETED'] },
      action_category: 'SYSTEM'
    });

    expect(logs.some((log) => log.action === 'SYSTEM_BACKUP_STARTED')).toBe(true);
    expect(logs.some((log) => log.action === 'SYSTEM_BACKUP_COMPLETED')).toBe(true);
  });

  test('backup failure path records failed status and audit log', async () => {
    const originalBackupDir = process.env.BACKUP_LOCAL_DIR;
    process.env.BACKUP_LOCAL_DIR = '/dev/null/kvassettracker-backups';

    const res = await authed('post', '/api/admin/backup')
      .send({ backup_name: `${TEST_BACKUP_PREFIX}-failed` });

    if (originalBackupDir === undefined) {
      delete process.env.BACKUP_LOCAL_DIR;
    } else {
      process.env.BACKUP_LOCAL_DIR = originalBackupDir;
    }

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toMatchObject({
      status: 'FAILED',
      error_message: expect.any(String)
    });

    const failedLog = await AuditLog.findOne({
      user_id: adminId,
      action: 'SYSTEM_BACKUP_FAILED',
      action_category: 'SYSTEM'
    });

    expect(failedLog).toBeTruthy();
  });

  test('maintenance endpoints remain available after backup support', async () => {
    const status = await authed('get', '/api/admin/maintenance');

    expect(status.statusCode).toBe(200);
    expect(status.body.success).toBe(true);
  });

  test('Super Admin can disable maintenance mode after backup tests', async () => {
    const res = await authed('post', '/api/admin/maintenance')
      .send({
        enabled: false,
        reason: 'Backup test complete'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  });
});
