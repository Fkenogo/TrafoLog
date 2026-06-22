/**
 * Database Index Creation Script
 * Creates all necessary indexes for performance optimization
 * Usage: npm run create-indexes
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Maintenance = require('../models/Maintenance');
const Fault = require('../models/Fault');
const Installation = require('../models/Installation');
const AssetTimeline = require('../models/AssetTimeline');
const AssetPhoto = require('../models/AssetPhoto');
const QRCode = require('../models/QRCode');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ImportLog = require('../models/ImportLog');
const RefreshToken = require('../models/RefreshToken');
const Session = require('../models/Session');
const Territory = require('../models/Territory');
const ServiceArea = require('../models/ServiceArea');
const Feeder = require('../models/Feeder');
const District = require('../models/District');
const TransformerRating = require('../models/TransformerRating');
const ExportJob = require('../models/ExportJob');
const SyncQueue = require('../models/SyncQueue');

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
 * Index definitions for each collection
 */
const indexDefinitions = {
  users: [
    { key: { email: 1 }, unique: true },
    { key: { role: 1 } },
    { key: { territory_id: 1 } },
    { key: { service_area_id: 1 } },
    { key: { is_active: 1 } },
    { key: { reset_password_token: 1 } },
    { key: { email_verification_token: 1 } }
  ],
  
  transformers: [
    { key: { asset_id: 1 }, unique: true },
    { key: { serial_number: 1 } },
    { key: { 'gps': '2dsphere' } },
    { key: { operational_status: 1, 'location_operational.territory_id': 1 } },
    { key: { network_voltage_kv: 1, kva_rating: 1 } },
    { key: { last_inspection_date: 1 } },
    { key: { has_open_fault: 1 } },
    { key: { created_at: -1 } },
    { key: { 'location_operational.territory_id': 1, 'location_administrative.district_id': 1 } }
  ],
  
  inspections: [
    { key: { transformer_id: 1, inspection_date: -1 } },
    { key: { inspector_id: 1 } },
    { key: { 'electrical.overload_flag': 1 } },
    { key: { inspection_date: -1 } },
    { key: { sync_status: 1 } },
    { key: { recommended_action: 1 } },
    { key: { 'physical.overall_condition': 1 } },
    { key: { transformer_id: 1, 'physical.overall_condition': 1 } },
    { key: { inspection_date: -1, recommended_action: 1 } }
  ],
  
  maintenance: [
    { key: { transformer_id: 1, maintenance_date: -1 } },
    { key: { technician_id: 1 } },
    { key: { next_maintenance_date: 1 } },
    { key: { maintenance_type: 1 } },
    { key: { sync_status: 1 } },
    { key: { maintenance_date: -1 } },
    { key: { transformer_id: 1, maintenance_type: 1 } },
    { key: { next_maintenance_date: 1, maintenance_type: 1 } }
  ],
  
  faults: [
    { key: { transformer_id: 1, fault_date: -1 } },
    { key: { fault_status: 1 } },
    { key: { severity: 1 } },
    { key: { assigned_to: 1 } },
    { key: { resolved_date: 1 } },
    { key: { sync_status: 1 } }
  ],
  
  installations: [
    { key: { transformer_id: 1, installation_date: -1 } },
    { key: { previous_transformer_id: 1 } },
    { key: { installation_type: 1 } },
    { key: { sync_status: 1 } },
    { key: { installation_date: -1 } },
    { key: { transformer_id: 1, installation_type: 1 } },
    { key: { previous_transformer_id: 1, installation_date: -1 } }
  ],
  
  asset_timelines: [
    { key: { transformer_id: 1, event_date: -1 } },
    { key: { event_type: 1 } },
    { key: { linked_record_id: 1 } },
    { key: { created_at: -1 } },
    { key: { 'metadata.severity': 1 } }
  ],
  
  asset_photos: [
    { key: { transformer_id: 1, photo_category: 1 } },
    { key: { linked_record_id: 1 } },
    { key: { uploaded_by: 1 } },
    { key: { sync_status: 1 } },
    { key: { uploaded_at: -1 } }
  ],
  
  qr_codes: [
    { key: { qr_code_string: 1 } },
    { key: { status: 1 } },
    { key: { expires_at: 1 } },
    { key: { generated_at: -1 } },
    { key: { scan_count: -1 } }
  ],
  
  notifications: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { user_id: 1, is_read: 1 } },
    { key: { priority: 1 } },
    { key: { type: 1 } },
    { key: { expires_at: 1 } },
    { key: { linked_record_id: 1 } },
    { key: { user_id: 1, priority: 1, is_read: 1 } },
    { key: { created_at: -1, is_read: 1 } }
  ],
  
  audit_logs: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { action: 1 } },
    { key: { action_category: 1 } },
    { key: { target_record_id: 1 } },
    { key: { created_at: -1 } },
    { key: { ip_address: 1 } },
    { key: { is_sensitive: 1 } },
    { key: { user_id: 1, action_category: 1 } },
    { key: { target_transformer_id: 1, created_at: -1 } }
  ],
  
  import_logs: [
    { key: { imported_by: 1, created_at: -1 } },
    { key: { status: 1 } }
  ],
  
  refresh_tokens: [
    { key: { user_id: 1 } },
    { key: { token: 1 }, unique: true },
    { key: { expires_at: 1 } }
  ],
  
  sessions: [
    { key: { user_id: 1 } },
    { key: { session_token: 1 }, unique: true },
    { key: { expires_at: 1 } }
  ],
  
  territories: [
    { key: { name: 1 } },
    { key: { code: 1 } }
  ],
  
  service_areas: [
    { key: { territory_id: 1, name: 1 } }
  ],
  
  feeders: [
    { key: { service_area_id: 1, code: 1 } }
  ],
  
  districts: [
    { key: { name: 1 } },
    { key: { region: 1 } }
  ],
  
  transformer_ratings: [
    { key: { kva: 1, network_voltage_kv: 1 }, unique: true }
  ],
  
  export_jobs: [
    { key: { user_id: 1, created_at: -1 } },
    { key: { status: 1 } },
    { key: { expires_at: 1 } }
  ],
  
  sync_queues: [
    { key: { user_id: 1, status: 1 } },
    { key: { created_at: 1 } },
    { key: { status: 1, attempts: 1 } }
  ]
};

