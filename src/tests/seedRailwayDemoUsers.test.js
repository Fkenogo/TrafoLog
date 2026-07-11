const mongoose = require('mongoose');
const User = require('../models/User');
const Territory = require('../models/Territory');
const ServiceArea = require('../models/ServiceArea');
const { RefreshToken, Session } = require('../models');
const {
  DEMO_PASSWORD,
  DEMO_USER_SPECS,
  getMongoUri,
  seedRailwayDemoUsers,
  requiresTerritory,
  requiresServiceArea,
  resolveAssignments,
  applyUserState,
  summarize
} = require('../../scripts/seedRailwayDemoUsers');
const database = require('../config/database');
const redis = require('../config/redis');

jest.setTimeout(30000);

const unrelatedEmail = 'unrelated.demo@example.com';
const demoEmails = DEMO_USER_SPECS.map((spec) => spec.email);

function getSpec(email) {
  return DEMO_USER_SPECS.find((spec) => spec.email === email);
}

describe('seedRailwayDemoUsers', () => {
  let originalMongoUri;
  let territoryCentral;
  let territoryEast;
  let territoryWest;
  let serviceArea1;
  let serviceArea2;
  let serviceArea3;
  let serviceArea4;
  let serviceArea5;

  beforeAll(async () => {
    originalMongoUri = process.env.MONGODB_URI;
    await database.connect();
    await redis.connect();

    await User.deleteMany({ email: { $in: [...demoEmails, unrelatedEmail] } });
    await RefreshToken.deleteMany({});
    await Session.deleteMany({});

    territoryCentral = await Territory.findOneAndUpdate(
      { code: 'P9FC' },
      { name: 'Phase 9F Central', code: 'P9FC', region: 'Central', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
    territoryEast = await Territory.findOneAndUpdate(
      { code: 'P9FE' },
      { name: 'Phase 9F Eastern', code: 'P9FE', region: 'Eastern', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
    territoryWest = await Territory.findOneAndUpdate(
      { code: 'P9FW' },
      { name: 'Phase 9F Western', code: 'P9FW', region: 'Western', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );

    serviceArea1 = await ServiceArea.findOneAndUpdate(
      { code: 'P9FSA1' },
      { territory_id: territoryCentral._id, name: 'Phase 9F Service Area 1', code: 'P9FSA1', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
    serviceArea2 = await ServiceArea.findOneAndUpdate(
      { code: 'P9FSA2' },
      { territory_id: territoryEast._id, name: 'Phase 9F Service Area 2', code: 'P9FSA2', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
    serviceArea3 = await ServiceArea.findOneAndUpdate(
      { code: 'P9FSA3' },
      { territory_id: territoryWest._id, name: 'Phase 9F Service Area 3', code: 'P9FSA3', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
    serviceArea4 = await ServiceArea.findOneAndUpdate(
      { code: 'P9FSA4' },
      { territory_id: territoryCentral._id, name: 'Phase 9F Service Area 4', code: 'P9FSA4', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
    serviceArea5 = await ServiceArea.findOneAndUpdate(
      { code: 'P9FSA5' },
      { territory_id: territoryEast._id, name: 'Phase 9F Service Area 5', code: 'P9FSA5', is_active: true },
      { upsert: true, new: true, runValidators: true }
    );
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: [...demoEmails, unrelatedEmail] } });
    await RefreshToken.deleteMany({});
    await Session.deleteMany({});
    await database.disconnect();
    await redis.disconnect();
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
  });

  beforeEach(async () => {
    process.env.MONGODB_URI = originalMongoUri;
    await User.deleteMany({ email: { $in: demoEmails } });
    await RefreshToken.deleteMany({});
    await Session.deleteMany({});
  });

  test('requires explicit MONGODB_URI', () => {
    delete process.env.MONGODB_URI;
    expect(() => getMongoUri()).toThrow(/MONGODB_URI is required/i);
  });

  test('does not fall back to localhost', () => {
    delete process.env.MONGODB_URI;
    expect(() => getMongoUri()).not.toThrow(/localhost/i);
    expect(() => getMongoUri()).toThrow(/Refusing to run without an explicit database target/i);
  });

  test('role assignment helpers reflect schema requirements', () => {
    expect(requiresTerritory('Super Admin')).toBe(false);
    expect(requiresTerritory('Viewer')).toBe(false);
    expect(requiresTerritory('Territory Manager')).toBe(true);
    expect(requiresServiceArea('Territory Manager')).toBe(false);
    expect(requiresServiceArea('Engineer')).toBe(true);
    expect(requiresServiceArea('Field Technician')).toBe(true);
  });

  test('resolveAssignments reports missing prerequisites instead of inventing IDs', () => {
    const spec = getSpec('supervisor.north@phase9f.io');
    const result = resolveAssignments(spec, {
      territoriesByCode: new Map(),
      serviceAreasByCode: new Map()
    });

    expect(result.missing).toEqual(expect.arrayContaining(['territory P9FC', 'service area P9FSA1']));
  });

  test('applyUserState resets lockout and embedded tokens while preserving inactive viewer', async () => {
    const user = new User({
      name: 'Temp Viewer',
      email: 'viewer2@phase9f.io',
      password: 'OldPass@1234',
      role: 'Viewer',
      is_active: true,
      login_attempts: 5,
      lock_until: new Date(Date.now() + 60000),
      reset_password_token: 'token',
      reset_password_expires: new Date(Date.now() + 60000),
      refresh_tokens: [{ token: 'abc' }]
    });

    const changed = applyUserState(user, getSpec('viewer2@phase9f.io'), {});
    expect(changed).toBe(true);
    expect(user.is_active).toBe(false);
    expect(user.login_attempts).toBe(0);
    expect(user.lock_until).toBeUndefined();
    expect(user.reset_password_token).toBeUndefined();
    expect(user.reset_password_expires).toBeUndefined();
    expect(user.refresh_tokens).toEqual([]);
    expect(user.password).toBe(DEMO_PASSWORD);
  });

  test('creates demo users and hashes passwords', async () => {
    const { summary } = await seedRailwayDemoUsers();
    expect(summary.CREATED).toBeGreaterThan(0);
    expect(summary.FAILED).toBe(0);

    const superAdmin = await User.findOne({ email: 'super.admin@phase9f.io' }).select('+password');
    expect(superAdmin).not.toBeNull();
    expect(superAdmin.password).not.toBe(DEMO_PASSWORD);
    await expect(superAdmin.comparePassword(DEMO_PASSWORD)).resolves.toBe(true);

    const inactiveViewer = await User.findOne({ email: 'viewer2@phase9f.io' });
    expect(inactiveViewer.is_active).toBe(false);
  });

  test('updates existing demo users without creating duplicates and clears external sessions', async () => {
    const existing = await User.create({
      name: 'Old Name',
      email: 'technician1@phase9f.io',
      password: 'WrongPass@1234',
      role: 'Field Technician',
      territory_id: territoryWest._id,
      service_area_id: serviceArea3._id,
      is_active: false,
      login_attempts: 4,
      lock_until: new Date(Date.now() + 60000),
      reset_password_token: 'reset-me',
      reset_password_expires: new Date(Date.now() + 60000),
      refresh_tokens: [{ token: 'embedded-token' }]
    });

    await RefreshToken.create({
      user_id: existing._id,
      token: 'external-refresh-token',
      expires_at: new Date(Date.now() + 3600000)
    });
    await Session.create({
      user_id: existing._id,
      session_token: 'external-session-token',
      expires_at: new Date(Date.now() + 3600000)
    });

    const { summary } = await seedRailwayDemoUsers();
    expect(summary.FAILED).toBe(0);

    const users = await User.find({ email: 'technician1@phase9f.io' }).select('+password');
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Phase 9F Field Technician 1');
    expect(users[0].is_active).toBe(true);
    expect(users[0].login_attempts).toBe(0);
    expect(users[0].lock_until).toBeUndefined();
    expect(users[0].refresh_tokens).toEqual([]);
    await expect(users[0].comparePassword(DEMO_PASSWORD)).resolves.toBe(true);

    expect(await RefreshToken.countDocuments({ user_id: existing._id })).toBe(0);
    expect(await Session.countDocuments({ user_id: existing._id })).toBe(0);
  });

  test('unrelated users remain untouched', async () => {
    const unrelated = await User.create({
      name: 'Unrelated User',
      email: unrelatedEmail,
      password: 'Unrelated@1234',
      role: 'Viewer',
      is_active: true
    });

    await seedRailwayDemoUsers();

    const reloaded = await User.findById(unrelated._id).select('+password');
    expect(reloaded).not.toBeNull();
    expect(reloaded.email).toBe(unrelatedEmail);
    await expect(reloaded.comparePassword('Unrelated@1234')).resolves.toBe(true);
  });

  test('summarize returns stable totals', () => {
    const summary = summarize([
      { status: 'CREATED' },
      { status: 'UPDATED' },
      { status: 'FAILED' }
    ]);

    expect(summary).toEqual({ CREATED: 1, UPDATED: 1, SKIPPED: 0, FAILED: 1 });
  });
});
