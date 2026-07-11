const mongoose = require('mongoose');
const Territory = require('../models/Territory');
const ServiceArea = require('../models/ServiceArea');
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const database = require('../config/database');
const {
  TERRITORY_SPECS,
  SERVICE_AREA_SPECS,
  getMongoUri,
  safeErrorMessage,
  summarize,
  seedRailwayPhase9FReferences
} = require('../../scripts/seedRailwayPhase9FReferences');

jest.setTimeout(30000);

const territoryCodes = ['P9FC', 'P9FE', 'P9FW'];
const serviceAreaCodes = ['P9FSA1', 'P9FSA2', 'P9FSA3', 'P9FSA4', 'P9FSA5'];
const unrelatedTerritoryCode = 'RAILSAFE-UNRELATED';

async function clearPhase9FReferences() {
  await ServiceArea.deleteMany({ code: { $in: serviceAreaCodes } });
  await Territory.deleteMany({ code: { $in: territoryCodes } });
}

describe('seedRailwayPhase9FReferences', () => {
  let originalMongoUri;

  beforeAll(async () => {
    originalMongoUri = process.env.MONGODB_URI;
    await database.connect();
    await clearPhase9FReferences();
    await Territory.deleteMany({ code: unrelatedTerritoryCode });
  });

  afterAll(async () => {
    await clearPhase9FReferences();
    await Territory.deleteMany({ code: unrelatedTerritoryCode });
    await database.disconnect();
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  });

  beforeEach(async () => {
    process.env.MONGODB_URI = originalMongoUri;
    await clearPhase9FReferences();
  });

  test('requires an explicit MONGODB_URI without a localhost fallback', () => {
    expect(() => getMongoUri({})).toThrow(/MONGODB_URI is required/i);
    expect(() => getMongoUri({ MONGODB_URI: '   ' })).toThrow(/explicit database target/i);
    expect(() => getMongoUri({})).not.toThrow(/localhost/i);
  });

  test('redacts the database target from printable errors', () => {
    const mongoUri = 'mongodb://preview-user:preview-password@example.invalid:27017/preview';
    const message = safeErrorMessage(new Error(`Connection failed for ${mongoUri}`), mongoUri);

    expect(message).toBe('Connection failed for [REDACTED]');
    expect(message).not.toContain('preview-user');
    expect(message).not.toContain('preview-password');
  });

  test('contains exactly the approved canonical record definitions', () => {
    expect(TERRITORY_SPECS).toEqual([
      { name: 'Phase 9F Central', code: 'P9FC', description: 'Phase 9F validation central territory', region: 'Central', is_active: true },
      { name: 'Phase 9F Eastern', code: 'P9FE', description: 'Phase 9F validation eastern territory', region: 'Eastern', is_active: true },
      { name: 'Phase 9F Western', code: 'P9FW', description: 'Phase 9F validation western territory', region: 'Western', is_active: true }
    ]);
    expect(SERVICE_AREA_SPECS).toEqual([
      { territoryCode: 'P9FC', name: 'Phase 9F Service Area 1', code: 'P9FSA1', location_town: 'Kampala', is_active: true },
      { territoryCode: 'P9FE', name: 'Phase 9F Service Area 2', code: 'P9FSA2', location_town: 'Jinja', is_active: true },
      { territoryCode: 'P9FW', name: 'Phase 9F Service Area 3', code: 'P9FSA3', location_town: 'Mbarara', is_active: true },
      { territoryCode: 'P9FC', name: 'Phase 9F Service Area 4', code: 'P9FSA4', location_town: 'Mukono', is_active: true },
      { territoryCode: 'P9FE', name: 'Phase 9F Service Area 5', code: 'P9FSA5', location_town: 'Mbale', is_active: true }
    ]);
    expect(SERVICE_AREA_SPECS).toHaveLength(5);
    expect(SERVICE_AREA_SPECS.some((spec) => spec.code === 'P9FSA6')).toBe(false);
  });

  test('creates only the required territories and service areas with correct relationships', async () => {
    const sixthServiceAreaCountBefore = await ServiceArea.countDocuments({ code: 'P9FSA6' });
    const { results, summary } = await seedRailwayPhase9FReferences({ print: false });

    expect(summary).toEqual({ CREATED: 8, UPDATED: 0, SKIPPED: 0, FAILED: 0 });
    expect(results).toHaveLength(8);

    const territories = await Territory.find({ code: { $in: territoryCodes } }).lean();
    const serviceAreas = await ServiceArea.find({ code: { $in: serviceAreaCodes } }).lean();
    expect(territories).toHaveLength(3);
    expect(serviceAreas).toHaveLength(5);

    const territoriesByCode = new Map(territories.map((item) => [item.code, item]));
    for (const spec of SERVICE_AREA_SPECS) {
      const serviceArea = serviceAreas.find((item) => item.code === spec.code);
      expect(String(serviceArea.territory_id)).toBe(String(territoriesByCode.get(spec.territoryCode)._id));
      expect(serviceArea.name).toBe(spec.name);
      expect(serviceArea.location_town).toBe(spec.location_town);
      expect(serviceArea.is_active).toBe(true);
    }
    expect(await ServiceArea.countDocuments({ code: 'P9FSA6' })).toBe(sixthServiceAreaCountBefore);
  });

  test('reruns idempotently without duplicates', async () => {
    await seedRailwayPhase9FReferences({ print: false });
    const secondRun = await seedRailwayPhase9FReferences({ print: false });

    expect(secondRun.summary).toEqual({ CREATED: 0, UPDATED: 0, SKIPPED: 8, FAILED: 0 });
    expect(await Territory.countDocuments({ code: { $in: territoryCodes } })).toBe(3);
    expect(await ServiceArea.countDocuments({ code: { $in: serviceAreaCodes } })).toBe(5);
  });

  test('updates only canonical fields while preserving identity, created timestamp, and unrelated metadata', async () => {
    const territory = await Territory.create({
      name: 'Temporary Phase 9F Central',
      code: 'P9FC',
      description: 'temporary',
      region: 'Temporary',
      is_active: false
    });
    await Territory.collection.updateOne({ _id: territory._id }, { $set: { preview_metadata: { owner: 'keep' } } });
    const originalId = String(territory._id);
    const originalCreatedAt = territory.created_at.getTime();

    const { summary } = await seedRailwayPhase9FReferences({ print: false });
    const reloaded = await Territory.collection.findOne({ code: 'P9FC' });

    expect(summary.UPDATED).toBe(1);
    expect(String(reloaded._id)).toBe(originalId);
    expect(reloaded.created_at.getTime()).toBe(originalCreatedAt);
    expect(reloaded.preview_metadata).toEqual({ owner: 'keep' });
    expect(reloaded.name).toBe('Phase 9F Central');
    expect(reloaded.description).toBe('Phase 9F validation central territory');
    expect(reloaded.region).toBe('Central');
    expect(reloaded.is_active).toBe(true);
  });

  test('leaves unrelated records and user and asset collections untouched', async () => {
    const unrelated = await Territory.create({
      name: 'Railway Safe Unrelated Territory',
      code: unrelatedTerritoryCode,
      description: 'must remain unchanged',
      region: 'Unrelated',
      is_active: false
    });
    const usersBefore = await User.countDocuments();
    const transformersBefore = await Transformer.countDocuments();

    await seedRailwayPhase9FReferences({ print: false });

    const reloaded = await Territory.findById(unrelated._id).lean();
    expect(reloaded.description).toBe('must remain unchanged');
    expect(reloaded.region).toBe('Unrelated');
    expect(reloaded.is_active).toBe(false);
    expect(await User.countDocuments()).toBe(usersBefore);
    expect(await Transformer.countDocuments()).toBe(transformersBefore);
  });

  test('fails a service area without writing it when its mandatory territory is unavailable', async () => {
    const result = await seedRailwayPhase9FReferences({
      print: false,
      territorySpecs: [],
      serviceAreaSpecs: [SERVICE_AREA_SPECS[0]]
    });

    expect(result.summary).toEqual({ CREATED: 0, UPDATED: 0, SKIPPED: 0, FAILED: 1 });
    expect(result.results[0]).toEqual(expect.objectContaining({ code: 'P9FSA1', status: 'FAILED' }));
    expect(result.results[0].message).toMatch(/territory P9FC is unavailable/i);
    expect(await ServiceArea.countDocuments({ code: 'P9FSA1' })).toBe(0);
  });

  test('summarizes all deterministic result states', () => {
    expect(summarize([
      { status: 'CREATED' },
      { status: 'UPDATED' },
      { status: 'SKIPPED' },
      { status: 'FAILED' }
    ])).toEqual({ CREATED: 1, UPDATED: 1, SKIPPED: 1, FAILED: 1 });
  });
});