/**
 * Collection name mapping
 */
const collectionMap = {
  users: User,
  transformers: Transformer,
  inspections: Inspection,
  maintenance: Maintenance,
  faults: Fault,
  installations: Installation,
  asset_timelines: AssetTimeline,
  asset_photos: AssetPhoto,
  qr_codes: QRCode,
  notifications: Notification,
  audit_logs: AuditLog,
  import_logs: ImportLog,
  refresh_tokens: RefreshToken,
  sessions: Session,
  territories: Territory,
  service_areas: ServiceArea,
  feeders: Feeder,
  districts: District,
  transformer_ratings: TransformerRating,
  export_jobs: ExportJob,
  sync_queues: SyncQueue
};

/**
 * Create indexes for a collection
 */
async function createIndexesForCollection(collectionName, model, indexes) {
  console.log(`📊 Creating indexes for ${collectionName}...`);
  
  try {
    const result = await model.collection.createIndexes(indexes);
    console.log(`✅ Created ${indexes.length} indexes for ${collectionName}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to create indexes for ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Drop all indexes (use with caution!)
 */
async function dropAllIndexes() {
  console.log('⚠️ Dropping all existing indexes...');
  
  for (const [collectionName, model] of Object.entries(collectionMap)) {
    try {
      await model.collection.dropIndexes();
      console.log(`✅ Dropped indexes for ${collectionName}`);
    } catch (error) {
      console.error(`❌ Failed to drop indexes for ${collectionName}:`, error.message);
    }
  }
}

/**
 * List existing indexes
 */
async function listIndexes() {
  console.log('📋 Current indexes:');
  console.log('='.repeat(60));
  
  for (const [collectionName, model] of Object.entries(collectionMap)) {
    try {
      const indexes = await model.collection.indexes();
      console.log(`\n📁 ${collectionName}:`);
      for (const index of indexes) {
        console.log(`  - ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
      }
    } catch (error) {
      console.error(`Failed to get indexes for ${collectionName}:`, error.message);
    }
  }
}

