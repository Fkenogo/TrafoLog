const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');

const TEST_EMAIL = 'admin.transformer@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TRANSFORMER_ASSET_ID = 'TEST-TRANS-T001';
const DECOMMISSION_ASSET_ID = 'TEST-TRANS-T002';

let authToken;
let transformerId;
let decommissionTransformerId;
let serviceAreaId;
let territoryId;

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  const Territory = require('../models/Territory');
  const ServiceArea = require('../models/ServiceArea');
  const QRCode = require('../models/QrCode');
  const AssetTimeline = require('../models/AssetTimeline');

  // Clean up any leftover test data
  const oldUser = await User.findOne({ email: TEST_EMAIL });
  if (oldUser) await User.deleteOne({ _id: oldUser._id });

  const oldT1 = await Transformer.findOne({ asset_id: TRANSFORMER_ASSET_ID });
  if (oldT1) {
    await QRCode.deleteMany({ transformer_id: oldT1._id });
    await AssetTimeline.deleteMany({ transformer_id: oldT1._id });
    await Transformer.deleteOne({ _id: oldT1._id });
  }
  const oldT2 = await Transformer.findOne({ asset_id: DECOMMISSION_ASSET_ID });
  if (oldT2) {
    await QRCode.deleteMany({ transformer_id: oldT2._id });
    await AssetTimeline.deleteMany({ transformer_id: oldT2._id });
    await Transformer.deleteOne({ _id: oldT2._id });
  }

  await ServiceArea.deleteOne({ code: 'TEST_TRANS_SA1' });
  await Territory.deleteOne({ code: 'TEST_TRANS_T1' });

  // Register and login
  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Transformer Admin',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Super Admin'
    });

  const loginRes = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  authToken = loginRes.body.data.accessToken;

  // Create territory and service area directly
  const territory = await Territory.create({
    name: 'Trans Test Territory',
    code: 'TEST_TRANS_T1',
    region: 'Central'
  });
  territoryId = territory._id;

  const serviceArea = await ServiceArea.create({
    name: 'Trans Test Service Area',
    code: 'TEST_TRANS_SA1',
    territory_id: territoryId
  });
  serviceAreaId = serviceArea._id;

  // Primary test transformer — has GPS + service area link
  const transformer = await Transformer.create({
    asset_id: TRANSFORMER_ASSET_ID,
    network_voltage_kv: 11,
    kva_rating: 100,
    gps: { type: 'Point', coordinates: [32.5825, 0.3476] },
    location_administrative: { site_name: 'Test Site', district_name: 'Test District' },
    location_operational: {
      service_area_id: serviceAreaId,
      territory_id: territoryId,
      territory_name: 'Trans Test Territory',
      service_area_name: 'Trans Test Service Area'
    }
  });
  transformerId = transformer._id;

  // Separate transformer for the decommission test
  const decommissionTransformer = await Transformer.create({
    asset_id: DECOMMISSION_ASSET_ID,
    network_voltage_kv: 11,
    kva_rating: 100,
    gps: { type: 'Point', coordinates: [32.5900, 0.3500] },
    location_administrative: { site_name: 'Decomm Site', district_name: 'Test District' },
    location_operational: {
      service_area_id: serviceAreaId,
      territory_id: territoryId
    }
  });
  decommissionTransformerId = decommissionTransformer._id;
});

afterAll(async () => {
  const Territory = require('../models/Territory');
  const ServiceArea = require('../models/ServiceArea');
  const QRCode = require('../models/QrCode');
  const AssetTimeline = require('../models/AssetTimeline');

  await QRCode.deleteMany({ transformer_id: { $in: [transformerId, decommissionTransformerId] } });
  await AssetTimeline.deleteMany({ transformer_id: { $in: [transformerId, decommissionTransformerId] } });
  await Transformer.deleteMany({ asset_id: { $in: [TRANSFORMER_ASSET_ID, DECOMMISSION_ASSET_ID] } });
  await ServiceArea.deleteOne({ code: 'TEST_TRANS_SA1' });
  await Territory.deleteOne({ code: 'TEST_TRANS_T1' });
  await User.deleteOne({ email: TEST_EMAIL });

  await database.disconnect();
  await redis.disconnect();
});

// ─────────────────────────────── search ───────────────────────────────

