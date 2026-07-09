const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const Fault = require('../models/Fault');
const Notification = require('../models/Notification');

const TEST_EMAIL = 'admin.fault@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TRANSFORMER_ASSET_ID = 'TEST-FAULT-T001';

let authToken;
let userId;
let transformerId;
let faultId;          // assign → escalate → close-400 test
let faultToCloseId;   // resolve → close-200 test
let faultToDeleteId;  // hard delete test

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  // Clean up leftover test data
  const oldUser = await User.findOne({ email: TEST_EMAIL });
  if (oldUser) {
    await Fault.deleteMany({ reported_by: oldUser._id });
    await Notification.deleteMany({ user_id: oldUser._id });
    await User.deleteOne({ _id: oldUser._id });
  }
  await Transformer.deleteOne({ asset_id: TRANSFORMER_ASSET_ID });

  // Register + login
  await request(app.getApp())
    .post('/api/auth/register')
    .send({ name: 'Fault Admin', email: TEST_EMAIL, password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD, role: 'Super Admin' });

  const loginRes = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  authToken = loginRes.body.data.accessToken;

  const user = await User.findOne({ email: TEST_EMAIL });
  userId = user._id;

  // Create test transformer
  // coordinates required for 2dsphere index; location_administrative required by notification email templates
  const transformer = await Transformer.create({
    asset_id: TRANSFORMER_ASSET_ID,
    network_voltage_kv: 11,
    gps: { type: 'Point', coordinates: [32.5825, 0.3476] },
    location_administrative: { site_name: 'Test Site', district_name: 'Test District' }
  });
  transformerId = transformer._id;

  // Create test faults via API
  const res1 = await request(app.getApp())
    .post('/api/faults')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      transformer_id: String(transformerId),
      fault_description: 'Transformer overloading during peak hours repeatedly',
      fault_type: 'Overload',
      severity: 'Minor'
    });
  faultId = res1.body.data._id;

  const res2 = await request(app.getApp())
    .post('/api/faults')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      transformer_id: String(transformerId),
      fault_description: 'Oil leakage detected at the base of transformer unit',
      fault_type: 'Oil Leak',
      severity: 'Major'
    });
  faultToCloseId = res2.body.data._id;

  const res3 = await request(app.getApp())
    .post('/api/faults')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      transformer_id: String(transformerId),
      fault_description: 'Bushing failure detected during routine inspection',
      fault_type: 'Bushing Failure',
      severity: 'Critical'
    });
  faultToDeleteId = res3.body.data._id;
});

afterAll(async () => {
  await Fault.deleteMany({ transformer_id: transformerId });
  await Notification.deleteMany({ user_id: userId });
  await Transformer.deleteOne({ asset_id: TRANSFORMER_ASSET_ID });
  await User.deleteOne({ email: TEST_EMAIL });
  await database.disconnect();
  await redis.disconnect();
});

describe('POST /api/faults — create fault', () => {
  it('creates three faults in setup', () => {
    expect(faultId).toBeDefined();
    expect(faultToCloseId).toBeDefined();
    expect(faultToDeleteId).toBeDefined();
  });
});