/**
 * Create all indexes
 */
async function createAllIndexes() {
  console.log('🔧 Creating database indexes...');
  console.log('='.repeat(60));
  
  let totalCreated = 0;
  
  for (const [collectionName, model] of Object.entries(collectionMap)) {
    const indexes = indexDefinitions[collectionName];
    if (!indexes || indexes.length === 0) {
      console.log(`ℹ️ No indexes defined for ${collectionName}`);
      continue;
    }
    
    try {
      const result = await createIndexesForCollection(collectionName, model, indexes);
      totalCreated += indexes.length;
    } catch (error) {
      console.error(`❌ Failed to create indexes for ${collectionName}:`, error.message);
    }
  }
  
  console.log('='.repeat(60));
  console.log(`✅ Created ${totalCreated} indexes across ${Object.keys(collectionMap).length} collections`);
}

/**
 * Validate indexes
 */
async function validateIndexes() {
  console.log('🔍 Validating indexes...');
  console.log('='.repeat(60));
  
  let missingIndexes = [];
  
  for (const [collectionName, model] of Object.entries(collectionMap)) {
    const expectedIndexes = indexDefinitions[collectionName];
    if (!expectedIndexes) continue;
    
    try {
      const existingIndexes = await model.collection.indexes();
      const existingIndexKeys = existingIndexes.map(idx => JSON.stringify(idx.key));
      
      for (const expected of expectedIndexes) {
        const keyString = JSON.stringify(expected.key);
        if (!existingIndexKeys.includes(keyString)) {
          missingIndexes.push({
            collection: collectionName,
            index: expected
          });
        }
      }
    } catch (error) {
      console.error(`Failed to validate indexes for ${collectionName}:`, error.message);
    }
  }
  
  if (missingIndexes.length === 0) {
    console.log('✅ All indexes are present');
  } else {
    console.log(`⚠️ Missing ${missingIndexes.length} indexes:`);
    for (const missing of missingIndexes) {
      console.log(`  - ${missing.collection}: ${JSON.stringify(missing.index.key)}`);
    }
  }
  
  return missingIndexes;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';
  
  try {
    await connectDB();
    
    switch (command) {
      case 'create':
        await createAllIndexes();
        break;
      
      case 'list':
        await listIndexes();
        break;
      
      case 'validate':
        await validateIndexes();
        break;
      
      case 'drop':
        console.log('⚠️ This will drop all indexes. Are you sure? (y/N)');
        const response = await new Promise(resolve => {
          process.stdin.once('data', data => {
            resolve(data.toString().trim().toLowerCase());
          });
        });
        
        if (response === 'y' || response === 'yes') {
          await dropAllIndexes();
          console.log('✅ All indexes dropped');
        } else {
          console.log('❌ Index drop cancelled');
        }
        break;
      
      case 'repair':
        // Drop and recreate all indexes
        console.log('🔧 Repairing indexes...');
        await dropAllIndexes();
        await createAllIndexes();
        break;
      
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Available commands:');
        console.log('  create   - Create all indexes');
        console.log('  list     - List existing indexes');
        console.log('  validate - Validate indexes');
        console.log('  drop     - Drop all indexes');
        console.log('  repair   - Drop and recreate all indexes');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Index creation failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run index creation
main();