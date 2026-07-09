/**
 * Phase 9F validation seed data.
 *
 * This script is intentionally separate from npm run seed. It creates a large,
 * realistic validation dataset with stable Phase 9F prefixes so the dataset can
 * be refreshed without disturbing unrelated local data.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Territory = require('../src/models/Territory');
const ServiceArea = require('../src/models/ServiceArea');
const Feeder = require('../src/models/Feeder');
const District = require('../src/models/District');
const TransformerRating = require('../src/models/TransformerRating');
const Transformer = require('../src/models/Transformer');
const Inspection = require('../src/models/Inspection');
const Fault = require('../src/models/Fault');
const Maintenance = require('../src/models/Maintenance');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');
const BackupJob = require('../src/models/BackupJob');
const MaintenanceModeService = require('../src/services/maintenanceModeService');
const BackupService = require('../src/services/backupService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kVAssetTracker';
const PASSWORD = 'Phase9F@1234';
const PHASE = 'phase9f-validation';

const manufacturers = ['ABB', 'Schneider Electric', 'Siemens', 'Toshiba', 'Wilson', 'TBEA', 'Lucy Electric'];
const mountingTypes = ['Pole Mounted', 'Ground', 'Plinth', 'Indoor Substation'];
const statuses = ['Active', 'Active', 'Active', 'Under Maintenance', 'Faulty', 'Decommissioned'];
const conditions = ['Good', 'Fair', 'Poor', 'Critical'];
const kvaValues = [50, 100, 160, 200, 250, 315, 500, 630, 1000];
const voltages = [11, 33];
const faultTypes = ['Overload', 'Oil Leak', 'Bushing Failure', 'Complete Failure', 'Theft', 'Vandalism', 'LV Side Fault', 'HV Side Fault', 'Other'];
const faultSeverities = ['Minor', 'Major', 'Critical', 'Complete Outage'];
const faultStatuses = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const maintenanceTypes = ['Preventive', 'Corrective', 'Emergency'];
const demoUserSpecs = [
  { label: 'Super Admin', name: 'Phase 9F Super Admin', email: 'super.admin@phase9f.io', role: 'Super Admin', active: true },
  { label: 'Operations Manager', name: 'Phase 9F Operations Manager', email: 'operations.manager@phase9f.io', role: 'Territory Manager', active: true },
  { label: 'Supervisor North', name: 'Phase 9F Supervisor North', email: 'supervisor.north@phase9f.io', role: 'Engineer', active: true },
  { label: 'Supervisor South', name: 'Phase 9F Supervisor South', email: 'supervisor.south@phase9f.io', role: 'Engineer', active: true },
  { label: 'Field Technician 1', name: 'Phase 9F Field Technician 1', email: 'technician1@phase9f.io', role: 'Field Technician', active: true },
  { label: 'Field Technician 2', name: 'Phase 9F Field Technician 2', email: 'technician2@phase9f.io', role: 'Field Technician', active: true },
  { label: 'Field Technician 3', name: 'Phase 9F Field Technician 3', email: 'technician3@phase9f.io', role: 'Field Technician', active: true },
  { label: 'Field Technician 4', name: 'Phase 9F Field Technician 4', email: 'technician4@phase9f.io', role: 'Field Technician', active: true },
  { label: 'Field Technician 5', name: 'Phase 9F Field Technician 5', email: 'technician5@phase9f.io', role: 'Field Technician', active: true },
  { label: 'Viewer 1', name: 'Phase 9F Viewer One', email: 'viewer1@phase9f.io', role: 'Viewer', active: true },
  { label: 'Viewer 2', name: 'Phase 9F Viewer Two', email: 'viewer2@phase9f.io', role: 'Viewer', active: false }
];

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function pick(items, index) {
  return items[index % items.length];
}

async function connect() {
  await mongoose.connect(MONGODB_URI);
}

async function clearPhase9F() {
  const users = await User.find({ email: /@phase9f\.(local|io)$/ }).select('_id');
  const userIds = users.map((item) => item._id);
  const transformers = await Transformer.find({ asset_id: /^P9F-/ }).select('_id');
  const transformerIds = transformers.map((item) => item._id);

  await Promise.all([
    Notification.deleteMany({ $or: [{ user_id: { $in: userIds } }, { 'data.phase': PHASE }] }),
    AuditLog.deleteMany({ $or: [{ user_id: { $in: userIds } }, { 'metadata.phase': PHASE }, { details: /^Phase 9F/ }] }),
    Maintenance.deleteMany({ transformer_id: { $in: transformerIds } }),
    Fault.deleteMany({ transformer_id: { $in: transformerIds } }),
    Inspection.deleteMany({ transformer_id: { $in: transformerIds } }),
    Transformer.deleteMany({ _id: { $in: transformerIds } }),
    BackupJob.deleteMany({ 'metadata.phase': PHASE }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
}

async function seedReferences() {
  const territorySpecs = [
    { name: 'Phase 9F Central', code: 'P9FC', description: 'Phase 9F validation central territory', region: 'Central' },
    { name: 'Phase 9F Eastern', code: 'P9FE', description: 'Phase 9F validation eastern territory', region: 'Eastern' },
    { name: 'Phase 9F Western', code: 'P9FW', description: 'Phase 9F validation western territory', region: 'Western' }
  ];

  const territories = [];
  for (const spec of territorySpecs) {
    territories.push(await Territory.findOneAndUpdate({ code: spec.code }, spec, { upsert: true, new: true, runValidators: true }));
  }

  const serviceAreas = [];
  for (let index = 0; index < 6; index += 1) {
    const territory = pick(territories, index);
    serviceAreas.push(await ServiceArea.findOneAndUpdate(
      { code: `P9FSA${index + 1}` },
      {
        territory_id: territory._id,
        name: `Phase 9F Service Area ${index + 1}`,
        code: `P9FSA${index + 1}`,
        location_town: ['Kampala', 'Jinja', 'Mbarara', 'Mukono', 'Mbale', 'Gulu'][index],
        is_active: true
      },
      { upsert: true, new: true, runValidators: true }
    ));
  }

  const feeders = [];
  for (let index = 0; index < 12; index += 1) {
    const serviceArea = pick(serviceAreas, index);
    feeders.push(await Feeder.findOneAndUpdate(
      { code: `P9FF${String(index + 1).padStart(2, '0')}` },
      {
        service_area_id: serviceArea._id,
        name: `Phase 9F Feeder ${String(index + 1).padStart(2, '0')}`,
        code: `P9FF${String(index + 1).padStart(2, '0')}`,
        network_voltage_kv: pick(voltages, index),
        is_active: true
      },
      { upsert: true, new: true, runValidators: true }
    ));
  }

  const districts = [];
  for (const [index, name] of ['Kampala', 'Jinja', 'Mbarara', 'Mukono', 'Mbale', 'Gulu'].entries()) {
    districts.push(await District.findOneAndUpdate(
      { code: `P9FD${index + 1}` },
      { name: `Phase 9F ${name}`, code: `P9FD${index + 1}`, region: pick(['Central', 'Eastern', 'Western', 'Northern'], index), is_active: true },
      { upsert: true, new: true, runValidators: true }
    ));
  }

  for (const kva of kvaValues) {
    for (const network_voltage_kv of voltages) {
      await TransformerRating.findOneAndUpdate(
        { kva, network_voltage_kv },
        { kva, network_voltage_kv, display_label: `${kva}kVA/${network_voltage_kv}kV`, is_standard: true, is_active: true },
        { upsert: true, new: true, runValidators: true }
      );
    }
  }

  return { territories, serviceAreas, feeders, districts };
}

async function createUser(spec, adminId = undefined) {
  const user = new User({
    ...spec,
    password: PASSWORD,
    email_verified: true,
    created_by: adminId,
    last_login: daysAgo(spec.role === 'Viewer' ? 21 : 2)
  });
  await user.save();
  return user;
}

async function seedUsers(refs) {
  const central = refs.territories[0];
  const serviceArea = refs.serviceAreas[0];
  const adminSpec = demoUserSpecs[0];
  const admin = await createUser({
    name: adminSpec.name,
    email: adminSpec.email,
    role: adminSpec.role,
    is_active: adminSpec.active
  });

  const specs = [
    { ...demoUserSpecs[1], territory_id: central._id },
    { ...demoUserSpecs[2], territory_id: central._id, service_area_id: serviceArea._id },
    { ...demoUserSpecs[3], territory_id: refs.territories[1]._id, service_area_id: refs.serviceAreas[1]._id },
    ...demoUserSpecs.slice(4, 9).map((spec, index) => ({
      ...spec,
      territory_id: pick(refs.territories, index)._id,
      service_area_id: pick(refs.serviceAreas, index)._id
    })),
    demoUserSpecs[9],
    demoUserSpecs[10]
  ].map(({ label, active, ...spec }) => ({ ...spec, is_active: active }));

  const users = [admin];
  for (const spec of specs) {
    users.push(await createUser(spec, admin._id));
  }
  return users;
}

function printDemoAccounts() {
  console.log('=================================');
  console.log('Demo Accounts');
  console.log(`Password: ${PASSWORD}`);
  console.log('=================================');
  for (const user of demoUserSpecs) {
    console.log(`${user.label}`);
    console.log(`${user.name}`);
    console.log(`${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.active ? 'Active' : 'Inactive'}`);
    console.log('Password: ' + PASSWORD);
    console.log('---------------------------------');
  }
  console.log('Reset passwords: node scripts/resetDemoPasswords.js');
  console.log('=================================');
}

async function seedTransformers(refs, admin) {
  const transformers = [];
  const missingGpsAssetIds = [];
  for (let index = 0; index < 50; index += 1) {
    const feeder = pick(refs.feeders, index);
    const serviceArea = refs.serviceAreas.find((item) => item._id.equals(feeder.service_area_id)) || pick(refs.serviceAreas, index);
    const territory = refs.territories.find((item) => item._id.equals(serviceArea.territory_id)) || pick(refs.territories, index);
    const district = pick(refs.districts, index);
    const kva = pick(kvaValues, index);
    const voltage = feeder.network_voltage_kv || pick(voltages, index);
    const status = pick(statuses, index);
    const load = index % 9 === 0 ? 112 : index % 7 === 0 ? 96 : 45 + (index % 43);
    const coordinates = [32.55 + (index % 10) * 0.035, 0.31 + Math.floor(index / 10) * 0.055];
    if (index % 8 === 0) missingGpsAssetIds.push(`P9F-TX-${String(index + 1).padStart(3, '0')}`);
    const installDate = daysAgo(365 * (2 + (index % 24)));

    transformers.push(await Transformer.create({
      asset_id: `P9F-TX-${String(index + 1).padStart(3, '0')}`,
      uedcl_reference: `P9F-UEDCL-${String(index + 1).padStart(4, '0')}`,
      manufacturer: pick(manufacturers, index),
      serial_number: `P9F-SN-${String(10000 + index)}`,
      year_manufactured: installDate.getFullYear() - 1,
      record_status: 'Active',
      kva_rating: kva,
      network_voltage_kv: voltage,
      display_rating: `${kva}kVA/${voltage}kV`,
      voltage_secondary: index % 5 === 0 ? '240V' : '415V',
      phase_type: index % 6 === 0 ? 'Single Phase' : 'Three Phase',
      cooling_type: pick(['ONAN', 'ONAF', 'OFAF'], index),
      mounting_type: pick(mountingTypes, index),
      vector_group: index % 2 === 0 ? 'Dyn11' : 'Yyn0',
      location_operational: {
        territory_id: territory._id,
        territory_name: territory.name,
        service_area_id: serviceArea._id,
        service_area_name: serviceArea.name,
        feeder_id: feeder._id,
        feeder_name: feeder.name,
        feeder_code: feeder.code,
        substation_name: `P9F Substation ${1 + (index % 8)}`
      },
      location_administrative: {
        district_id: district._id,
        district_name: district.name,
        sub_county: `P9F Sub County ${1 + (index % 9)}`,
        parish: `P9F Parish ${1 + (index % 12)}`,
        village: `P9F Village ${1 + (index % 20)}`,
        site_name: `Phase 9F Site ${String(index + 1).padStart(2, '0')}`
      },
      gps: {
        type: 'Point',
        coordinates,
        method: index % 3 === 0 ? 'Estimated' : 'Field Captured',
        accuracy_metres: index % 3 === 0 ? 25 : 5,
        captured_at: daysAgo(index)
      },
      installation: {
        install_date: installDate,
        installing_contractor: pick(['GridWorks Ltd', 'Utility Services Co', 'Northline Contractors'], index),
        commissioned_by: 'Phase 9F Commissioning Team',
        commissioning_date: daysAgo(365 * (2 + (index % 24)) - 14),
        warranty_expiry: daysFromNow(index % 4 === 0 ? -30 : 365)
      },
      operational_status: status,
      has_open_fault: ['Faulty', 'Under Maintenance'].includes(status),
      last_inspection_date: daysAgo(index % 11 === 0 ? 145 : 3 + (index % 70)),
      last_maintenance_date: daysAgo(14 + (index % 180)),
      last_load_reading_date: daysAgo(index % 30),
      last_load_percentage: load,
      overdue_inspection_flag: index % 11 === 0,
      is_deleted: false,
      created_by: admin._id
    }));
  }
  await Transformer.updateMany({ asset_id: { $in: missingGpsAssetIds } }, { $unset: { gps: '' } });
  missingGpsAssetIds.forEach((assetId) => {
    const transformer = transformers.find((item) => item.asset_id === assetId);
    if (transformer) transformer.gps = undefined;
  });
  return transformers;
}

async function seedInspections(transformers, users) {
  const inspectors = users.filter((user) => ['Field Technician', 'Engineer'].includes(user.role));
  const inspections = [];
  for (let index = 0; index < 180; index += 1) {
    const transformer = pick(transformers, index);
    const condition = pick(conditions, index);
    const overload = index % 10 === 0;
    const date = daysAgo(index % 12 === 0 ? 150 + (index % 40) : index % 90);
    inspections.push({
      transformer_id: transformer._id,
      inspector_id: pick(inspectors, index)._id,
      inspection_date: date,
      visit_type: pick(['Routine Inspection', 'Follow-up', 'Audit'], index),
      gps_at_inspection: transformer.gps?.coordinates?.length ? { type: 'Point', coordinates: transformer.gps.coordinates } : undefined,
      gps_accuracy: transformer.gps?.coordinates?.length ? 5 + (index % 10) : undefined,
      network_voltage_confirmed: index % 8 !== 0,
      kva_rating_confirmed: index % 9 !== 0,
      physical: {
        overall_condition: condition,
        rust_corrosion: condition === 'Good' ? 'None' : condition === 'Fair' ? 'Minor' : 'Severe',
        oil_leakage: condition === 'Critical' ? 'Active Leak' : condition === 'Poor' ? 'Slow Drip' : 'None',
        bushing_condition: condition === 'Critical' ? 'Broken' : condition === 'Poor' ? 'Cracked' : 'Good',
        tank_body_damage: condition === 'Good' ? 'None' : 'Dents',
        cooling_fins_condition: condition === 'Good' ? 'Good' : index % 2 ? 'Damaged' : 'Blocked',
        sound_level: condition === 'Good' ? 'Normal' : condition === 'Fair' ? 'Unusual' : 'Loud',
        temperature: 45 + (index % 45)
      },
      oil_breather: {
        oil_level: condition === 'Critical' ? 'Very Low' : condition === 'Poor' ? 'Low' : 'Adequate',
        silica_gel_color: condition === 'Good' ? 'Blue' : condition === 'Fair' ? 'White' : 'Pink',
        oil_test_required: ['Poor', 'Critical'].includes(condition),
        oil_test_notes: ['Poor', 'Critical'].includes(condition) ? 'Oil sample recommended during next maintenance window.' : '',
        oil_temperature: 42 + (index % 38)
      },
      electrical: {
        load_current_a: 120 + (index % 80),
        load_current_b: 118 + (index % 82),
        load_current_c: 121 + (index % 79),
        voltage_hv_side: transformer.network_voltage_kv,
        voltage_lv_side: 415,
        load_percentage: overload ? 110 : 35 + (index % 60),
        overload_flag: overload,
        power_factor: Math.min(0.99, 0.78 + (index % 20) / 100),
        frequency: 49.5 + (index % 10) / 10
      },
      site_safety: {
        security_fencing: index % 7 === 0 ? 'Damaged' : 'Present',
        earthing: index % 9 === 0 ? 'Absent' : 'Present',
        warning_signs: index % 8 === 0 ? 'Absent' : 'Present',
        vegetation_encroachment: index % 10 === 0 ? 'Severe' : index % 4 === 0 ? 'Moderate' : 'None',
        unauthorised_connections: index % 17 === 0,
        safety_notes: index % 10 === 0 ? 'Vegetation clearance and warning signage required.' : 'Site access normal.'
      },
      condition_narrative: `Phase 9F inspection ${index + 1}: ${condition} condition recorded for ${transformer.asset_id}.`,
      recommended_action: condition === 'Critical' ? 'Urgent Repair' : condition === 'Poor' ? 'Schedule Maintenance' : overload ? 'Monitor' : 'No Action',
      recommended_action_details: overload ? 'Monitor loading during evening peak.' : 'Follow standard inspection cadence.',
      photos: index % 3 === 0 ? [`https://example.invalid/phase9f/inspection-${index + 1}-before.jpg`] : [],
      sync_status: pick(['synced', 'synced', 'pending', 'conflict'], index)
    });
  }
  return Inspection.insertMany(inspections, { ordered: false });
}

async function seedFaults(transformers, inspections, users) {
  const reporters = users.filter((user) => ['Engineer', 'Field Technician', 'Territory Manager'].includes(user.role));
  const faults = [];
  for (let index = 0; index < 40; index += 1) {
    const transformer = pick(transformers, index * 2);
    const status = pick(faultStatuses, index);
    const assigned = pick(reporters, index + 1);
    const faultDate = daysAgo(index % 20);
    faults.push({
      transformer_id: transformer._id,
      inspection_id: index % 3 === 0 ? pick(inspections, index)._id : undefined,
      reported_by: pick(reporters, index)._id,
      fault_date: faultDate,
      fault_source: pick(['Field Observation', 'Customer Report', 'Supervisor'], index),
      fault_description: `Phase 9F ${pick(faultTypes, index).toLowerCase()} reported at ${transformer.asset_id}.`,
      fault_type: pick(faultTypes, index),
      severity: pick(faultSeverities, index),
      network_voltage_kv: transformer.network_voltage_kv,
      customers_affected: 12 + (index * 7),
      area_affected: transformer.location_administrative?.site_name,
      photos: index % 4 === 0 ? [`https://example.invalid/phase9f/fault-${index + 1}.jpg`] : [],
      fault_status: status,
      assigned_to: status === 'Open' ? undefined : assigned._id,
      date_assigned: status === 'Open' ? undefined : daysAgo(Math.max(1, (index % 10) - 1)),
      target_resolution_date: daysFromNow(1 + (index % 7)),
      resolved_date: ['Resolved', 'Closed'].includes(status) ? daysAgo(index % 5) : undefined,
      resolution_description: ['Resolved', 'Closed'].includes(status) ? 'Phase 9F validation repair completed.' : undefined,
      root_cause: ['Resolved', 'Closed'].includes(status) ? pick(['Overload', 'Ageing insulation', 'Loose LV lug', 'Vandalism'], index) : undefined,
      parts_replaced: ['Resolved', 'Closed'].includes(status) ? pick(['LV fuse set', 'Bushing set', 'Oil gasket', 'No parts'], index) : undefined,
      resolved_by: ['Resolved', 'Closed'].includes(status) ? assigned._id : undefined,
      photos_after_repair: status === 'Closed' ? [`https://example.invalid/phase9f/fault-${index + 1}-after.jpg`] : []
    });
  }
  return Fault.insertMany(faults, { ordered: false });
}

async function seedMaintenance(transformers, users) {
  const technicians = users.filter((user) => ['Field Technician', 'Engineer'].includes(user.role));
  const maintenance = [];
  for (let index = 0; index < 80; index += 1) {
    const transformer = pick(transformers, index);
    const type = pick(maintenanceTypes, index);
    maintenance.push({
      transformer_id: transformer._id,
      technician_id: pick(technicians, index)._id,
      maintenance_date: daysAgo(index % 120),
      maintenance_type: type,
      team_contractor: pick(['Internal Team A', 'GridWorks Ltd', 'Emergency Response Unit'], index),
      supervised_by: pick(['Phase 9F Supervisor North', 'Phase 9F Supervisor South'], index),
      work_order_number: `P9F-WO-${String(index + 1).padStart(4, '0')}`,
      work_performed: {
        oil_top_up: { performed: index % 3 === 0, litres_added: index % 3 === 0 ? 12 + (index % 20) : undefined },
        oil_replacement: type === 'Corrective' && index % 4 === 0,
        oil_filtration: index % 5 === 0,
        silica_gel_replaced: index % 2 === 0,
        bushing_replacement: type !== 'Preventive' && index % 6 === 0,
        tap_changer_service: index % 7 === 0,
        cooling_system_service: index % 4 === 0,
        physical_cleaning: true,
        painting: index % 8 === 0,
        earthing_repair: index % 9 === 0,
        other_work: type === 'Emergency' ? 'Emergency isolation and post-repair inspection.' : ''
      },
      parts_used: index % 2 === 0 ? [{
        part: pick(['Silica gel', 'LV fuse', 'Bushing', 'Gasket kit'], index),
        quantity: 1 + (index % 4),
        unit: 'piece',
        manufacturer: pick(manufacturers, index),
        cost: 50000 + (index * 2500)
      }] : [],
      pre_maintenance_notes: `Phase 9F pre-maintenance notes for ${transformer.asset_id}.`,
      post_condition_narrative: `Phase 9F ${type.toLowerCase()} maintenance completed for ${transformer.asset_id}.`,
      completed_by: pick(technicians, index).name,
      reviewed_by: index % 5 === 0 ? undefined : pick(['Phase 9F Supervisor North', 'Phase 9F Supervisor South'], index),
      reviewed_at: index % 5 === 0 ? undefined : daysAgo(index % 10),
      next_maintenance_date: index % 9 === 0 ? daysAgo(5 + (index % 20)) : daysFromNow(15 + (index % 120)),
      next_maintenance_notes: index % 9 === 0 ? 'Overdue follow-up required.' : 'Next planned maintenance window scheduled.',
      labour_cost: 75000 + (index * 5000),
      photos_before: index % 4 === 0 ? [`https://example.invalid/phase9f/maintenance-${index + 1}-before.jpg`] : [],
      photos_after: index % 4 === 0 ? [`https://example.invalid/phase9f/maintenance-${index + 1}-after.jpg`] : [],
      sync_status: pick(['synced', 'synced', 'pending'], index)
    });
  }
  return Maintenance.insertMany(maintenance, { ordered: false });
}

async function seedAuditLogs(users, transformers, faults, maintenance) {
  const categories = ['AUTH', 'USER_MANAGEMENT', 'TRANSFORMER_MANAGEMENT', 'INSPECTION', 'FAULT_MANAGEMENT', 'MAINTENANCE', 'REPORTING', 'EXPORT', 'SYSTEM'];
  const actions = {
    AUTH: ['LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'INVALID_LOGIN'],
    USER_MANAGEMENT: ['USER_CREATE', 'USER_UPDATE', 'USER_DEACTIVATE', 'USER_ACTIVATE'],
    TRANSFORMER_MANAGEMENT: ['TRANSFORMER_CREATE', 'TRANSFORMER_UPDATE', 'TRANSFORMER_VIEW'],
    INSPECTION: ['INSPECTION_CREATE', 'INSPECTION_UPDATE', 'INSPECTION_VIEW'],
    FAULT_MANAGEMENT: ['FAULT_CREATE', 'FAULT_ASSIGN', 'FAULT_RESOLVE', 'FAULT_CLOSE'],
    MAINTENANCE: ['MAINTENANCE_CREATE', 'MAINTENANCE_COMPLETE'],
    REPORTING: ['REPORT_GENERATE'],
    EXPORT: ['EXPORT_CSV'],
    SYSTEM: ['SYSTEM_BACKUP_COMPLETED', 'SYSTEM_RESTORE_COMPLETED', 'SYSTEM_MAINTENANCE_ENABLED']
  };
  const logs = [];

  for (let index = 0; index < 330; index += 1) {
    const category = pick(categories, index);
    const action = pick(actions[category], index);
    const user = pick(users, index);
    const transformer = pick(transformers, index);
    const isFault = category === 'FAULT_MANAGEMENT';
    const isMaintenance = category === 'MAINTENANCE';
    logs.push({
      user_id: user._id,
      action,
      action_category: category,
      target_user_id: category === 'USER_MANAGEMENT' ? pick(users, index + 1)._id : undefined,
      target_transformer_id: ['TRANSFORMER_MANAGEMENT', 'INSPECTION', 'FAULT_MANAGEMENT', 'MAINTENANCE'].includes(category) ? transformer._id : undefined,
      target_record_type: isFault ? 'Fault' : isMaintenance ? 'Maintenance' : category === 'USER_MANAGEMENT' ? 'User' : category === 'REPORTING' ? 'Report' : 'Transformer',
      target_record_id: isFault ? pick(faults, index)._id : isMaintenance ? pick(maintenance, index)._id : transformer._id,
      details: `Phase 9F audit event ${index + 1}: ${action.replace(/_/g, ' ').toLowerCase()}.`,
      request_method: pick(['GET', 'POST', 'PUT', 'PATCH'], index),
      request_path: `/api/phase9f/${category.toLowerCase()}`,
      ip_address: `10.9.${Math.floor(index / 255)}.${1 + (index % 254)}`,
      user_agent: 'Phase9FValidation/1.0',
      old_values: index % 4 === 0 ? { status: 'Before' } : {},
      new_values: index % 4 === 0 ? { status: 'After' } : {},
      metadata: { phase: PHASE, sequence: index + 1 },
      created_at: daysAgo(index % 45),
      updated_at: daysAgo(index % 45)
    });
  }
  return AuditLog.insertMany(logs, { ordered: false });
}

async function seedNotifications(users, transformers, faults, maintenance) {
  const types = ['MAINTENANCE_ALERT', 'OVERDUE_INSPECTION', 'FAULT_ALERT', 'SYSTEM_ALERT', 'REPORT_READY', 'USER_ACTION_REQUIRED'];
  const notifications = [];
  for (let index = 0; index < 90; index += 1) {
    const type = pick(types, index);
    const transformer = pick(transformers, index);
    const linked = type === 'FAULT_ALERT'
      ? { linked_record_type: 'Fault', linked_record_id: pick(faults, index)._id }
      : type === 'MAINTENANCE_ALERT'
        ? { linked_record_type: 'Maintenance', linked_record_id: pick(maintenance, index)._id }
        : { linked_record_type: 'Transformer', linked_record_id: transformer._id };
    notifications.push({
      user_id: pick(users, index)._id,
      type,
      priority: pick(['low', 'normal', 'high', 'critical'], index),
      title: `Phase 9F ${type.replace(/_/g, ' ').toLowerCase()}`,
      message: `Validation notification for ${transformer.asset_id}: ${type.replace(/_/g, ' ').toLowerCase()}.`,
      data: {
        phase: PHASE,
        transformer_id: transformer._id.toString(),
        asset_id: transformer.asset_id
      },
      ...linked,
      is_read: index % 3 === 0,
      read_at: index % 3 === 0 ? daysAgo(index % 14) : undefined,
      delivered_at: daysAgo(index % 7),
      delivery_methods: ['app'],
      delivery_status: 'delivered',
      created_at: daysAgo(index % 30),
      updated_at: daysAgo(index % 30)
    });
  }
  return Notification.insertMany(notifications, { ordered: false });
}

async function seedBackupHistory(admin) {
  await MaintenanceModeService.setState({
    enabled: true,
    message: 'Phase 9F validation backup window',
    reason: 'Creating validation backups'
  }, admin);

  const created = [];
  for (let index = 0; index < 2; index += 1) {
    const result = await BackupService.createBackup({
      backup_name: `phase9f-validation-${index + 1}`,
      collections: ['transformers', 'inspections', 'faults', 'maintenances'],
      metadata: { phase: PHASE, seed_index: index + 1 }
    }, admin, null);
    created.push(result.job);
  }

  const failed = await BackupJob.create({
    backup_id: `P9F-FAILED-${Date.now()}`,
    filename: 'phase9f-failed-backup.json.gz',
    status: 'FAILED',
    operation_type: 'BACKUP',
    started_at: daysAgo(1),
    completed_at: daysAgo(1),
    created_by: admin._id,
    compression: 'gzip',
    encryption: false,
    size_bytes: 0,
    collections: [{ name: 'transformers', document_count: 50 }],
    schema_version: '1.0',
    app_version: require('../package.json').version,
    metadata: { phase: PHASE, failure_fixture: true },
    error_message: 'Phase 9F seeded failed backup for history validation.'
  });

  await MaintenanceModeService.setState({
    enabled: false,
    message: 'System is available',
    reason: 'Phase 9F validation backups seeded'
  }, admin);

  return [...created, failed];
}

async function summarize() {
  const [
    users,
    transformers,
    inspections,
    faults,
    maintenance,
    auditLogs,
    notifications,
    backupJobs
  ] = await Promise.all([
    User.countDocuments({ email: /@phase9f\.(local|io)$/ }),
    Transformer.countDocuments({ asset_id: /^P9F-/ }),
    Inspection.countDocuments({}),
    Fault.countDocuments({}),
    Maintenance.countDocuments({}),
    AuditLog.countDocuments({ 'metadata.phase': PHASE }),
    Notification.countDocuments({ 'data.phase': PHASE }),
    BackupJob.countDocuments({ 'metadata.phase': PHASE })
  ]);

  return {
    users,
    phase9f_transformers: transformers,
    total_inspections: inspections,
    total_faults: faults,
    total_maintenance_records: maintenance,
    phase9f_audit_logs: auditLogs,
    phase9f_notifications: notifications,
    phase9f_backup_jobs: backupJobs,
    login_accounts: {
      super_admin: 'super.admin@phase9f.io',
      operations_manager: 'operations.manager@phase9f.io',
      supervisor: 'supervisor.north@phase9f.io',
      technician: 'technician1@phase9f.io',
      viewer: 'viewer1@phase9f.io',
      password: PASSWORD
    },
    role_mapping: {
      'Operations Manager': 'Territory Manager',
      Supervisor: 'Engineer'
    }
  };
}

async function main() {
  await connect();
  await clearPhase9F();
  const refs = await seedReferences();
  const users = await seedUsers(refs);
  const admin = users[0];
  const transformers = await seedTransformers(refs, admin);
  const inspections = await seedInspections(transformers, users);
  const faults = await seedFaults(transformers, inspections, users);
  const maintenance = await seedMaintenance(transformers, users);
  await seedAuditLogs(users, transformers, faults, maintenance);
  await seedNotifications(users, transformers, faults, maintenance);
  await seedBackupHistory(admin);
  const summary = await summarize();
  console.log(JSON.stringify(summary, null, 2));
  printDemoAccounts();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
