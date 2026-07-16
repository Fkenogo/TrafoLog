const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');

const TEST_EMAIL = 'admin.inspection@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TRANSFORMER_ASSET_ID = 'TEST-INSP-T001';

let authToken;
let userId;
let transformerId;
let inspectionId;
let inspectionToDeleteId;

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  // Clean up leftover test data
  const oldUser = await User.findOne({ email: TEST_EMAIL });
  if (oldUser) {
    await Inspection.deleteMany({ inspector_id: oldUser._id });
    await User.deleteOne({ _id: oldUser._id });
  }
  await Transformer.deleteOne({ asset_id: TRANSFORMER_ASSET_ID });

  // Register test user
  await request(app.getApp())
    .post('/api/auth/register')
    .send({ name: 'Inspection Admin', email: TEST_EMAIL, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD, role: 'Super Admin' });

  // Login
  const loginRes = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  authToken = loginRes.body.data.accessToken;

  // Get user id for direct model creation
  const user = await User.findOne({ email: TEST_EMAIL });
  userId = user._id;

  // Create test transformer directly (bypass API validator complexity)
  // gps.coordinates required to satisfy the 2dsphere index
  const transformer = await Transformer.create({
    asset_id: TRANSFORMER_ASSET_ID,
    network_voltage_kv: 11,
    gps: { type: 'Point', coordinates: [32.5819, 0.3476] }
  });
  transformerId = transformer._id;

  // Create two test inspections via API (uses implemented `create` endpoint)
  const res1 = await request(app.getApp())
    .post('/api/inspections')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ transformer_id: String(transformerId) });
  inspectionId = res1.body.data._id;

  const res2 = await request(app.getApp())
    .post('/api/inspections')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ transformer_id: String(transformerId), visit_type: 'Follow-up' });
  inspectionToDeleteId = res2.body.data._id;
});

afterAll(async () => {
  await Inspection.deleteMany({ transformer_id: transformerId });
  await Transformer.deleteOne({ asset_id: TRANSFORMER_ASSET_ID });
  await User.deleteOne({ email: TEST_EMAIL });
  await database.disconnect();
  await redis.disconnect();
});

describe('GET /api/inspections', () => {
  it('returns paginated list for authenticated users', async () => {
    const res = await request(app.getApp())
      .get('/api/inspections')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it('filters by transformer_id', async () => {
    const res = await request(app.getApp())
      .get(`/api/inspections?transformer_id=${transformerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
    expect(String(res.body.data.data[0].transformer_id._id)).toBe(String(transformerId));
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app.getApp()).get('/api/inspections');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/inspections/overdue', () => {
  it('returns list of transformers with overdue inspections', async () => {
    const res = await request(app.getApp())
      .get('/api/inspections/overdue')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts custom days parameter', async () => {
    const res = await request(app.getApp())
      .get('/api/inspections/overdue?days=1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/inspections/latest/:transformerId', () => {
  it('returns the most recent inspection for a transformer', async () => {
    const res = await request(app.getApp())
      .get(`/api/inspections/latest/${transformerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(String(res.body.data.transformer_id)).toBe(String(transformerId));
  });

  it('returns 404 for a transformer with no inspections', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app.getApp())
      .get(`/api/inspections/latest/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/inspections/:id', () => {
  it('returns inspection detail for a valid inspection', async () => {
    const res = await request(app.getApp())
      .get(`/api/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('_id', String(inspectionId));
    expect(res.body.data).toHaveProperty('transformer_id');
  });

  it('returns a clean 404 for a non-existent inspection', async () => {
    const fakeId = '000000000000000000000003';
    const res = await request(app.getApp())
      .get(`/api/inspections/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Inspection not found');
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp()).get(`/api/inspections/${inspectionId}`);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/inspections/:id', () => {
  it('updates an inspection and returns the updated record', async () => {
    const res = await request(app.getApp())
      .put(`/api/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ transformer_id: String(transformerId), visit_type: 'Audit', recommended_action: 'Monitor' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.visit_type).toBe('Audit');
  });

  it('returns 404 for a non-existent inspection', async () => {
    const fakeId = '000000000000000000000002';
    const res = await request(app.getApp())
      .put(`/api/inspections/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ transformer_id: String(transformerId), visit_type: 'Audit' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/inspections/:id', () => {
  it('soft-deletes an inspection (Super Admin only)', async () => {
    const res = await request(app.getApp())
      .delete(`/api/inspections/${inspectionToDeleteId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for a non-existent inspection', async () => {
    const fakeId = '000000000000000000000003';
    const res = await request(app.getApp())
      .delete(`/api/inspections/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