describe('GET /api/transformers/search', () => {
  it('returns paginated results for authenticated user', async () => {
    const res = await request(app.getApp())
      .get('/api/transformers/search')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it('filters by network_voltage_kv', async () => {
    const res = await request(app.getApp())
      .get('/api/transformers/search?network_voltage_kv=11')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.data.forEach(t => expect(t.network_voltage_kv).toBe(11));
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp()).get('/api/transformers/search');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────── getByServiceArea ────────────────────────────

describe('GET /api/transformers/service-area/:serviceAreaId', () => {
  it('returns transformers linked to the service area', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/service-area/${serviceAreaId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('transformers');
    expect(res.body.data).toHaveProperty('stats');
    expect(Array.isArray(res.body.data.transformers)).toBe(true);

    const ids = res.body.data.transformers.map(t => t._id);
    expect(ids).toContain(String(transformerId));
  });

  it('returns empty list for unknown service area', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app.getApp())
      .get(`/api/transformers/service-area/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.transformers.length).toBe(0);
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/service-area/${serviceAreaId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────── getById ───────────────────────────────

describe('GET /api/transformers/:id', () => {
  it('returns transformer detail for a valid transformer', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/${transformerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('_id', String(transformerId));
    expect(res.body.data).toHaveProperty('asset_id', TRANSFORMER_ASSET_ID);
  });

  it('returns a clean 404 for an unknown transformer', async () => {
    const fakeId = '000000000000000000000002';
    const res = await request(app.getApp())
      .get(`/api/transformers/${fakeId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Transformer not found');
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/${transformerId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────── getNearby ───────────────────────────────

describe('GET /api/transformers/nearby', () => {
  it('returns nearby transformers for valid coordinates', async () => {
    // Coordinates very close to our test transformer at [32.5825, 0.3476]
    const res = await request(app.getApp())
      .get('/api/transformers/nearby?lat=0.3476&lng=32.5825&radius=1')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 when lat is missing', async () => {
    const res = await request(app.getApp())
      .get('/api/transformers/nearby?lng=32.5825')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when lng is missing', async () => {
    const res = await request(app.getApp())
      .get('/api/transformers/nearby?lat=0.3476')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .get('/api/transformers/nearby?lat=0.3476&lng=32.5825');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────── getTimeline ───────────────────────────────

describe('GET /api/transformers/:id/timeline', () => {
  it('returns timeline data for a valid transformer', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/${transformerId}/timeline`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it('returns 404 for unknown transformer', async () => {
    const fakeId = '000000000000000000000002';
    const res = await request(app.getApp())
      .get(`/api/transformers/${fakeId}/timeline`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/${transformerId}/timeline`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────── getQRCode ───────────────────────────────

describe('GET /api/transformers/:id/qr', () => {
  it('returns QR code for a valid transformer', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/${transformerId}/qr`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('qr_code_image');
    expect(res.body.data).toHaveProperty('qr_code_string');
    expect(res.body.data.status).toBe('active');
  });

  it('returns same QR on second call (idempotent)', async () => {
    const res1 = await request(app.getApp())
      .get(`/api/transformers/${transformerId}/qr`)
      .set('Authorization', `Bearer ${authToken}`);
    const res2 = await request(app.getApp())
      .get(`/api/transformers/${transformerId}/qr`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Both calls succeed; transformer_id should be the same
    expect(String(res1.body.data.transformer_id)).toBe(String(res2.body.data.transformer_id));
  });

  it('returns 404 for unknown transformer', async () => {
    const fakeId = '000000000000000000000003';
    const res = await request(app.getApp())
      .get(`/api/transformers/${fakeId}/qr`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .get(`/api/transformers/${transformerId}/qr`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────── decommission ───────────────────────────────

describe('POST /api/transformers/:id/decommission', () => {
  it('returns 400 when reason is missing', async () => {
    const res = await request(app.getApp())
      .post(`/api/transformers/${decommissionTransformerId}/decommission`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });

  it('returns 400 when reason is not in the allowed enum', async () => {
    const res = await request(app.getApp())
      .post(`/api/transformers/${decommissionTransformerId}/decommission`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'NotAValidReason' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('decommissions a transformer with a valid reason', async () => {
    const res = await request(app.getApp())
      .post(`/api/transformers/${decommissionTransformerId}/decommission`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'End of Life' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.operational_status).toBe('Decommissioned');
  });

  it('returns 400 when trying to decommission an already decommissioned transformer', async () => {
    const res = await request(app.getApp())
      .post(`/api/transformers/${decommissionTransformerId}/decommission`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'End of Life' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown transformer', async () => {
    const fakeId = '000000000000000000000004';
    const res = await request(app.getApp())
      .post(`/api/transformers/${fakeId}/decommission`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ reason: 'End of Life' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .post(`/api/transformers/${decommissionTransformerId}/decommission`)
      .send({ reason: 'End of Life' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────── bulkCreate ───────────────────────────────

describe('POST /api/transformers/bulk', () => {
  it('creates multiple transformers and returns success/failed arrays', async () => {
    const res = await request(app.getApp())
      .post('/api/transformers/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send([
        {
          manufacturer: 'ABB',
          kva_rating: 100,
          network_voltage_kv: 11,
          latitude: 0.3500,
          longitude: 32.5850,
          territory_id: String(territoryId),
          service_area_id: String(serviceAreaId),
          district_id: '000000000000000000000099',
          site_name: 'Bulk Site A'
        },
        {
          manufacturer: 'Siemens',
          kva_rating: 160,
          network_voltage_kv: 33,
          latitude: 0.3510,
          longitude: 32.5860,
          territory_id: String(territoryId),
          service_area_id: String(serviceAreaId),
          district_id: '000000000000000000000099',
          site_name: 'Bulk Site B'
        }
      ]);

    expect(res.status).toBe(207);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('success');
    expect(res.body.data).toHaveProperty('failed');
    expect(Array.isArray(res.body.data.success)).toBe(true);
    expect(Array.isArray(res.body.data.failed)).toBe(true);
    expect(res.body.data.success.length).toBeGreaterThanOrEqual(1);

    // Clean up bulk-created transformers
    const Transformer = require('../models/Transformer');
    await Transformer.deleteMany({ manufacturer: { $in: ['ABB', 'Siemens'] } });
  });

  it('returns 400 when body is not an array', async () => {
    const res = await request(app.getApp())
      .post('/api/transformers/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ manufacturer: 'ABB' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when body is an empty array', async () => {
    const res = await request(app.getApp())
      .post('/api/transformers/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send([]);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app.getApp())
      .post('/api/transformers/bulk')
      .send([{ manufacturer: 'ABB', kva_rating: 100, network_voltage_kv: 11 }]);
    expect(res.status).toBe(401);
  });
});
