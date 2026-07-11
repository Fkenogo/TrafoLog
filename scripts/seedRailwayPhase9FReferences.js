#!/usr/bin/env node
/**
 * Railway-safe Phase 9F reference-data seeder.
 *
 * Reconciles only the territories and service areas required by
 * scripts/seedRailwayDemoUsers.js. It requires an explicit MONGODB_URI,
 * never deletes records, and never falls back to a local database.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Territory = require('../src/models/Territory');
const ServiceArea = require('../src/models/ServiceArea');

const REQUIRED_ENV_VAR = 'MONGODB_URI';

const TERRITORY_SPECS = Object.freeze([
  Object.freeze({ name: 'Phase 9F Central', code: 'P9FC', description: 'Phase 9F validation central territory', region: 'Central', is_active: true }),
  Object.freeze({ name: 'Phase 9F Eastern', code: 'P9FE', description: 'Phase 9F validation eastern territory', region: 'Eastern', is_active: true }),
  Object.freeze({ name: 'Phase 9F Western', code: 'P9FW', description: 'Phase 9F validation western territory', region: 'Western', is_active: true })
]);

const SERVICE_AREA_SPECS = Object.freeze([
  Object.freeze({ territoryCode: 'P9FC', name: 'Phase 9F Service Area 1', code: 'P9FSA1', location_town: 'Kampala', is_active: true }),
  Object.freeze({ territoryCode: 'P9FE', name: 'Phase 9F Service Area 2', code: 'P9FSA2', location_town: 'Jinja', is_active: true }),
  Object.freeze({ territoryCode: 'P9FW', name: 'Phase 9F Service Area 3', code: 'P9FSA3', location_town: 'Mbarara', is_active: true }),
  Object.freeze({ territoryCode: 'P9FC', name: 'Phase 9F Service Area 4', code: 'P9FSA4', location_town: 'Mukono', is_active: true }),
  Object.freeze({ territoryCode: 'P9FE', name: 'Phase 9F Service Area 5', code: 'P9FSA5', location_town: 'Mbale', is_active: true })
]);

function getMongoUri(env = process.env) {
  const mongoUri = env[REQUIRED_ENV_VAR];
  if (!mongoUri || !mongoUri.trim()) {
    throw new Error(`${REQUIRED_ENV_VAR} is required. Refusing to run without an explicit database target.`);
  }
  return mongoUri.trim();
}

function safeErrorMessage(error, secret = process.env[REQUIRED_ENV_VAR]) {
  const message = error?.message || String(error);
  const normalizedSecret = typeof secret === 'string' ? secret.trim() : '';
  return normalizedSecret ? message.split(normalizedSecret).join('[REDACTED]') : message;
}

function comparable(value) {
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  return value;
}

async function reconcileRecord(Model, canonicalFields) {
  try {
    let document = await Model.findOne({ code: canonicalFields.code });
    if (!document) {
      document = new Model(canonicalFields);
      await document.save();
      return {
        result: { code: canonicalFields.code, status: 'CREATED' },
        document
      };
    }

    let changed = false;
    for (const [field, value] of Object.entries(canonicalFields)) {
      if (comparable(document[field]) !== comparable(value)) {
        document[field] = value;
        changed = true;
      }
    }

    if (!changed) {
      return {
        result: { code: canonicalFields.code, status: 'SKIPPED' },
        document
      };
    }

    await document.save();
    return {
      result: { code: canonicalFields.code, status: 'UPDATED' },
      document
    };
  } catch (error) {
    return {
      result: {
        code: canonicalFields.code,
        status: 'FAILED',
        message: safeErrorMessage(error)
      }
    };
  }
}

function summarize(results) {
  return results.reduce((summary, result) => {
    summary[result.status] += 1;
    return summary;
  }, { CREATED: 0, UPDATED: 0, SKIPPED: 0, FAILED: 0 });
}

function printResults(results) {
  const summary = summarize(results);
  console.log('=================================');
  console.log('Railway Phase 9F Reference Seed');
  console.log('=================================');
  for (const result of results) {
    const suffix = result.message ? ` ${result.message}` : '';
    console.log(`${result.status.padEnd(7)} ${result.code}${suffix}`);
  }
  console.log('=================================');
  console.log(`Summary: CREATED=${summary.CREATED} UPDATED=${summary.UPDATED} SKIPPED=${summary.SKIPPED} FAILED=${summary.FAILED}`);
  console.log('=================================');
  return summary;
}

async function seedRailwayPhase9FReferences(options = {}) {
  const {
    print = true,
    territorySpecs = TERRITORY_SPECS,
    serviceAreaSpecs = SERVICE_AREA_SPECS
  } = options;
  const mongoUri = getMongoUri();

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const results = [];
  const territoriesByCode = new Map();

  for (const spec of territorySpecs) {
    const outcome = await reconcileRecord(Territory, spec);
    results.push(outcome.result);
    if (outcome.document) {
      territoriesByCode.set(spec.code, outcome.document);
    }
  }

  for (const spec of serviceAreaSpecs) {
    const territory = territoriesByCode.get(spec.territoryCode);
    if (!territory) {
      results.push({
        code: spec.code,
        status: 'FAILED',
        message: `Required territory ${spec.territoryCode} is unavailable`
      });
      continue;
    }

    const { territoryCode, ...canonicalFields } = spec;
    const outcome = await reconcileRecord(ServiceArea, {
      ...canonicalFields,
      territory_id: territory._id
    });
    results.push(outcome.result);
  }

  const summary = print ? printResults(results) : summarize(results);
  return { results, summary };
}

async function main() {
  try {
    const { summary } = await seedRailwayPhase9FReferences();
    if (summary.FAILED > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  TERRITORY_SPECS,
  SERVICE_AREA_SPECS,
  getMongoUri,
  safeErrorMessage,
  reconcileRecord,
  summarize,
  printResults,
  seedRailwayPhase9FReferences
};
