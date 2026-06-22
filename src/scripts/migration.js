/**
 * Database Migration Script
 * Handles data migrations between versions
 * Usage: npm run migrate
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const User = require('../models/User');
const { logger } = require('../utils/logger');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kVAssetTracker';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Migration registry
 * Each migration is a function that returns a promise
 */
const migrations = {
  /**
   * Migration v1.0.0 -> v1.1.0
   * Add display_rating field to transformers
   */
  '1.0.0_to_1.1.0': async () => {
    console.log('📦 Running migration: 1.0.0 -> 1.1.0 (Add display_rating)');
    
    const transformers = await Transformer.find({
      display_rating: { $exists: false }
    });
    
    let updated = 0;
    for (const transformer of transformers) {
      transformer.display_rating = `${transformer.kva_rating}kVA/${transformer.network_voltage_kv}kV`;
      await transformer.save();
      updated++;
    }
    
    console.log(`✅ Updated ${updated} transformers with display_rating`);
    return { updated };
  },

  /**
   * Migration v1.1.0 -> v1.2.0
   * Add sync_version and sync_status to all collections
   */
  '1.1.0_to_1.2.0': async () => {
    console.log('📦 Running migration: 1.1.0 -> 1.2.0 (Add sync fields)');
    
    const collections = [
      { model: Transformer, name: 'Transformers' },
      { model: Inspection, name: 'Inspections' },
      { model: Fault, name: 'Faults' },
      { model: Maintenance, name: 'Maintenance' }
    ];
    
    let totalUpdated = 0;
    
    for (const { model, name } of collections) {
      const records = await model.find({
        sync_version: { $exists: false }
      });
      
      let updated = 0;
      for (const record of records) {
        record.sync_version = 1;
        record.sync_status = 'synced';
        await record.save();
        updated++;
      }
      
      console.log(`✅ Updated ${updated} ${name} with sync fields`);
      totalUpdated += updated;
    }
    
    return { updated: totalUpdated };
  },

  /**
   * Migration v1.2.0 -> v1.3.0
   * Add GPS index to transformers
   */
  '1.2.0_to_1.3.0': async () => {
    console.log('📦 Running migration: 1.2.0 -> 1.3.0 (Add GPS index)');
    
    try {
      await Transformer.collection.createIndex({ 'gps': '2dsphere' });
      console.log('✅ GPS 2dsphere index created');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to create GPS index:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Migration v1.3.0 -> v2.0.0
   * Add email_verified field to users and set default
   */
  '1.3.0_to_2.0.0': async () => {
    console.log('📦 Running migration: 1.3.0 -> 2.0.0 (Add email_verified)');
    
    const users = await User.find({
      email_verified: { $exists: false }
    });
    
    let updated = 0;
    for (const user of users) {
      user.email_verified = true;
      await user.save();
      updated++;
    }
    
    console.log(`✅ Updated ${updated} users with email_verified`);
    return { updated };
  },

  /**
   * Migration v2.0.0 -> v2.1.0
   * Add next_maintenance_date to maintenance records
   */
  '2.0.0_to_2.1.0': async () => {
    console.log('📦 Running migration: 2.0.0 -> 2.1.0 (Add next_maintenance_date)');
    
    const maintenance = await Maintenance.find({
      next_maintenance_date: { $exists: false }
    });
    
    let updated = 0;
    for (const record of maintenance) {
      // Set default next maintenance to 6 months from maintenance date
      const nextDate = new Date(record.maintenance_date || record.created_at);
      nextDate.setMonth(nextDate.getMonth() + 6);
      record.next_maintenance_date = nextDate;
      await record.save();
      updated++;
    }
    
    console.log(`✅ Updated ${updated} maintenance records with next_maintenance_date`);
    return { updated };
  }
};

/**
 * Get current migration version
 */
async function getCurrentVersion() {
  try {
    // Check for version document in a separate collection
    const db = mongoose.connection.db;
    const collection = db.collection('migrations');
    const doc = await collection.findOne({ _id: 'version' });
    return doc ? doc.version : '1.0.0';
  } catch (error) {
    console.error('Error getting current version:', error);
    return '1.0.0';
  }
}

/**
 * Set migration version
 */
async function setVersion(version) {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('migrations');
    await collection.updateOne(
      { _id: 'version' },
      { $set: { version, updated_at: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error setting version:', error);
  }
}

/**
 * Get available migrations between two versions
 */
function getMigrationPath(fromVersion, toVersion) {
  const versionKeys = Object.keys(migrations).sort();
  const path = [];
  
  let current = fromVersion;
  for (const key of versionKeys) {
    const [from, to] = key.split('_to_');
    if (from === current) {
      path.push(key);
      current = to;
      if (current === toVersion) break;
    }
  }
  
  return path;
}

/**
 * Run a specific migration
 */
async function runMigration(migrationKey) {
  if (!migrations[migrationKey]) {
    throw new Error(`Migration ${migrationKey} not found`);
  }
  
  console.log(`🔄 Running migration: ${migrationKey}`);
  try {
    const result = await migrations[migrationKey]();
    console.log(`✅ Migration ${migrationKey} completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Migration ${migrationKey} failed:`, error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runPendingMigrations() {
  console.log('📦 Running pending migrations...');
  console.log('='.repeat(60));
  
  const currentVersion = await getCurrentVersion();
  console.log(`📌 Current version: ${currentVersion}`);
  
  const targetVersion = '2.1.0'; // Latest version
  console.log(`🎯 Target version: ${targetVersion}`);
  
  if (currentVersion === targetVersion) {
    console.log('✅ Database is already at the latest version');
    return;
  }
  
  const migrationPath = getMigrationPath(currentVersion, targetVersion);
  
  if (migrationPath.length === 0) {
    console.log('ℹ️ No migrations to run');
    return;
  }
  
  console.log(`📋 Migrations to run: ${migrationPath.join(' -> ')}`);
  console.log('='.repeat(60));
  
  let lastVersion = currentVersion;
  
  for (const migrationKey of migrationPath) {
    try {
      await runMigration(migrationKey);
      const [from, to] = migrationKey.split('_to_');
      lastVersion = to;
      await setVersion(to);
    } catch (error) {
      console.error(`❌ Migration failed at ${migrationKey}`);
      console.error(`⚠️ Database is at version ${lastVersion}`);
      process.exit(1);
    }
  }
  
  console.log('='.repeat(60));
  console.log(`✅ All migrations completed successfully`);
  console.log(`📌 Database version: ${lastVersion}`);
}

/**
 * List all available migrations
 */
async function listMigrations() {
  console.log('📋 Available migrations:');
  console.log('='.repeat(60));
  
  const versionKeys = Object.keys(migrations).sort();
  for (const key of versionKeys) {
    const [from, to] = key.split('_to_');
    console.log(`  ${from} -> ${to}: ${migrations[key].name || key}`);
  }
}

/**
 * Run a specific migration by name
 */
async function runSpecificMigration(migrationName) {
  if (!migrations[migrationName]) {
    console.error(`❌ Migration ${migrationName} not found`);
    console.log('Available migrations:');
    await listMigrations();
    process.exit(1);
  }
  
  await runMigration(migrationName);
  
  // Update version if successful
  const [from, to] = migrationName.split('_to_');
  await setVersion(to);
  console.log(`✅ Version updated to ${to}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';
  
  try {
    await connectDB();
    
    switch (command) {
      case 'migrate':
        await runPendingMigrations();
        break;
      
      case 'list':
        await listMigrations();
        break;
      
      case 'run':
        if (!args[1]) {
          console.error('❌ Please specify a migration name');
          console.log('Usage: npm run migrate run <migration-name>');
          process.exit(1);
        }
        await runSpecificMigration(args[1]);
        break;
      
      case 'status':
        const version = await getCurrentVersion();
        console.log(`📌 Current database version: ${version}`);
        break;
      
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Available commands:');
        console.log('  migrate  - Run all pending migrations');
        console.log('  list     - List all available migrations');
        console.log('  run      - Run a specific migration');
        console.log('  status   - Show current migration status');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run migrations
main();