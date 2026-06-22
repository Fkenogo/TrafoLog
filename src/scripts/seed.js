/**
 * Database Seeding Script
 * Populates the database with initial reference data
 * Usage: npm run seed
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Territory = require('../models/Territory');
const ServiceArea = require('../models/ServiceArea');
const Feeder = require('../models/Feeder');
const District = require('../models/District');
const TransformerRating = require('../models/TransformerRating');
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

async function seedTerritories() {
  const territories = [
    { name: 'Central', code: 'CEN', description: 'Central Region', region: 'Central' },
    { name: 'Northern', code: 'NOR', description: 'Northern Region', region: 'Northern' },
    { name: 'North North West', code: 'NNW', description: 'North North West Region', region: 'Northern' },
    { name: 'Eastern', code: 'EAS', description: 'Eastern Region', region: 'Eastern' },
    { name: 'Western', code: 'WES', description: 'Western Region', region: 'Western' }
  ];

  for (const territory of territories) {
    await Territory.findOneAndUpdate(
      { code: territory.code },
      territory,
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${territories.length} territories`);
  return await Territory.find();
}

async function seedServiceAreas(territories) {
  const territoryMap = {};
  territories.forEach(t => territoryMap[t.code] = t);

  const serviceAreas = [
    // Central Territory
    { territory_id: territoryMap['CEN']._id, name: 'Kampala East', code: 'KPE', location_town: 'Kampala' },
    { territory_id: territoryMap['CEN']._id, name: 'Kampala West', code: 'KPW', location_town: 'Kampala' },
    { territory_id: territoryMap['CEN']._id, name: 'Kampala North', code: 'KPN', location_town: 'Kampala' },
    { territory_id: territoryMap['CEN']._id, name: 'Kampala South', code: 'KPS', location_town: 'Kampala' },
    { territory_id: territoryMap['CEN']._id, name: 'Jinja', code: 'JIN', location_town: 'Jinja' },
    { territory_id: territoryMap['CEN']._id, name: 'Mukono', code: 'MUK', location_town: 'Mukono' },
    
    // Northern Territory
    { territory_id: territoryMap['NOR']._id, name: 'Gulu', code: 'GUL', location_town: 'Gulu' },
    { territory_id: territoryMap['NOR']._id, name: 'Lira', code: 'LIR', location_town: 'Lira' },
    { territory_id: territoryMap['NOR']._id, name: 'Kitgum', code: 'KIT', location_town: 'Kitgum' },
    
    // North North West Territory
    { territory_id: territoryMap['NNW']._id, name: 'Arua', code: 'ARU', location_town: 'Arua' },
    { territory_id: territoryMap['NNW']._id, name: 'Nebbi', code: 'NEB', location_town: 'Nebbi' },
    
    // Eastern Territory
    { territory_id: territoryMap['EAS']._id, name: 'Mbale', code: 'MBA', location_town: 'Mbale' },
    { territory_id: territoryMap['EAS']._id, name: 'Tororo', code: 'TOR', location_town: 'Tororo' },
    { territory_id: territoryMap['EAS']._id, name: 'Soroti', code: 'SOR', location_town: 'Soroti' },
    
    // Western Territory
    { territory_id: territoryMap['WES']._id, name: 'Mbarara', code: 'MBA', location_town: 'Mbarara' },
    { territory_id: territoryMap['WES']._id, name: 'Kasese', code: 'KAS', location_town: 'Kasese' },
    { territory_id: territoryMap['WES']._id, name: 'Fort Portal', code: 'FPT', location_town: 'Fort Portal' }
  ];

  for (const area of serviceAreas) {
    await ServiceArea.findOneAndUpdate(
      { code: area.code },
      area,
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${serviceAreas.length} service areas`);
  return await ServiceArea.find();
}

async function seedFeeders(serviceAreas) {
  const areaMap = {};
  serviceAreas.forEach(s => areaMap[s.code] = s);

  const feeders = [
    // Kampala East
    { service_area_id: areaMap['KPE']._id, name: 'F01 - Nakawa', code: 'F01', network_voltage_kv: 11 },
    { service_area_id: areaMap['KPE']._id, name: 'F02 - Bugolobi', code: 'F02', network_voltage_kv: 11 },
    { service_area_id: areaMap['KPE']._id, name: 'F03 - Industrial Area', code: 'F03', network_voltage_kv: 33 },
    { service_area_id: areaMap['KPE']._id, name: 'F04 - Ntinda', code: 'F04', network_voltage_kv: 11 },
    
    // Kampala West
    { service_area_id: areaMap['KPW']._id, name: 'F05 - Old Kampala', code: 'F05', network_voltage_kv: 11 },
    { service_area_id: areaMap['KPW']._id, name: 'F06 - Rubaga', code: 'F06', network_voltage_kv: 11 },
    { service_area_id: areaMap['KPW']._id, name: 'F07 - Mengo', code: 'F07', network_voltage_kv: 33 },
    
    // Kampala North
    { service_area_id: areaMap['KPN']._id, name: 'F08 - Wandegeya', code: 'F08', network_voltage_kv: 11 },
    { service_area_id: areaMap['KPN']._id, name: 'F09 - Makerere', code: 'F09', network_voltage_kv: 11 },
    
    // Kampala South
    { service_area_id: areaMap['KPS']._id, name: 'F10 - Nsambya', code: 'F10', network_voltage_kv: 11 },
    { service_area_id: areaMap['KPS']._id, name: 'F11 - Munyonyo', code: 'F11', network_voltage_kv: 33 },
    
    // Jinja
    { service_area_id: areaMap['JIN']._id, name: 'F12 - Jinja Town', code: 'F12', network_voltage_kv: 11 },
    { service_area_id: areaMap['JIN']._id, name: 'F13 - Njeru', code: 'F13', network_voltage_kv: 33 },
    
    // Mukono
    { service_area_id: areaMap['MUK']._id, name: 'F14 - Mukono Town', code: 'F14', network_voltage_kv: 11 },
    
    // Gulu
    { service_area_id: areaMap['GUL']._id, name: 'F15 - Gulu Town', code: 'F15', network_voltage_kv: 11 },
    { service_area_id: areaMap['GUL']._id, name: 'F16 - Gulu Industrial', code: 'F16', network_voltage_kv: 33 },
    
    // Lira
    { service_area_id: areaMap['LIR']._id, name: 'F17 - Lira Town', code: 'F17', network_voltage_kv: 11 },
    
    // Arua
    { service_area_id: areaMap['ARU']._id, name: 'F18 - Arua Town', code: 'F18', network_voltage_kv: 11 },
    { service_area_id: areaMap['ARU']._id, name: 'F19 - Arua Industrial', code: 'F19', network_voltage_kv: 33 },
    
    // Mbale
    { service_area_id: areaMap['MBA']._id, name: 'F20 - Mbale Town', code: 'F20', network_voltage_kv: 11 },
    { service_area_id: areaMap['MBA']._id, name: 'F21 - Mbale Industrial', code: 'F21', network_voltage_kv: 33 },
    
    // Mbarara
    { service_area_id: areaMap['MBA']._id, name: 'F22 - Mbarara Town', code: 'F22', network_voltage_kv: 11 },
    { service_area_id: areaMap['MBA']._id, name: 'F23 - Mbarara Industrial', code: 'F23', network_voltage_kv: 33 }
  ];

  for (const feeder of feeders) {
    await Feeder.findOneAndUpdate(
      { code: feeder.code },
      feeder,
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${feeders.length} feeders`);
}

async function seedDistricts() {
  const districts = [
    // Central Region
    { name: 'Kampala', code: 'KLA', region: 'Central' },
    { name: 'Jinja', code: 'JIN', region: 'Central' },
    { name: 'Mukono', code: 'MUK', region: 'Central' },
    { name: 'Wakiso', code: 'WAK', region: 'Central' },
    { name: 'Kayunga', code: 'KAY', region: 'Central' },
    { name: 'Luwero', code: 'LUW', region: 'Central' },
    { name: 'Mpigi', code: 'MPI', region: 'Central' },
    { name: 'Masaka', code: 'MAS', region: 'Central' },
    
    // Eastern Region
    { name: 'Mbale', code: 'MBA', region: 'Eastern' },
    { name: 'Tororo', code: 'TOR', region: 'Eastern' },
    { name: 'Soroti', code: 'SOR', region: 'Eastern' },
    { name: 'Moroto', code: 'MOR', region: 'Eastern' },
    { name: 'Kotido', code: 'KOT', region: 'Eastern' },
    { name: 'Kapchorwa', code: 'KAP', region: 'Eastern' },
    { name: 'Kumi', code: 'KUM', region: 'Eastern' },
    { name: 'Busia', code: 'BUS', region: 'Eastern' },
    
    // Northern Region
    { name: 'Gulu', code: 'GUL', region: 'Northern' },
    { name: 'Lira', code: 'LIR', region: 'Northern' },
    { name: 'Kitgum', code: 'KIT', region: 'Northern' },
    { name: 'Pader', code: 'PAD', region: 'Northern' },
    { name: 'Apac', code: 'APA', region: 'Northern' },
    { name: 'Arua', code: 'ARU', region: 'Northern' },
    { name: 'Nebbi', code: 'NEB', region: 'Northern' },
    { name: 'Moyo', code: 'MOY', region: 'Northern' },
    
    // Western Region
    { name: 'Mbarara', code: 'MBA', region: 'Western' },
    { name: 'Kasese', code: 'KAS', region: 'Western' },
    { name: 'Fort Portal', code: 'FPT', region: 'Western' },
    { name: 'Hoima', code: 'HOI', region: 'Western' },
    { name: 'Kabale', code: 'KAB', region: 'Western' },
    { name: 'Kisoro', code: 'KIS', region: 'Western' },
    { name: 'Rukungiri', code: 'RUK', region: 'Western' },
    { name: 'Bushenyi', code: 'BUS', region: 'Western' }
  ];

  for (const district of districts) {
    await District.findOneAndUpdate(
      { code: district.code },
      district,
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${districts.length} districts`);
}

async function seedTransformerRatings() {
  const ratings = [];
  const kvaValues = [50, 100, 160, 200, 250, 315, 500, 630, 1000];
  
  for (const kva of kvaValues) {
    // 11kV ratings
    ratings.push({
      kva: kva,
      network_voltage_kv: 11,
      display_label: `${kva}kVA/11kV`,
      is_standard: true
    });
    
    // 33kV ratings
    ratings.push({
      kva: kva,
      network_voltage_kv: 33,
      display_label: `${kva}kVA/33kV`,
      is_standard: true
    });
  }

  for (const rating of ratings) {
    await TransformerRating.findOneAndUpdate(
      { kva: rating.kva, network_voltage_kv: rating.network_voltage_kv },
      rating,
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded ${ratings.length} transformer ratings`);
}

async function seedAdminUser() {
  // Check if admin user already exists
  const existingAdmin = await User.findOne({ email: 'admin@kVAssetTracker.com' });
  if (existingAdmin) {
    console.log('ℹ️ Admin user already exists, skipping...');
    return;
  }

  const adminUser = new User({
    name: 'System Administrator',
    email: 'admin@kVAssetTracker.com',
    password: 'Admin@1234',
    role: 'Super Admin',
    is_active: true,
    email_verified: true
  });

  await adminUser.save();
  console.log('✅ Admin user created successfully');
  console.log('   Email: admin@kVAssetTracker.com');
  console.log('   Password: Admin@1234');
}

async function seedDemoTransformers() {
  // Import Transformer model
  const Transformer = require('../models/Transformer');
  
  // Check if there are already transformers
  const count = await Transformer.countDocuments();
  if (count > 0) {
    console.log(`ℹ️ ${count} transformers already exist, skipping demo transformers...`);
    return;
  }

  // Get references
  const territories = await Territory.find();
  const districts = await District.find();
  const ratings = await TransformerRating.find();

  // Create some demo transformers
  const demoTransformers = [
    {
      manufacturer: 'ABB',
      serial_number: 'ABB-2023-001',
      kva_rating: 315,
      network_voltage_kv: 11,
      display_rating: '315kVA/11kV',
      voltage_secondary: '415V',
      phase_type: 'Three Phase',
      cooling_type: 'ONAN',
      mounting_type: 'Pole Mounted',
      location_operational: {
        territory_id: territories[0]._id,
        territory_name: territories[0].name,
        service_area_id: (await ServiceArea.findOne({ code: 'KPE' }))._id,
        service_area_name: 'Kampala East',
        feeder_id: (await Feeder.findOne({ code: 'F01' }))._id,
        feeder_name: 'F01 - Nakawa',
        feeder_code: 'F01',
        substation_name: 'Nakawa Substation'
      },
      location_administrative: {
        district_id: districts[0]._id,
        district_name: districts[0].name,
        sub_county: 'Nakawa',
        parish: 'Nakawa East',
        village: 'Kiwatule',
        site_name: 'Kiwatule Trading Centre'
      },
      gps: {
        type: 'Point',
        coordinates: [32.5823, 0.3214],
        method: 'Field Captured',
        accuracy_metres: 5,
        captured_at: new Date()
      },
      installation: {
        install_date: new Date('2023-03-14'),
        installing_contractor: 'UGET Power Ltd',
        commissioned_by: 'John Okello',
        commissioning_date: new Date('2023-03-20'),
        warranty_expiry: new Date('2028-03-20')
      },
      operational_status: 'Active',
      record_status: 'Verified',
      year_manufactured: 2023,
      rating_id: ratings.find(r => r.kva === 315 && r.network_voltage_kv === 11)?._id
    },
    {
      manufacturer: 'Siemens',
      serial_number: 'SIE-2023-002',
      kva_rating: 500,
      network_voltage_kv: 33,
      display_rating: '500kVA/33kV',
      voltage_secondary: '415V',
      phase_type: 'Three Phase',
      cooling_type: 'ONAF',
      mounting_type: 'Plinth',
      location_operational: {
        territory_id: territories[0]._id,
        territory_name: territories[0].name,
        service_area_id: (await ServiceArea.findOne({ code: 'KPE' }))._id,
        service_area_name: 'Kampala East',
        feeder_id: (await Feeder.findOne({ code: 'F03' }))._id,
        feeder_name: 'F03 - Industrial Area',
        feeder_code: 'F03',
        substation_name: 'Industrial Area Substation'
      },
      location_administrative: {
        district_id: districts[0]._id,
        district_name: districts[0].name,
        sub_county: 'Nakawa',
        parish: 'Nakawa East',
        village: 'Industrial Area',
        site_name: 'Industrial Area Substation'
      },
      gps: {
        type: 'Point',
        coordinates: [32.5850, 0.3180],
        method: 'Field Captured',
        accuracy_metres: 5,
        captured_at: new Date()
      },
      installation: {
        install_date: new Date('2023-01-10'),
        installing_contractor: 'Siemens Uganda',
        commissioned_by: 'Robert Muwonge',
        commissioning_date: new Date('2023-01-20'),
        warranty_expiry: new Date('2028-01-20')
      },
      operational_status: 'Active',
      record_status: 'Verified',
      year_manufactured: 2022,
      rating_id: ratings.find(r => r.kva === 500 && r.network_voltage_kv === 33)?._id
    }
  ];

  for (const data of demoTransformers) {
    // Generate asset ID
    const lastTransformer = await Transformer.findOne().sort({ asset_id: -1 });
    let nextNumber = 1;
    if (lastTransformer && lastTransformer.asset_id) {
      const match = lastTransformer.asset_id.match(/TRF-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    data.asset_id = `TRF-${String(nextNumber).padStart(6, '0')}`;
    
    const transformer = new Transformer(data);
    await transformer.save();
  }

  console.log(`✅ Seeded ${demoTransformers.length} demo transformers`);
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  console.log('='.repeat(60));

  try {
    await connectDB();

    // Clear existing data (optional - uncomment if needed)
    // await mongoose.connection.dropDatabase();
    // console.log('⚠️ Database cleared');

    // Seed in order of dependencies
    const territories = await seedTerritories();
    const serviceAreas = await seedServiceAreas(territories);
    await seedFeeders(serviceAreas);
    await seedDistricts();
    await seedTransformerRatings();
    await seedAdminUser();
    await seedDemoTransformers();

    console.log('='.repeat(60));
    console.log('✅ Database seeding completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run seeding
seedDatabase();