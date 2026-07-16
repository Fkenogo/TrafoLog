const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const District = require('../models/District');
const Feeder = require('../models/Feeder');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const Territory = require('../models/Territory');
const ServiceArea = require('../models/ServiceArea');
const User = require('../models/User');
const Session = require('../models/Session');
const RefreshToken = require('../models/RefreshToken');
const { TERRITORY_SPECS, SERVICE_AREA_SPECS } = require('../../scripts/seedRailwayPhase9FReferences');
const { DEMO_USER_SPECS } = require('../../scripts/seedRailwayDemoUsers');

jest.setTimeout(30000);

const seedPath = path.join(__dirname, '../../scripts/seedRailwayPhase9FOperationalData.js');
const districtCodes = Array.from({ length: 5 }, (_, index) => `P9FR-D${String(index + 1).padStart(2, '0')}`);
const feederCodes = Array.from({ length: 7 }, (_, index) => `P9FR-F${String(index + 1).padStart(2, '0')}`);
const transformerIds = Array.from({ length: 15 }, (_, index) => `P9FR-TX-${String(index + 1).padStart(3, '0')}`);
const workOrders = Array.from({ length: 8 }, (_, index) => `P9FR-WO-${String(index + 1).padStart(3, '0')}`);
const inspectionMarker = /^Phase 9F Railway Demo \[P9FR-INS-/;
const faultMarker = /^Phase 9F Railway Demo \[P9FR-FLT-/;
const anchor = new Date('2026-07-15T18:45:00.000Z');
const TEST_DATABASE_NAME = 'kvassettracker_phase9f_operational_seed_test';
const TEST_PASSWORD_VALUE = crypto.randomBytes(32).toString('hex');

async function clearOperationalFixtures() {
  await Maintenance.deleteMany({ work_order_number: { $in: workOrders } });
  await Fault.deleteMany({ fault_description: faultMarker });
  await Inspection.deleteMany({ condition_narrative: inspectionMarker });
  await Transformer.deleteMany({ asset_id: { $in: transformerIds } });
  await Feeder.deleteMany({ code: { $in: feederCodes } });
  await District.deleteMany({ code: { $in: districtCodes } });
  await District.deleteMany({ code: 'UNRELATED-DISTRICT-CODE' });
}

async function createDependencies() {
  await User.collection.deleteMany({ email: { $in: DEMO_USER_SPECS.map((spec) => spec.email) } });
  await ServiceArea.deleteMany({ code: { $in: SERVICE_AREA_SPECS.map((spec) => spec.code) } });
  await Territory.deleteMany({ code: { $in: TERRITORY_SPECS.map((spec) => spec.code) } });

  const territories = new Map();
  for (const spec of TERRITORY_SPECS) {
    const territory = await Territory.create(spec);
    territories.set(spec.code, territory);
  }

  const serviceAreas = new Map();
  for (const spec of SERVICE_AREA_SPECS) {
    const { territoryCode, ...fields } = spec;
    const serviceArea = await ServiceArea.create({
      ...fields,
      territory_id: territories.get(territoryCode)._id
    });
    serviceAreas.set(spec.code, serviceArea);
  }

  const now = new Date();
  const userDocuments = DEMO_USER_SPECS.map((spec) => {
    const referenceKeys = spec.referenceKeys || {};
    const document = {
      _id: new mongoose.Types.ObjectId(),
      name: spec.name,
      email: spec.email,
      password: TEST_PASSWORD_VALUE,
      role: spec.role,
      is_active: spec.is_active,
      email_verified: true,
      login_attempts: 0,
      refresh_tokens: [],
      push_tokens: [],
      preferences: {
        theme: 'system',
        notifications: { email: true, push: true, sms: false },
        dashboard_widgets: []
      },
      created_at: now,
      updated_at: now
    };
    if (referenceKeys.territoryCode) {
      document.territory_id = territories.get(referenceKeys.territoryCode)._id;
    }
    if (referenceKeys.serviceAreaCode) {
      document.service_area_id = serviceAreas.get(referenceKeys.serviceAreaCode)._id;
    }
    return document;
  });
  await User.collection.insertMany(userDocuments, { ordered: true });
}

async function operationalCounts() {
  const [districts, feeders, transformers, inspections, faults, maintenances] = await Promise.all([
    District.countDocuments({ code: { $in: districtCodes } }),
    Feeder.countDocuments({ code: { $in: feederCodes } }),
    Transformer.countDocuments({ asset_id: { $in: transformerIds } }),
    Inspection.countDocuments({ condition_narrative: inspectionMarker }),
    Fault.countDocuments({ fault_description: faultMarker }),
    Maintenance.countDocuments({ work_order_number: { $in: workOrders } })
  ]);
  return { districts, feeders, transformers, inspections, faults, maintenances };
}

async function operationalIndexes() {
  const names = ['districts', 'feeders', 'transformers', 'inspections', 'faults', 'maintenances'];
  const result = {};
  for (const name of names) {
    result[name] = (await mongoose.connection.db.collection(name).indexes())
      .map(({ name: indexName, key, unique, sparse }) => ({ indexName, key, unique, sparse }));
  }
  return result;
}

async function canonicalRawSnapshot() {
  const collections = [
    [District.collection, { code: { $in: districtCodes } }],
    [Feeder.collection, { code: { $in: feederCodes } }],
    [Transformer.collection, { asset_id: { $in: transformerIds } }],
    [Inspection.collection, { condition_narrative: inspectionMarker }],
    [Fault.collection, { fault_description: faultMarker }],
    [Maintenance.collection, { work_order_number: { $in: workOrders } }]
  ];
  const snapshot = [];
  for (const [collection, filter] of collections) {
    const documents = await collection.find(filter).sort({ _id: 1 }).toArray();
    snapshot.push([collection.collectionName, documents]);
  }
  return snapshot;
}

describe('seedRailwayPhase9FOperationalData pure contract', () => {
  test('exports the approved operational seed module', () => {
    expect(() => require('../../scripts/seedRailwayPhase9FOperationalData')).not.toThrow();
  });

  test('requires an explicit nonblank MONGODB_URI without a localhost fallback', () => {
    const { getMongoUri } = require('../../scripts/seedRailwayPhase9FOperationalData');

    expect(() => getMongoUri({})).toThrow(/MONGODB_URI is required/i);
    expect(() => getMongoUri({ MONGODB_URI: '   ' })).toThrow(/explicit database target/i);
    expect(getMongoUri({ MONGODB_URI: ' mongodb://example.invalid/demo ' }))
      .toBe('mongodb://example.invalid/demo');
    expect(fs.readFileSync(seedPath, 'utf8')).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  test('anchors relative dates to the UTC day deterministically', () => {
    const { utcDay, addUtcDays } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const anchor = utcDay(new Date('2026-07-15T23:59:59.999-05:00'));

    expect(anchor.toISOString()).toBe('2026-07-16T00:00:00.000Z');
    expect(addUtcDays(anchor, -91).toISOString()).toBe('2026-04-16T00:00:00.000Z');
    expect(anchor.toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });

  test('escapes exact narrative markers and preserves manually appended suffixes', () => {
    const { escapeRegex, mergeNarrativeForReconcile } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const oldSegment = 'Phase 9F Railway Demo [P9FR-INS-001] Old canonical text.';
    const nextSegment = 'Phase 9F Railway Demo [P9FR-INS-001] Updated canonical text.';
    const current = `${oldSegment}\nManual note: preserve exactly.`;

    expect(escapeRegex('[P9FR-INS-001]')).toBe('\\[P9FR-INS-001\\]');
    expect(mergeNarrativeForReconcile(current, nextSegment))
      .toBe(`${nextSegment}\nManual note: preserve exactly.`);
  });

  test('encodes the approved dataset counts, transformer status mix, and API-safe ratings', () => {
    const {
      DISTRICT_SPECS,
      FEEDER_SPECS,
      TRANSFORMER_SPECS,
      INSPECTION_SPECS,
      FAULT_SPECS,
      MAINTENANCE_SPECS
    } = require('../../scripts/seedRailwayPhase9FOperationalData');

    expect(DISTRICT_SPECS).toHaveLength(5);
    expect(FEEDER_SPECS).toHaveLength(7);
    expect(TRANSFORMER_SPECS).toHaveLength(15);
    expect(INSPECTION_SPECS).toHaveLength(20);
    expect(FAULT_SPECS).toHaveLength(7);
    expect(MAINTENANCE_SPECS).toHaveLength(8);

    const statuses = TRANSFORMER_SPECS.reduce((counts, spec) => {
      counts[spec.operational_status] = (counts[spec.operational_status] || 0) + 1;
      return counts;
    }, {});
    expect(statuses).toEqual({
      Active: 8,
      Faulty: 3,
      'Under Maintenance': 2,
      Decommissioned: 1,
      Unverified: 1
    });
    expect(TRANSFORMER_SPECS.every((spec) =>
      [50, 100, 160, 200, 250, 315, 500, 630, 1000].includes(spec.kva_rating)
      && [11, 33].includes(spec.network_voltage_kv)
    )).toBe(true);
  });

  test('declares exact owned fields and contains no destructive or broad write methods', () => {
    const { OWNED_FIELDS } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const source = fs.readFileSync(seedPath, 'utf8');

    expect(Object.keys(OWNED_FIELDS)).toEqual([
      'District', 'Feeder', 'Transformer', 'Inspection', 'Fault', 'Maintenance'
    ]);
    expect(OWNED_FIELDS.Transformer).toContain('gps.coordinates');
    expect(OWNED_FIELDS.Maintenance).toContain('work_performed.oil_top_up.performed');
    expect(source).not.toMatch(/\b(deleteMany|deleteOne|dropDatabase|dropCollection|replaceOne|findOneAndDelete|findByIdAndDelete|updateMany|bulkWrite)\b/);
  });

  test('redacts configured database targets from printable failures', () => {
    const { safeErrorMessage } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const uri = 'mongodb://example.invalid/private';

    expect(safeErrorMessage(new Error(`failed ${uri}`), uri)).toBe('failed [REDACTED]');
  });

  test('uses read-only-safe connection initialization options in dry-run mode', () => {
    const { connectionOptions } = require('../../scripts/seedRailwayPhase9FOperationalData');

    expect(connectionOptions(true)).toEqual({ autoIndex: false, autoCreate: false });
    expect(connectionOptions(false)).toEqual({});
  });

  test('pre-validates candidate documents with active Mongoose constraints', async () => {
    const { validatePlannedEntries } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const entry = {
      modelName: 'Feeder',
      Model: Feeder,
      key: 'P9FR-F-INVALID',
      plannedId: new mongoose.Types.ObjectId(),
      document: null,
      desired: {
        service_area_id: new mongoose.Types.ObjectId(),
        name: 'Invalid voltage feeder',
        code: 'P9FR-F-INVALID',
        network_voltage_kv: 22,
        is_active: true
      },
      ownedFields: ['service_area_id', 'name', 'code', 'network_voltage_kv', 'is_active']
    };

    expect((await validatePlannedEntries([entry]))[0]).toEqual(expect.objectContaining({
      key: 'P9FR-F-INVALID', status: 'FAILED'
    }));
  });
});

describe('seedRailwayPhase9FOperationalData database reconciliation', () => {
  let originalMongoUri;

  beforeAll(async () => {
    originalMongoUri = process.env.MONGODB_URI;
    await mongoose.connect(originalMongoUri, {
      dbName: TEST_DATABASE_NAME,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000
    });
  });

  beforeEach(async () => {
    process.env.MONGODB_URI = originalMongoUri;
    await clearOperationalFixtures();
    await createDependencies();
  });

  afterAll(async () => {
    await clearOperationalFixtures();
    await User.deleteMany({ email: { $in: DEMO_USER_SPECS.map((spec) => spec.email) } });
    await ServiceArea.deleteMany({ code: { $in: SERVICE_AREA_SPECS.map((spec) => spec.code) } });
    await Territory.deleteMany({ code: { $in: TERRITORY_SPECS.map((spec) => spec.code) } });
    await mongoose.disconnect();
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  });

  test('dry-run plans the full dataset and performs no writes', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const collectionsBefore = (await mongoose.connection.db.listCollections().toArray())
      .map((item) => item.name).sort();
    const before = await operationalCounts();

    const result = await seedRailwayPhase9FOperationalData({
      dryRun: true, print: false, connect: false, anchorDate: anchor
    });

    expect(result.summary).toEqual({
      WOULD_CREATE: 62, WOULD_UPDATE: 0, WOULD_SKIP: 0, FAILED: 0
    });
    expect(result.exitCode).toBe(0);
    expect(await operationalCounts()).toEqual(before);
    expect((await mongoose.connection.db.listCollections().toArray()).map((item) => item.name).sort())
      .toEqual(collectionsBefore);
  });

  test('missing MONGODB_URI fails before any database mutation', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const before = await operationalCounts();
    await expect(seedRailwayPhase9FOperationalData({
      dryRun: true, print: false, connect: false, anchorDate: anchor, env: {}
    })).rejects.toThrow(/MONGODB_URI is required/i);
    expect(await operationalCounts()).toEqual(before);
  });

  test('dry-run does not change documents, timestamps, collections, or indexes when updates are planned', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    await Transformer.collection.updateOne(
      { asset_id: 'P9FR-TX-001' },
      { $set: { operational_status: 'Unverified' } }
    );
    const documentsBefore = await canonicalRawSnapshot();
    const indexesBefore = await operationalIndexes();
    const collectionsBefore = (await mongoose.connection.db.listCollections().toArray())
      .map((item) => item.name).sort();

    const result = await seedRailwayPhase9FOperationalData({
      dryRun: true, print: false, connect: false, anchorDate: anchor
    });
    expect(result.summary.WOULD_UPDATE).toBeGreaterThan(0);
    expect(await canonicalRawSnapshot()).toEqual(documentsBefore);
    expect(await operationalIndexes()).toEqual(indexesBefore);
    expect((await mongoose.connection.db.listCollections().toArray()).map((item) => item.name).sort())
      .toEqual(collectionsBefore);
  });

  test('first run creates the approved graph and same-day rerun is idempotent with stable identity', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const first = await seedRailwayPhase9FOperationalData({
      print: false, connect: false, anchorDate: anchor
    });
    expect(first.summary).toEqual({ CREATED: 62, UPDATED: 0, SKIPPED: 0, FAILED: 0 });
    expect(await operationalCounts()).toEqual({
      districts: 5, feeders: 7, transformers: 15, inspections: 20, faults: 7, maintenances: 8
    });

    const identitiesBefore = new Map((await Transformer.find({ asset_id: { $in: transformerIds } }).lean())
      .map((doc) => [doc.asset_id, { id: String(doc._id), updated: doc.updated_at.getTime() }]));
    const second = await seedRailwayPhase9FOperationalData({
      print: false, connect: false, anchorDate: anchor
    });
    expect(second.summary).toEqual({ CREATED: 0, UPDATED: 0, SKIPPED: 62, FAILED: 0 });
    for (const doc of await Transformer.find({ asset_id: { $in: transformerIds } }).lean()) {
      expect(String(doc._id)).toBe(identitiesBefore.get(doc.asset_id).id);
      expect(doc.updated_at.getTime()).toBe(identitiesBefore.get(doc.asset_id).updated);
    }
  });

  test('reuses existing territory and service-area identities without updating them', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const referencesBefore = [
      ...(await Territory.find({ code: { $in: TERRITORY_SPECS.map((spec) => spec.code) } }).lean()),
      ...(await ServiceArea.find({ code: { $in: SERVICE_AREA_SPECS.map((spec) => spec.code) } }).lean())
    ].map((doc) => ({ id: String(doc._id), updated: doc.updated_at.getTime() }));

    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    const referencesAfter = [
      ...(await Territory.find({ code: { $in: TERRITORY_SPECS.map((spec) => spec.code) } }).lean()),
      ...(await ServiceArea.find({ code: { $in: SERVICE_AREA_SPECS.map((spec) => spec.code) } }).lean())
    ].map((doc) => ({ id: String(doc._id), updated: doc.updated_at.getTime() }));
    expect(referencesAfter).toEqual(referencesBefore);
  });

  test('missing or incorrect user dependencies fail before the first write', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await User.deleteOne({ email: 'technician5@phase9f.io' });

    const missing = await seedRailwayPhase9FOperationalData({
      print: false, connect: false, anchorDate: anchor
    });
    expect(missing.summary.FAILED).toBeGreaterThan(0);
    expect(missing.exitCode).toBe(1);
    expect(await operationalCounts()).toEqual({
      districts: 0, feeders: 0, transformers: 0, inspections: 0, faults: 0, maintenances: 0
    });

    await createDependencies();
    await User.collection.updateOne(
      { email: 'viewer2@phase9f.io' },
      { $set: { is_active: true } }
    );
    const incorrect = await seedRailwayPhase9FOperationalData({
      print: false, connect: false, anchorDate: anchor
    });
    expect(incorrect.summary.FAILED).toBeGreaterThan(0);
    expect(await operationalCounts()).toEqual({
      districts: 0, feeders: 0, transformers: 0, inspections: 0, faults: 0, maintenances: 0
    });
  });

  test('missing reference dependencies fail before the first write', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await ServiceArea.deleteOne({ code: 'P9FSA5' });

    const result = await seedRailwayPhase9FOperationalData({
      print: false, connect: false, anchorDate: anchor
    });
    expect(result.summary.FAILED).toBeGreaterThan(0);
    expect(await operationalCounts()).toEqual({
      districts: 0, feeders: 0, transformers: 0, inspections: 0, faults: 0, maintenances: 0
    });
  });

  test('a unique District name conflict is detected during preflight before writes', async () => {
    const { buildExecutionPlan, seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await District.create({
      code: 'UNRELATED-DISTRICT-CODE',
      name: 'Phase 9F Railway Kampala District',
      region: 'Central',
      is_active: true
    });

    const plan = await buildExecutionPlan({ anchorDate: anchor });
    expect(plan.failures.some((item) => /district name/i.test(item.message))).toBe(true);
    const result = await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    expect(result.exitCode).toBe(1);
    expect(await operationalCounts()).toEqual({
      districts: 0, feeders: 0, transformers: 0, inspections: 0, faults: 0, maintenances: 0
    });
    await District.deleteOne({ code: 'UNRELATED-DISTRICT-CODE' });
  });

  test('preserves user state plus non-owned top-level, nested, and narrative data', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const userBefore = await User.findOne({ email: 'viewer2@phase9f.io' }).select('+password').lean();
    const sessionsBefore = await Session.countDocuments({});
    const refreshTokensBefore = await RefreshToken.countDocuments({});
    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });

    const transformer = await Transformer.findOne({ asset_id: 'P9FR-TX-001' });
    await Transformer.collection.updateOne({ _id: transformer._id }, {
      $set: { preview_metadata: { owner: 'manual' }, 'gps.manual_note': 'keep nested' }
    });
    const maintenance = await Maintenance.findOne({ work_order_number: 'P9FR-WO-001' });
    await Maintenance.collection.updateOne({ _id: maintenance._id }, {
      $set: { 'work_performed.manual_note': 'keep maintenance nested' }
    });
    const inspection = await Inspection.findOne({ condition_narrative: /^Phase 9F Railway Demo \[P9FR-INS-001\]/ });
    inspection.condition_narrative += '\nManual inspection note: keep verbatim.';
    await inspection.save();
    const fault = await Fault.findOne({ fault_description: /^Phase 9F Railway Demo \[P9FR-FLT-001\]/ });
    fault.fault_description += '\nManual fault note: keep verbatim.';
    await fault.save();

    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    const rawTransformer = await Transformer.collection.findOne({ _id: transformer._id });
    expect(rawTransformer.preview_metadata).toEqual({ owner: 'manual' });
    expect(rawTransformer.gps.manual_note).toBe('keep nested');
    expect((await Maintenance.collection.findOne({ _id: maintenance._id })).work_performed.manual_note)
      .toBe('keep maintenance nested');
    expect((await Inspection.findById(inspection._id)).condition_narrative)
      .toContain('\nManual inspection note: keep verbatim.');
    expect((await Fault.findById(fault._id)).fault_description)
      .toContain('\nManual fault note: keep verbatim.');

    const userAfter = await User.findById(userBefore._id).select('+password').lean();
    for (const field of [
      'email', 'role', 'is_active', 'password', 'login_attempts', 'lock_until',
      'reset_password_token', 'reset_password_expires', 'refresh_tokens',
      'territory_id', 'service_area_id', 'updated_at'
    ]) {
      expect(userAfter[field]).toEqual(userBefore[field]);
    }
    expect(userAfter.is_active).toBe(false);
    expect(await Session.countDocuments({})).toBe(sessionsBefore);
    expect(await RefreshToken.countDocuments({})).toBe(refreshTokensBefore);
  });

  test('later UTC-day rerun changes only owned relative dates and preserves canonical IDs', async () => {
    const { seedRailwayPhase9FOperationalData, addUtcDays } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    const before = await Transformer.findOne({ asset_id: 'P9FR-TX-001' }).lean();

    const later = await seedRailwayPhase9FOperationalData({
      print: false, connect: false, anchorDate: addUtcDays(anchor, 1)
    });
    const after = await Transformer.findOne({ asset_id: 'P9FR-TX-001' }).lean();
    expect(later.summary).toEqual({ CREATED: 0, UPDATED: 50, SKIPPED: 12, FAILED: 0 });
    expect(String(after._id)).toBe(String(before._id));
    expect(after.last_inspection_date.getTime() - before.last_inspection_date.getTime())
      .toBe(24 * 60 * 60 * 1000);
  });

  test('fails preflight on duplicate inspection markers and maintenance work orders', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    const inspection = await Inspection.findOne({ condition_narrative: /^Phase 9F Railway Demo \[P9FR-INS-001\]/ }).lean();
    delete inspection._id;
    delete inspection.created_at;
    delete inspection.updated_at;
    delete inspection.__v;
    await Inspection.create(inspection);

    let result = await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    expect(result.exitCode).toBe(1);
    expect(result.results.some((item) => item.key === 'P9FR-INS-001' && item.status === 'FAILED')).toBe(true);

    await Inspection.deleteOne({ condition_narrative: inspection.condition_narrative });
    const maintenance = await Maintenance.findOne({ work_order_number: 'P9FR-WO-001' }).lean();
    delete maintenance._id;
    delete maintenance.created_at;
    delete maintenance.updated_at;
    delete maintenance.__v;
    await Maintenance.create(maintenance);
    result = await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    expect(result.exitCode).toBe(1);
    expect(result.results.some((item) => item.key === 'P9FR-WO-001' && item.status === 'FAILED')).toBe(true);
  });

  test('returns non-zero after a partial model failure and recovers idempotently on rerun', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const originalSave = Feeder.prototype.save;
    const saveSpy = jest.spyOn(Feeder.prototype, 'save')
      .mockImplementationOnce(async function rejectFirstFeeder() {
        throw new Error('injected feeder failure');
      });

    const failed = await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    saveSpy.mockRestore();
    expect(failed.exitCode).toBe(1);
    expect(failed.summary.FAILED).toBeGreaterThan(0);
    expect(await District.countDocuments({ code: { $in: districtCodes } })).toBe(5);
    expect(await Feeder.countDocuments({ code: { $in: feederCodes } })).toBe(0);
    expect(Feeder.prototype.save).toBe(originalSave);

    const recovered = await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    expect(recovered.exitCode).toBe(0);
    expect(recovered.summary.FAILED).toBe(0);
    expect(await operationalCounts()).toEqual({
      districts: 5, feeders: 7, transformers: 15, inspections: 20, faults: 7, maintenances: 8
    });
  });

  test('creates valid parent and user relationships and satisfies dashboard date/status filters', async () => {
    const { seedRailwayPhase9FOperationalData, addUtcDays } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: anchor });
    const transformer = await Transformer.findOne({ asset_id: 'P9FR-TX-001' }).lean();
    const feeder = await Feeder.findById(transformer.location_operational.feeder_id).lean();
    const serviceArea = await ServiceArea.findById(transformer.location_operational.service_area_id).lean();
    expect(String(feeder.service_area_id)).toBe(String(serviceArea._id));
    expect(String(serviceArea.territory_id)).toBe(String(transformer.location_operational.territory_id));
    expect(await District.findById(transformer.location_administrative.district_id)).not.toBeNull();

    const inspection = await Inspection.findOne({ condition_narrative: inspectionMarker }).lean();
    expect(await Transformer.findById(inspection.transformer_id)).not.toBeNull();
    expect((await User.findById(inspection.inspector_id)).is_active).toBe(true);
    expect(await Fault.countDocuments({ fault_status: { $in: ['Open', 'Assigned', 'In Progress'] } }))
      .toBeGreaterThan(0);
    expect(await Transformer.countDocuments({
      asset_id: { $in: transformerIds }, last_inspection_date: { $lt: addUtcDays(anchor, -90) }
    })).toBeGreaterThan(0);
    expect(await Maintenance.countDocuments({
      work_order_number: { $in: workOrders },
      next_maintenance_date: { $gte: anchor, $lte: addUtcDays(anchor, 30) }
    })).toBeGreaterThan(0);
  });

  test('authenticated Super Admin APIs expose coherent dashboard, modules, map, and reports', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    await seedRailwayPhase9FOperationalData({ print: false, connect: false, anchorDate: new Date() });
    const superAdmin = await User.findOne({ email: 'super.admin@phase9f.io' });
    const token = superAdmin.generateAuthToken();
    const auth = { Authorization: `Bearer ${token}` };

    const stats = await request(app.getApp()).get('/api/transformers/stats').set(auth);
    expect(stats.status).toBe(200);
    expect(stats.body.data.total).toBeGreaterThanOrEqual(15);
    expect(stats.body.data.active).toBeGreaterThan(0);
    expect(stats.body.data.faulty).toBeGreaterThan(0);

    const transformers = await request(app.getApp()).get('/api/transformers?limit=100').set(auth);
    expect(transformers.status).toBe(200);
    expect(transformers.body.data.data.some((item) => transformerIds.includes(item.asset_id))).toBe(true);

    const map = await request(app.getApp()).get('/api/transformers/search?limit=100').set(auth);
    expect(map.status).toBe(200);
    const mapRows = map.body.data.data || map.body.data.transformers || [];
    expect(mapRows.some((item) => transformerIds.includes(item.asset_id)
      && item.gps?.coordinates?.length === 2)).toBe(true);

    const openFaults = await request(app.getApp()).get('/api/faults/open').set(auth);
    expect(openFaults.status).toBe(200);
    expect(openFaults.body.data.some((item) => faultMarker.test(item.fault_description))).toBe(true);

    const faults = await request(app.getApp()).get('/api/faults?limit=100').set(auth);
    expect(faults.status).toBe(200);
    const canonicalFault = faults.body.data.data.find((item) => faultMarker.test(item.fault_description));
    expect(canonicalFault).toBeDefined();
    expect(canonicalFault.transformer_id).toMatchObject({
      asset_id: expect.stringMatching(/^P9FR-TX-/),
      location_operational: {
        territory_id: {
          name: expect.any(String),
          code: expect.any(String)
        }
      }
    });

    const overdue = await request(app.getApp()).get('/api/inspections/overdue?days=90').set(auth);
    expect(overdue.status).toBe(200);
    expect(overdue.body.data.some((item) => transformerIds.includes(item.asset_id))).toBe(true);

    const inspections = await request(app.getApp()).get('/api/inspections?limit=100').set(auth);
    expect(inspections.status).toBe(200);
    const canonicalInspection = inspections.body.data.data.find((item) => inspectionMarker.test(item.condition_narrative));
    expect(canonicalInspection).toBeDefined();
    expect(canonicalInspection.transformer_id).toMatchObject({
      asset_id: expect.stringMatching(/^P9FR-TX-/),
      location_administrative: {
        site_name: expect.any(String)
      },
      location_operational: {
        territory_id: {
          name: expect.any(String),
          code: expect.any(String)
        }
      }
    });

    const upcoming = await request(app.getApp()).get('/api/maintenance/upcoming?days=30').set(auth);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.data.some((item) => workOrders.includes(item.work_order_number))).toBe(true);

    const maintenance = await request(app.getApp()).get('/api/maintenance?limit=100').set(auth);
    expect(maintenance.status).toBe(200);
    const canonicalMaintenance = maintenance.body.data.data.find((item) => workOrders.includes(item.work_order_number));
    expect(canonicalMaintenance).toBeDefined();
    expect(canonicalMaintenance.technician_id).toMatchObject({
      name: expect.any(String),
      email: expect.any(String)
    });

    for (const endpoint of [
      'transformers', 'inspections', 'faults', 'maintenance', 'asset-register'
    ]) {
      const report = await request(app.getApp()).get(`/api/reports/${endpoint}?format=json`).set(auth);
      expect(report.status).toBe(200);
      expect(report.body.data.data.length).toBeGreaterThan(0);
    }
  });

  test('printed results do not expose database targets, credentials, tokens, cookies, secrets, or hashes', async () => {
    const { seedRailwayPhase9FOperationalData } = require('../../scripts/seedRailwayPhase9FOperationalData');
    const printableUri = 'mongodb://example.invalid/preview';
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await seedRailwayPhase9FOperationalData({
        dryRun: true,
        print: true,
        connect: false,
        anchorDate: anchor,
        env: { MONGODB_URI: printableUri }
      });
      const output = log.mock.calls.flat().join('\n');
      const passwordHashes = (await User.find({ email: { $in: DEMO_USER_SPECS.map((spec) => spec.email) } })
        .select('+password').lean()).map((user) => user.password);
      expect(output).not.toContain(printableUri);
      expect(output).not.toMatch(/mongodb:\/\/|access[_ -]?token|refresh[_ -]?token|cookie|jwt[_ -]?secret/i);
      for (const hash of passwordHashes) expect(output).not.toContain(hash);
    } finally {
      log.mockRestore();
    }
  });
});