describe('GET /api/faults', () => {
  it('returns paginated list of faults', async () => {
    const res = await request(app.getApp())
      .get('/api/faults')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it('filters by transformer_id', async () => {
    const res = await request(app.getApp())
      .get(`/api/faults?transformer_id=${transformerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by status', async () => {
    const res = await request(app.getApp())
      .get('/api/faults?status=Open')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    if (res.body.data.data.length > 0) {
      expect(res.body.data.data[0].fault_status).toBe('Open');
    }
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app.getApp()).get('/api/faults');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/faults/open', () => {
  it('returns open faults list', async () => {
    const res = await request(app.getApp())
      .get('/api/faults/open')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/faults/:id', () => {
  it('returns a fault by id', async () => {
    const res = await request(app.getApp())
      .get(`/api/faults/${faultId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(faultId);
    expect(res.body.data.fault_type).toBe('Overload');
  });

  it('returns 404 for a non-existent fault', async () => {
    const res = await request(app.getApp())
      .get('/api/faults/000000000000000000000001')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/faults/:id', () => {
  it('updates editable fault fields without changing immutable ownership', async () => {
    const res = await request(app.getApp())
      .put(`/api/faults/${faultId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fault_description: 'Transformer overload confirmed after field review',
        severity: 'Major',
        customers_affected: 12,
        area_affected: 'Test Site feeder segment'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fault_description).toBe('Transformer overload confirmed after field review');
    expect(res.body.data.severity).toBe('Major');
    expect(res.body.data.customers_affected).toBe(12);
    expect(res.body.data.reported_by).toBeDefined();
  });
});

describe('PUT /api/faults/:id/assign', () => {
  it('assigns fault to current user', async () => {
    await Notification.deleteMany({ user_id: userId, type: 'FAULT_ASSIGNED' });

    const res = await request(app.getApp())
      .put(`/api/faults/${faultId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ assigned_to: String(userId) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fault_status).toBe('Assigned');

    const notification = await Notification.findOne({
      user_id: userId,
      type: 'FAULT_ASSIGNED'
    });
    expect(notification).toBeTruthy();
    expect(String(notification.data.fault_id)).toBe(res.body.data._id);
  });
});

describe('GET /api/faults/assigned-to-me', () => {
  it('returns faults assigned to the current user', async () => {
    const res = await request(app.getApp())
      .get('/api/faults/assigned-to-me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map(f => f._id);
    expect(ids).toContain(faultId);
  });
});

describe('PUT /api/faults/:id/escalate', () => {
  it('escalates a fault and sets status to In Progress', async () => {
    const res = await request(app.getApp())
      .put(`/api/faults/${faultId}/escalate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'Repeated overloading requires urgent senior management attention' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fault_status).toBe('In Progress');
  });
});

describe('PUT /api/faults/:id/resolve', () => {
  it('resolves a fault', async () => {
    const res = await request(app.getApp())
      .put(`/api/faults/${faultToCloseId}/resolve`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ resolution_description: 'Oil leak sealed and transformer tank fully repaired and tested' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fault_status).toBe('Resolved');
  });
});

describe('PUT /api/faults/:id/close', () => {
  it('returns 400 when closing a non-resolved fault', async () => {
    // faultId is 'In Progress' after escalation
    const res = await request(app.getApp())
      .put(`/api/faults/${faultId}/close`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
  });

  it('closes a resolved fault', async () => {
    // faultToCloseId is 'Resolved' after resolve test
    const res = await request(app.getApp())
      .put(`/api/faults/${faultToCloseId}/close`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fault_status).toBe('Closed');
  });
});

describe('GET /api/faults/stats', () => {
  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app.getApp()).get('/api/faults/stats');
    expect(res.status).toBe(401);
  });

  it('returns 200 with stats for authenticated user', async () => {
    const res = await request(app.getApp())
      .get('/api/faults/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('response includes expected stats fields', async () => {
    const res = await request(app.getApp())
      .get('/api/faults/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('open');
    expect(data).toHaveProperty('resolved');
    expect(data).toHaveProperty('closed');
    expect(data).toHaveProperty('critical');
    expect(data).toHaveProperty('major');
    expect(data).toHaveProperty('minor');
    expect(data).toHaveProperty('typeBreakdown');
    expect(data).toHaveProperty('monthlyTrend');
    expect(Array.isArray(data.typeBreakdown)).toBe(true);
    expect(Array.isArray(data.monthlyTrend)).toBe(true);
    expect(typeof data.total).toBe('number');
    expect(data.total).toBeGreaterThanOrEqual(0);
  });
});

describe('DELETE /api/faults/:id', () => {
  it('hard-deletes a fault (Super Admin only)', async () => {
    const res = await request(app.getApp())
      .delete(`/api/faults/${faultToDeleteId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for a non-existent fault', async () => {
    const res = await request(app.getApp())
      .delete('/api/faults/000000000000000000000002')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
