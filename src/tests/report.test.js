const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');

const TEST_EMAIL = 'admin.report@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TRANSFORMER_ASSET_ID = 'TEST-REPORT-T001';
const MISSING_GPS_ASSET_ID = 'TEST-REPORT-MISSING-GPS';

let authToken;
let userId;
let transformerId;
let missingGpsTransformerId;

const expectReportShape = (res) => {
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data).toHaveProperty('success', true);
  expect(res.body.data).toHaveProperty('data');
  expect(res.body.data).toHaveProperty('summary');
  expect(res.body.data).toHaveProperty('filters');
  expect(res.body.data).toHaveProperty('generated_at');
  expect(Array.isArray(res.body.data.data)).toBe(true);
};

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  const oldUser = await User.findOne({ email: TEST_EMAIL });
  if (oldUser) {
    await Inspection.deleteMany({ inspector_id: oldUser._id });
    await Fault.deleteMany({ reported_by: oldUser._id });
    await Maintenance.deleteMany({ technician_id: oldUser._id });
    await User.deleteOne({ _id: oldUser._id });
  }

  const oldTransformer = await Transformer.findOne({ asset_id: TRANSFORMER_ASSET_ID });
  if (oldTransformer) {
    await Inspection.deleteMany({ transformer_id: oldTransformer._id });
    await Fault.deleteMany({ transformer_id: oldTransformer._id });
    await Maintenance.deleteMany({ transformer_id: oldTransformer._id });
    await Transformer.deleteOne({ _id: oldTransformer._id });
  }
  const oldMissingGpsTransformer = await Transformer.findOne({ asset_id: MISSING_GPS_ASSET_ID });
  if (oldMissingGpsTransformer) {
    await Inspection.deleteMany({ transformer_id: oldMissingGpsTransformer._id });
    await Fault.deleteMany({ transformer_id: oldMissingGpsTransformer._id });
    await Maintenance.deleteMany({ transformer_id: oldMissingGpsTransformer._id });
    await Transformer.deleteOne({ _id: oldMissingGpsTransformer._id });
  }

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Report Admin',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Super Admin'
    });

  const loginRes = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

  authToken = loginRes.body.data.accessToken;
  const user = await User.findOne({ email: TEST_EMAIL });
  userId = user._id;

  const transformer = await Transformer.create({
    asset_id: TRANSFORMER_ASSET_ID,
    manufacturer: 'Report Maker',
    serial_number: 'REPORT-SN-001',
    network_voltage_kv: 11,
    kva_rating: 100,
    display_rating: '100kVA 11kV',
    operational_status: 'Active',
    location_operational: {
      territory_name: 'Report Territory',
      service_area_name: 'Report Service Area',
      feeder_name: 'Report Feeder'
    },
    location_administrative: {
      district_name: 'Report District',
      site_name: 'Report Site'
    },
    gps: { type: 'Point', coordinates: [32.5825, 0.3476] },
    created_by: userId
  });
  transformerId = transformer._id;

  const missingGpsTransformer = await Transformer.create({
    asset_id: MISSING_GPS_ASSET_ID,
    manufacturer: 'Missing GPS Maker',
    serial_number: 'REPORT-SN-MISSING-GPS',
    network_voltage_kv: 11,
    kva_rating: 100,
    display_rating: '100kVA 11kV',
    operational_status: 'Active',
    location_operational: {
      territory_name: 'Report Territory',
      service_area_name: 'Report Service Area',
      feeder_name: 'Report Feeder'
    },
    location_administrative: {
      district_name: 'Report District',
      site_name: 'Missing GPS Site'
    },
    gps: { type: 'Point', coordinates: [32.6000, 0.3600] },
    created_by: userId
  });
  missingGpsTransformerId = missingGpsTransformer._id;
  await Transformer.collection.updateOne(
    { _id: missingGpsTransformerId },
    { $unset: { gps: '' } }
  );

  await Inspection.create({
    transformer_id: transformerId,
    inspector_id: userId,
    inspection_date: new Date('2026-07-01T09:00:00.000Z'),
    visit_type: 'Routine Inspection',
    physical: { overall_condition: 'Good' },
    electrical: { load_percentage: 45 }
  });

  await Fault.create({
    transformer_id: transformerId,
    reported_by: userId,
    fault_date: new Date('2026-07-02T09:00:00.000Z'),
    fault_description: 'Report test overload fault',
    fault_type: 'Overload',
    severity: 'Minor',
    fault_status: 'Open'
  });

  await Maintenance.create({
    transformer_id: transformerId,
    technician_id: userId,
    maintenance_date: new Date('2026-07-03T09:00:00.000Z'),
    maintenance_type: 'Preventive',
    condition_after: 'Good'
  });
});

afterAll(async () => {
  await Inspection.deleteMany({ transformer_id: transformerId });
  await Fault.deleteMany({ transformer_id: transformerId });
  await Maintenance.deleteMany({ transformer_id: transformerId });
  await Inspection.deleteMany({ transformer_id: missingGpsTransformerId });
  await Fault.deleteMany({ transformer_id: missingGpsTransformerId });
  await Maintenance.deleteMany({ transformer_id: missingGpsTransformerId });
  await Transformer.deleteOne({ asset_id: TRANSFORMER_ASSET_ID });
  await Transformer.deleteOne({ asset_id: MISSING_GPS_ASSET_ID });
  await User.deleteOne({ email: TEST_EMAIL });
  await database.disconnect();
  await redis.disconnect();
});

describe('Reports API', () => {
  test('requires authentication', async () => {
    const res = await request(app.getApp()).get('/api/reports/transformers');
    expect(res.statusCode).toBe(401);
  });

  test('transformer report returns frontend-ready JSON shape', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/transformers?format=json')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
    expect(res.body.data.summary).toHaveProperty('total');
  });

  test('inspection report returns frontend-ready JSON shape', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/inspections?format=json')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
  });

  test('fault report returns frontend-ready JSON shape', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/faults?format=json')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
  });

  test('maintenance report returns frontend-ready JSON shape', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/maintenance?format=json')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
  });

  test('asset register report returns frontend-ready JSON shape', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/asset-register?format=json')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
  });

  test('asset register report handles transformers with missing GPS coordinates', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/asset-register?format=json&operational_status=Active')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
    const missingGpsRow = res.body.data.data.find((row) => row['Asset ID'] === MISSING_GPS_ASSET_ID);
    expect(missingGpsRow).toBeTruthy();
    expect(missingGpsRow['GPS Coordinates']).toBe('N/A');
  });

  test('supported filters do not crash reports', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/transformers?format=json&network_voltage_kv=11&kva_rating=100&operational_status=Active&startDate=2026-01-01&endDate=2026-12-31')
      .set('Authorization', `Bearer ${authToken}`);

    expectReportShape(res);
  });

  test('invalid filters return validation error', async () => {
    const res = await request(app.getApp())
      .get('/api/reports/transformers?format=json&network_voltage_kv=99')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });
});
