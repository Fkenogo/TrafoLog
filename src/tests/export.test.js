const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');

const TEST_EMAIL = 'admin.export@example.com';
const TEST_PASSWORD = 'Admin@1234';
const TRANSFORMER_ASSET_ID = 'TEST-EXPORT-T001';
const MISSING_GPS_ASSET_ID = 'TEST-EXPORT-MISSING-GPS';

let authToken;
let userId;
let transformerId;
let missingGpsTransformerId;

const postExport = (format, reportType, filters = {}) => request(app.getApp())
  .post(`/api/exports/${format}`)
  .set('Authorization', `Bearer ${authToken}`)
  .send({ report_type: reportType, filters });

const expectCsvExport = (res, expectedHeader) => {
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toContain('text/csv');
  expect(res.headers['content-disposition']).toContain('attachment');
  expect(res.text).toContain(expectedHeader);
  expect(res.text).not.toContain('GPS Coordinates');
  expect(res.text).not.toContain('0.3476');
  expect(res.text).not.toContain('32.5825');
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
      name: 'Export Admin',
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
    manufacturer: 'Export Maker',
    serial_number: 'EXPORT-SN-001',
    network_voltage_kv: 11,
    kva_rating: 100,
    display_rating: '100kVA 11kV',
    operational_status: 'Active',
    location_operational: {
      territory_name: 'Export Territory',
      service_area_name: 'Export Service Area',
      feeder_name: 'Export Feeder'
    },
    location_administrative: {
      district_name: 'Export District',
      site_name: 'Export Site'
    },
    gps: { type: 'Point', coordinates: [32.5825, 0.3476] },
    created_by: userId
  });
  transformerId = transformer._id;

  const missingGpsTransformer = await Transformer.create({
    asset_id: MISSING_GPS_ASSET_ID,
    manufacturer: 'Export Missing GPS Maker',
    serial_number: 'EXPORT-SN-MISSING-GPS',
    network_voltage_kv: 11,
    kva_rating: 100,
    display_rating: '100kVA 11kV',
    operational_status: 'Active',
    location_operational: {
      territory_name: 'Export Territory',
      service_area_name: 'Export Service Area',
      feeder_name: 'Export Feeder'
    },
    location_administrative: {
      district_name: 'Export District',
      site_name: 'Missing GPS Export Site'
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
    recommended_action: 'Monitor'
  });

  await Fault.create({
    transformer_id: transformerId,
    reported_by: userId,
    fault_date: new Date('2026-07-02T09:00:00.000Z'),
    fault_description: 'Export test overload fault',
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

describe('Exports API', () => {
  test('requires authentication', async () => {
    const res = await request(app.getApp())
      .post('/api/exports/csv')
      .send({ report_type: 'transformers' });

    expect(res.statusCode).toBe(401);
  });

  test('CSV transformer export returns 200', async () => {
    const res = await postExport('csv', 'transformers', { operational_status: 'Active' });
    expectCsvExport(res, 'Asset ID');
    expect(res.text).toContain(TRANSFORMER_ASSET_ID);
  });

  test('JSON transformer export returns 200', async () => {
    const res = await postExport('json', 'transformers', { operational_status: 'Active' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metadata.format).toBe('json');
    expect(res.body.data.metadata.report_type).toBe('transformers');
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(JSON.stringify(res.body.data.rows)).not.toContain('GPS Coordinates');
    expect(JSON.stringify(res.body.data.rows)).not.toContain('0.3476');
  });

  test('CSV inspection export returns 200', async () => {
    const res = await postExport('csv', 'inspections', { transformer_id: String(transformerId) });
    expectCsvExport(res, 'Inspection Date');
  });

  test('CSV fault export returns 200', async () => {
    const res = await postExport('csv', 'faults', { transformer_id: String(transformerId) });
    expectCsvExport(res, 'Fault Type');
  });

  test('CSV maintenance export returns 200', async () => {
    const res = await postExport('csv', 'maintenance', { transformer_id: String(transformerId) });
    expectCsvExport(res, 'Maintenance Date');
  });

  test('CSV asset-register export returns 200', async () => {
    const res = await postExport('csv', 'asset-register', { operational_status: 'Active' });
    expectCsvExport(res, 'Asset ID');
    expect(res.text).toContain(TRANSFORMER_ASSET_ID);
  });

  test('JSON asset-register export handles missing GPS coordinates', async () => {
    const res = await postExport('json', 'asset-register', { operational_status: 'Active' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metadata.format).toBe('json');
    expect(res.body.data.metadata.report_type).toBe('asset-register');
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(JSON.stringify(res.body.data.rows)).not.toContain('0.3600');
  });

  test('CSV asset-register export handles missing GPS coordinates', async () => {
    const res = await postExport('csv', 'asset-register', { operational_status: 'Active' });

    expectCsvExport(res, 'Asset ID');
    expect(res.text).toContain(MISSING_GPS_ASSET_ID);
  });

  test('unsupported format returns validation error', async () => {
    const res = await postExport('xml', 'transformers');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });

  test('bad date range returns validation error', async () => {
    const res = await postExport('csv', 'transformers', {
      startDate: '2026-12-31',
      endDate: '2026-01-01'
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
  });
});
