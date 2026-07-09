const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');

const TEST_EMAIL = 'admin.analytics@example.com';
const TEST_PASSWORD = 'Admin@1234';
const PRIMARY_ASSET_ID = 'TEST-ANALYTICS-T001';
const SECONDARY_ASSET_ID = 'TEST-ANALYTICS-T002';

let authToken;
let userId;
let primaryTransformerId;
let secondaryTransformerId;
let territoryId;
let serviceAreaId;
let feederId;
let districtId;

const analyticsGet = (path) => request(app.getApp())
  .get(path)
  .set('Authorization', `Bearer ${authToken}`);

const expectAnalyticsShape = (res) => {
  expect(res.statusCode).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data).toHaveProperty('summary');
  expect(res.body.data).toHaveProperty('breakdowns');
  expect(res.body.data).toHaveProperty('trends');
  expect(res.body.data).toHaveProperty('risks');
  expect(res.body.data).toHaveProperty('filters');
  expect(res.body.data).toHaveProperty('generated_at');
  expect(Array.isArray(res.body.data.trends)).toBe(true);
  expect(Array.isArray(res.body.data.risks)).toBe(true);
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

  const oldTransformers = await Transformer.find({
    asset_id: { $in: [PRIMARY_ASSET_ID, SECONDARY_ASSET_ID] }
  });
  const oldTransformerIds = oldTransformers.map((transformer) => transformer._id);
  if (oldTransformerIds.length > 0) {
    await Inspection.deleteMany({ transformer_id: { $in: oldTransformerIds } });
    await Fault.deleteMany({ transformer_id: { $in: oldTransformerIds } });
    await Maintenance.deleteMany({ transformer_id: { $in: oldTransformerIds } });
    await Transformer.deleteMany({ _id: { $in: oldTransformerIds } });
  }

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Analytics Admin',
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

  territoryId = new mongoose.Types.ObjectId();
  serviceAreaId = new mongoose.Types.ObjectId();
  feederId = new mongoose.Types.ObjectId();
  districtId = new mongoose.Types.ObjectId();

  const primaryTransformer = await Transformer.create({
    asset_id: PRIMARY_ASSET_ID,
    manufacturer: 'Analytics Maker',
    serial_number: 'ANALYTICS-SN-001',
    network_voltage_kv: 11,
    kva_rating: 100,
    display_rating: '100kVA 11kV',
    operational_status: 'Faulty',
    has_open_fault: true,
    overdue_inspection_flag: true,
    location_operational: {
      territory_id: territoryId,
      territory_name: 'Analytics Territory',
      service_area_id: serviceAreaId,
      service_area_name: 'Analytics Service Area',
      feeder_id: feederId,
      feeder_name: 'Analytics Feeder'
    },
    location_administrative: {
      district_id: districtId,
      district_name: 'Analytics District',
      site_name: 'Analytics Primary Site'
    },
    gps: { type: 'Point', coordinates: [32.5825, 0.3476] },
    created_by: userId
  });

  const secondaryTransformer = await Transformer.create({
    asset_id: SECONDARY_ASSET_ID,
    manufacturer: 'Analytics Maker',
    serial_number: 'ANALYTICS-SN-002',
    network_voltage_kv: 33,
    kva_rating: 250,
    display_rating: '250kVA 33kV',
    operational_status: 'Active',
    location_operational: {
      territory_id: territoryId,
      territory_name: 'Analytics Territory',
      service_area_id: serviceAreaId,
      service_area_name: 'Analytics Service Area',
      feeder_id: feederId,
      feeder_name: 'Analytics Feeder'
    },
    location_administrative: {
      district_id: districtId,
      district_name: 'Analytics District',
      site_name: 'Analytics Secondary Site'
    },
    gps: { type: 'Point', coordinates: [32.6, 0.36] },
    created_by: userId
  });

  primaryTransformerId = primaryTransformer._id;
  secondaryTransformerId = secondaryTransformer._id;

  await Inspection.create({
    transformer_id: primaryTransformerId,
    inspector_id: userId,
    inspection_date: new Date('2026-07-01T09:00:00.000Z'),
    visit_type: 'Routine Inspection',
    physical: { overall_condition: 'Critical' },
    recommended_action: 'Urgent Repair'
  });

  await Fault.create([
    {
      transformer_id: primaryTransformerId,
      reported_by: userId,
      fault_date: new Date('2026-07-02T09:00:00.000Z'),
      fault_description: 'Analytics critical overload fault',
      fault_type: 'Overload',
      severity: 'Critical',
      fault_status: 'Open'
    },
    {
      transformer_id: primaryTransformerId,
      reported_by: userId,
      fault_date: new Date('2026-06-02T09:00:00.000Z'),
      fault_description: 'Analytics repeated overload fault',
      fault_type: 'Overload',
      severity: 'Major',
      fault_status: 'Resolved',
      resolved_date: new Date('2026-06-03T09:00:00.000Z')
    }
  ]);

  await Maintenance.create({
    transformer_id: primaryTransformerId,
    technician_id: userId,
    maintenance_date: new Date('2026-07-03T09:00:00.000Z'),
    maintenance_type: 'Preventive',
    next_maintenance_date: new Date('2026-07-20T09:00:00.000Z'),
    sync_status: 'synced'
  });
});

