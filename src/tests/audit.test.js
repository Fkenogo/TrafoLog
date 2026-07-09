const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const AuditLog = require('../models/AuditLog');

jest.setTimeout(30000);

const ADMIN_EMAIL = 'admin.audit@example.com';
const MANAGER_EMAIL = 'manager.audit@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TRANSFORMER_ASSET_ID = 'TEST-AUDIT-T001';

let adminToken;
let managerToken;
let adminId;
let managerId;
let transformerId;
let territoryId;
let serviceAreaId;

const authedGet = (path) => request(app.getApp())
  .get(path)
  .set('Authorization', `Bearer ${adminToken}`);

const expectAuditListShape = (res) => {
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body.pagination).toMatchObject({
    page: expect.any(Number),
    limit: expect.any(Number),
    total: expect.any(Number),
    pages: expect.any(Number)
  });
};

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  const oldUsers = await User.find({ email: { $in: [ADMIN_EMAIL, MANAGER_EMAIL] } });
  const oldUserIds = oldUsers.map((user) => user._id);
  const oldTransformer = await Transformer.findOne({ asset_id: TRANSFORMER_ASSET_ID });
  const cleanupTransformerIds = oldTransformer ? [oldTransformer._id] : [];

  await AuditLog.deleteMany({
    $or: [
      { user_id: { $in: oldUserIds } },
      { target_user_id: { $in: oldUserIds } },
      { target_transformer_id: { $in: cleanupTransformerIds } }
    ]
  });
  await Transformer.deleteMany({ asset_id: TRANSFORMER_ASSET_ID });
  await User.deleteMany({ email: { $in: [ADMIN_EMAIL, MANAGER_EMAIL] } });

  territoryId = new mongoose.Types.ObjectId();
  serviceAreaId = new mongoose.Types.ObjectId();

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Audit Admin',
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Super Admin'
    });

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Audit Manager',
      email: MANAGER_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Territory Manager',
      territory_id: territoryId
    });

  const adminLogin = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });
  adminToken = adminLogin.body.data.accessToken;

  const managerLogin = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: MANAGER_EMAIL, password: TEST_PASSWORD });
  managerToken = managerLogin.body.data.accessToken;

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const manager = await User.findOne({ email: MANAGER_EMAIL });
  adminId = admin._id;
  managerId = manager._id;

  const transformer = await Transformer.create({
    asset_id: TRANSFORMER_ASSET_ID,
    manufacturer: 'Audit Maker',
    serial_number: 'AUDIT-SN-001',
    network_voltage_kv: 11,
    kva_rating: 100,
    display_rating: '100kVA 11kV',
    operational_status: 'Active',
    location_operational: {
      territory_id: territoryId,
      territory_name: 'Audit Territory',
      service_area_id: serviceAreaId,
      service_area_name: 'Audit Service Area'
    },
    location_administrative: {
      district_name: 'Audit District',
      site_name: 'Audit Site'
    },
    gps: { type: 'Point', coordinates: [32.5825, 0.3476] },
    created_by: adminId
  });
  transformerId = transformer._id;

  await AuditLog.create([
    {
      user_id: adminId,
      action: 'USER_CREATE',
      action_category: 'USER_MANAGEMENT',
      target_user_id: managerId,
      target_record_type: 'User',
      target_record_id: managerId,
      details: 'Created test manager',
      request_method: 'POST',
      request_path: '/api/users',
      ip_address: '127.0.0.1',
      user_agent: 'audit-test-agent',
      old_values: {
        password: 'OldSecret123!',
        reset_password_token: 'old-reset-token',
        refresh_tokens: ['old-refresh-token']
      },
      new_values: {
        password: 'NewSecret123!',
        email_verification_token: 'new-verification-token',
        two_factor_secret: 'new-two-factor-secret'
      },
      metadata: {
        refreshToken: 'metadata-refresh-token',
        safe_note: 'visible metadata'
      }
    },
    {
      user_id: adminId,
      action: 'TRANSFORMER_UPDATE',
      action_category: 'TRANSFORMER_MANAGEMENT',
      target_transformer_id: transformerId,
      target_record_type: 'Transformer',
      target_record_id: transformerId,
      details: 'Updated transformer during audit test',
      request_method: 'PUT',
      request_path: `/api/transformers/${transformerId}`
    },
    {
      user_id: managerId,
      action: 'LOGIN',
      action_category: 'AUTH',
      details: 'Manager login audit test',
      request_method: 'POST',
      request_path: '/api/auth/login',
      is_sensitive: true
    }
  ]);
});

