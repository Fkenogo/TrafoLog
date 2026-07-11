#!/usr/bin/env node
/**
 * Railway-safe Phase 9F demo user seeder.
 *
 * Creates or updates only the 11 documented demo users.
 * This script never falls back to localhost and requires MONGODB_URI explicitly.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Territory = require('../src/models/Territory');
const ServiceArea = require('../src/models/ServiceArea');
const { RefreshToken, Session } = require('../src/models');

const DEMO_PASSWORD = 'Phase9F@1234';
const REQUIRED_ENV_VAR = 'MONGODB_URI';

const DEMO_USER_SPECS = [
  {
    label: 'Super Admin',
    name: 'Phase 9F Super Admin',
    email: 'super.admin@phase9f.io',
    role: 'Super Admin',
    is_active: true
  },
  {
    label: 'Operations Manager',
    name: 'Phase 9F Operations Manager',
    email: 'operations.manager@phase9f.io',
    role: 'Territory Manager',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FC' }
  },
  {
    label: 'Supervisor North',
    name: 'Phase 9F Supervisor North',
    email: 'supervisor.north@phase9f.io',
    role: 'Engineer',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FC', serviceAreaCode: 'P9FSA1' }
  },
  {
    label: 'Supervisor South',
    name: 'Phase 9F Supervisor South',
    email: 'supervisor.south@phase9f.io',
    role: 'Engineer',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FE', serviceAreaCode: 'P9FSA2' }
  },
  {
    label: 'Field Technician 1',
    name: 'Phase 9F Field Technician 1',
    email: 'technician1@phase9f.io',
    role: 'Field Technician',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FC', serviceAreaCode: 'P9FSA1' }
  },
  {
    label: 'Field Technician 2',
    name: 'Phase 9F Field Technician 2',
    email: 'technician2@phase9f.io',
    role: 'Field Technician',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FE', serviceAreaCode: 'P9FSA2' }
  },
  {
    label: 'Field Technician 3',
    name: 'Phase 9F Field Technician 3',
    email: 'technician3@phase9f.io',
    role: 'Field Technician',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FW', serviceAreaCode: 'P9FSA3' }
  },
  {
    label: 'Field Technician 4',
    name: 'Phase 9F Field Technician 4',
    email: 'technician4@phase9f.io',
    role: 'Field Technician',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FC', serviceAreaCode: 'P9FSA4' }
  },
  {
    label: 'Field Technician 5',
    name: 'Phase 9F Field Technician 5',
    email: 'technician5@phase9f.io',
    role: 'Field Technician',
    is_active: true,
    referenceKeys: { territoryCode: 'P9FE', serviceAreaCode: 'P9FSA5' }
  },
  {
    label: 'Viewer 1',
    name: 'Phase 9F Viewer One',
    email: 'viewer1@phase9f.io',
    role: 'Viewer',
    is_active: true
  },
  {
    label: 'Viewer 2',
    name: 'Phase 9F Viewer Two',
    email: 'viewer2@phase9f.io',
    role: 'Viewer',
    is_active: false
  }
];

function getMongoUri(env = process.env) {
  const mongoUri = env[REQUIRED_ENV_VAR];
  if (!mongoUri || !mongoUri.trim()) {
    throw new Error(`${REQUIRED_ENV_VAR} is required. Refusing to run without an explicit database target.`);
  }
  return mongoUri.trim();
}

function requiresTerritory(role) {
  return !['Super Admin', 'Viewer'].includes(role);
}

function requiresServiceArea(role) {
  return ['Engineer', 'Field Technician'].includes(role);
}

async function loadReferenceMaps() {
  const [territories, serviceAreas] = await Promise.all([
    Territory.find({ code: { $in: ['P9FC', 'P9FE', 'P9FW'] } }).select('_id code').lean(),
    ServiceArea.find({ code: { $in: ['P9FSA1', 'P9FSA2', 'P9FSA3', 'P9FSA4', 'P9FSA5'] } }).select('_id code territory_id').lean()
  ]);

  return {
    territoriesByCode: new Map(territories.map((item) => [item.code, item])),
    serviceAreasByCode: new Map(serviceAreas.map((item) => [item.code, item]))
  };
}

function resolveAssignments(spec, referenceMaps) {
  const assignment = {};
  const missing = [];
  const { referenceKeys = {} } = spec;

  if (requiresTerritory(spec.role)) {
    const territory = referenceMaps.territoriesByCode.get(referenceKeys.territoryCode);
    if (!territory) {
      missing.push(`territory ${referenceKeys.territoryCode || '(missing code)'}`);
    } else {
      assignment.territory_id = territory._id;
    }
  }

  if (requiresServiceArea(spec.role)) {
    const serviceArea = referenceMaps.serviceAreasByCode.get(referenceKeys.serviceAreaCode);
    if (!serviceArea) {
      missing.push(`service area ${referenceKeys.serviceAreaCode || '(missing code)'}`);
    } else {
      assignment.service_area_id = serviceArea._id;
    }
  }

  return { assignment, missing };
}

function normalizeObjectId(value) {
  if (!value) return undefined;
  return String(value);
}

function applyUserState(user, spec, assignment) {
  let changed = false;

  const setField = (field, value) => {
    const nextValue = value === undefined ? undefined : value;
    const currentValue = user[field];
    if (normalizeObjectId(currentValue) !== normalizeObjectId(nextValue) && currentValue !== nextValue) {
      user[field] = nextValue;
      changed = true;
    }
  };

  setField('name', spec.name);
  setField('email', spec.email.toLowerCase());
  setField('role', spec.role);
  setField('is_active', spec.is_active);
  setField('email_verified', true);
  setField('territory_id', assignment.territory_id);
  setField('service_area_id', assignment.service_area_id);

  if (user.login_attempts !== 0) {
    user.login_attempts = 0;
    changed = true;
  }

  if (user.lock_until !== undefined && user.lock_until !== null) {
    user.lock_until = undefined;
    changed = true;
  }

  if (user.reset_password_token !== undefined) {
    user.reset_password_token = undefined;
    changed = true;
  }

  if (user.reset_password_expires !== undefined) {
    user.reset_password_expires = undefined;
    changed = true;
  }

  if (Array.isArray(user.refresh_tokens) && user.refresh_tokens.length > 0) {
    user.refresh_tokens = [];
    changed = true;
  }

  user.password = DEMO_PASSWORD;
  changed = true;

  return changed;
}

async function clearExternalSessions(userId) {
  await Promise.all([
    RefreshToken.deleteMany({ user_id: userId }),
    Session.deleteMany({ user_id: userId })
  ]);
}

async function upsertDemoUser(spec, referenceMaps) {
  const { assignment, missing } = resolveAssignments(spec, referenceMaps);
  if (missing.length > 0) {
    return {
      email: spec.email,
      status: 'FAILED',
      message: `Missing prerequisite: ${missing.join(', ')}`
    };
  }

  const existing = await User.findOne({ email: spec.email }).select('+password');
  const user = existing || new User();
  const wasNew = !existing;

  applyUserState(user, spec, assignment);

  try {
    await user.save();
    await clearExternalSessions(user._id);

    return {
      email: spec.email,
      status: wasNew ? 'CREATED' : 'UPDATED',
      role: user.role,
      active: user.is_active
    };
  } catch (error) {
    return {
      email: spec.email,
      status: 'FAILED',
      message: error.message
    };
  }
}

function summarize(results) {
  return results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, { CREATED: 0, UPDATED: 0, SKIPPED: 0, FAILED: 0 });
}

function printResults(results) {
  const summary = summarize(results);
  console.log('=================================');
  console.log('Railway Demo User Seed');
  console.log('=================================');
  for (const result of results) {
    const suffix = result.message
      ? result.message
      : `${result.role} | ${result.active ? 'active' : 'inactive'}`;
    console.log(`${result.status.padEnd(7)} ${result.email} ${suffix}`);
  }
  console.log('=================================');
  console.log(`Summary: CREATED=${summary.CREATED} UPDATED=${summary.UPDATED} SKIPPED=${summary.SKIPPED} FAILED=${summary.FAILED}`);
  console.log('=================================');
  return summary;
}

async function seedRailwayDemoUsers() {
  const mongoUri = getMongoUri();
  await mongoose.connect(mongoUri);

  const referenceMaps = await loadReferenceMaps();
  const results = [];

  for (const spec of DEMO_USER_SPECS) {
    results.push(await upsertDemoUser(spec, referenceMaps));
  }

  const summary = printResults(results);
  if (summary.FAILED > 0) {
    process.exitCode = 1;
  }

  return { results, summary };
}

async function main() {
  try {
    await seedRailwayDemoUsers();
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DEMO_USER_SPECS,
  DEMO_PASSWORD,
  getMongoUri,
  requiresTerritory,
  requiresServiceArea,
  resolveAssignments,
  applyUserState,
  summarize,
  seedRailwayDemoUsers
};