afterAll(async () => {
  await Inspection.deleteMany({ transformer_id: { $in: [primaryTransformerId, secondaryTransformerId] } });
  await Fault.deleteMany({ transformer_id: { $in: [primaryTransformerId, secondaryTransformerId] } });
  await Maintenance.deleteMany({ transformer_id: { $in: [primaryTransformerId, secondaryTransformerId] } });
  await Transformer.deleteMany({ asset_id: { $in: [PRIMARY_ASSET_ID, SECONDARY_ASSET_ID] } });
  await User.deleteOne({ email: TEST_EMAIL });
  await database.disconnect();
  await redis.disconnect();
});

describe('Analytics API', () => {
  test('requires authentication', async () => {
    const res = await request(app.getApp()).get('/api/analytics/transformers');
    expect(res.statusCode).toBe(401);
  });

  test('transformer analytics returns operational summary and breakdowns', async () => {
    const res = await analyticsGet('/api/analytics/transformers');

    expectAnalyticsShape(res);
    expect(res.body.data.summary).toHaveProperty('total_transformers');
    expect(res.body.data.summary).toHaveProperty('missing_gps_count');
    expect(res.body.data.summary).toHaveProperty('decommissioned_count');
    expect(res.body.data.breakdowns).toHaveProperty('by_operational_status');
    expect(res.body.data.breakdowns).toHaveProperty('by_territory');
    expect(res.body.data.breakdowns).toHaveProperty('by_service_area');
    expect(res.body.data.breakdowns).toHaveProperty('by_voltage');
    expect(res.body.data.breakdowns).toHaveProperty('by_kva_rating');
    expect(res.body.data.breakdowns).toHaveProperty('condition_distribution');
  });

  test('fault analytics returns fault totals, trends, and top affected transformers', async () => {
    const res = await analyticsGet('/api/analytics/faults');

    expectAnalyticsShape(res);
    expect(res.body.data.summary).toHaveProperty('total_faults');
    expect(res.body.data.summary).toHaveProperty('open_faults');
    expect(res.body.data.summary).toHaveProperty('resolved_faults');
    expect(res.body.data.breakdowns).toHaveProperty('by_severity');
    expect(res.body.data.breakdowns).toHaveProperty('by_status');
    expect(res.body.data.breakdowns).toHaveProperty('by_fault_type');
    expect(res.body.data.breakdowns).toHaveProperty('top_affected_transformers');
    expect(res.body.data.trends.length).toBeGreaterThan(0);
  });

  test('maintenance analytics returns maintenance totals and trends', async () => {
    const res = await analyticsGet('/api/analytics/maintenance');

    expectAnalyticsShape(res);
    expect(res.body.data.summary).toHaveProperty('total_maintenance_records');
    expect(res.body.data.summary).toHaveProperty('upcoming_maintenance');
    expect(res.body.data.summary).toHaveProperty('overdue_maintenance');
    expect(res.body.data.breakdowns).toHaveProperty('by_maintenance_type');
    expect(res.body.data.breakdowns).toHaveProperty('by_status');
    expect(res.body.data.trends.length).toBeGreaterThan(0);
  });

  test('predictive analytics returns rule-based risk view', async () => {
    const res = await analyticsGet('/api/analytics/predictive');

    expectAnalyticsShape(res);
    expect(res.body.data.summary).toHaveProperty('risk_model', 'Rule-based operational risk');
    expect(res.body.data.summary).toHaveProperty('high_risk_transformers');
    expect(res.body.data.breakdowns).toHaveProperty('by_risk_level');
    expect(res.body.data.risks.some((risk) => risk.asset_id === PRIMARY_ASSET_ID)).toBe(true);
  });

  test('supported filters do not crash analytics', async () => {
    const res = await analyticsGet(`/api/analytics/transformers?territory_id=${territoryId}&service_area_id=${serviceAreaId}&feeder_id=${feederId}&district_id=${districtId}&network_voltage_kv=11&kva_rating=100&startDate=2026-01-01&endDate=2026-12-31`);

    expectAnalyticsShape(res);
    expect(res.body.data.filters).toMatchObject({
      network_voltage_kv: 11,
      kva_rating: 100
    });
  });

  test('bad date range returns validation error', async () => {
    const res = await analyticsGet('/api/analytics/transformers?startDate=2026-12-31&endDate=2026-01-01');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });
});