afterAll(async () => {
  await AuditLog.deleteMany({
    $or: [
      { user_id: { $in: [adminId, managerId] } },
      { target_user_id: { $in: [adminId, managerId] } },
      { target_transformer_id: transformerId }
    ]
  });
  await Transformer.deleteOne({ asset_id: TRANSFORMER_ASSET_ID });
  await User.deleteMany({ email: { $in: [ADMIN_EMAIL, MANAGER_EMAIL] } });
  await database.disconnect();
  await redis.disconnect();
});

describe('Audit API', () => {
  test('requires authentication', async () => {
    const res = await request(app.getApp()).get('/api/audit');
    expect(res.statusCode).toBe(401);
  });

  test('rejects non-Super Admin users', async () => {
    const res = await request(app.getApp())
      .get('/api/audit')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(403);
  });

  test('Super Admin can list audit logs', async () => {
    const res = await authedGet('/api/audit');

    expectAuditListShape(res);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('action');
    expect(res.body.data[0]).toHaveProperty('action_category');
  });

  test('pagination works', async () => {
    const res = await authedGet('/api/audit?page=1&limit=1');

    expectAuditListShape(res);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 1
    });
    expect(res.body.pagination.total).toBeGreaterThan(1);
  });

  test('filters work', async () => {
    const res = await authedGet('/api/audit?action_category=USER_MANAGEMENT&action=USER_CREATE&is_sensitive=true');

    expectAuditListShape(res);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((log) => log.action_category === 'USER_MANAGEMENT')).toBe(true);
    expect(res.body.data.every((log) => log.action === 'USER_CREATE')).toBe(true);
    expect(res.body.data.every((log) => log.is_sensitive === true)).toBe(true);
  });

  test('user-specific logs work', async () => {
    const res = await authedGet(`/api/audit/user/${managerId}`);

    expectAuditListShape(res);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((log) => {
      const userId = log.user_id?._id || log.user_id;
      return userId === managerId.toString();
    })).toBe(true);
  });

  test('transformer-specific logs work', async () => {
    const res = await authedGet(`/api/audit/transformers/${transformerId}`);

    expectAuditListShape(res);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((log) => {
      const targetTransformerId = log.target_transformer_id?._id || log.target_transformer_id;
      return targetTransformerId === transformerId.toString();
    })).toBe(true);
  });

  test('actions endpoint returns expected shape', async () => {
    const res = await authedGet('/api/audit/actions');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(Array.isArray(res.body.data.actions)).toBe(true);
    expect(res.body.data.categories).toContain('AUTH');
    expect(res.body.data.actions).toContain('USER_CREATE');
  });

  test('sensitive password and token values are redacted', async () => {
    const res = await authedGet('/api/audit?action=USER_CREATE');
    const body = JSON.stringify(res.body);

    expect(res.statusCode).toBe(200);
    expect(body).not.toContain('OldSecret123!');
    expect(body).not.toContain('NewSecret123!');
    expect(body).not.toContain('old-reset-token');
    expect(body).not.toContain('old-refresh-token');
    expect(body).not.toContain('new-verification-token');
    expect(body).not.toContain('new-two-factor-secret');
    expect(body).not.toContain('metadata-refresh-token');
    expect(body).toContain('visible metadata');
  });

  test('bad date range returns validation error', async () => {
    const res = await authedGet('/api/audit?startDate=2026-12-31&endDate=2026-01-01');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });
});
