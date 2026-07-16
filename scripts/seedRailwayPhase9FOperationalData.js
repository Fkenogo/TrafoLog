#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

const District = require('../src/models/District');
const Feeder = require('../src/models/Feeder');
const Transformer = require('../src/models/Transformer');
const Inspection = require('../src/models/Inspection');
const Fault = require('../src/models/Fault');
const Maintenance = require('../src/models/Maintenance');
const Territory = require('../src/models/Territory');
const ServiceArea = require('../src/models/ServiceArea');
const User = require('../src/models/User');
const { TERRITORY_SPECS, SERVICE_AREA_SPECS } = require('./seedRailwayPhase9FReferences');
const { DEMO_USER_SPECS } = require('./seedRailwayDemoUsers');

const REQUIRED_ENV_VAR = 'MONGODB_URI';

const freezeSpecs = (specs) => Object.freeze(specs.map((spec) => Object.freeze(spec)));

const OWNED_FIELDS = Object.freeze({
  District: Object.freeze(['name', 'code', 'region', 'is_active']),
  Feeder: Object.freeze(['service_area_id', 'name', 'code', 'network_voltage_kv', 'is_active']),
  Transformer: Object.freeze([
    'asset_id', 'uedcl_reference', 'manufacturer', 'serial_number', 'year_manufactured',
    'record_status', 'kva_rating', 'network_voltage_kv', 'display_rating', 'voltage_secondary',
    'phase_type', 'cooling_type', 'mounting_type', 'vector_group',
    'location_operational.territory_id', 'location_operational.territory_name',
    'location_operational.service_area_id', 'location_operational.service_area_name',
    'location_operational.feeder_id', 'location_operational.feeder_name',
    'location_operational.feeder_code', 'location_operational.substation_name',
    'location_administrative.district_id', 'location_administrative.district_name',
    'location_administrative.sub_county', 'location_administrative.parish',
    'location_administrative.village', 'location_administrative.site_name',
    'gps.type', 'gps.coordinates', 'gps.method', 'gps.accuracy_metres', 'gps.captured_at',
    'installation.install_date', 'installation.installing_contractor',
    'installation.commissioned_by', 'installation.commissioning_date',
    'installation.warranty_expiry', 'operational_status', 'has_open_fault',
    'last_inspection_date', 'last_maintenance_date', 'last_load_reading_date',
    'last_load_percentage', 'overdue_inspection_flag', 'is_deleted', 'deleted_at',
    'created_by', 'updated_by'
  ]),
  Inspection: Object.freeze([
    'transformer_id', 'inspector_id', 'inspection_date', 'visit_type',
    'gps_at_inspection.type', 'gps_at_inspection.coordinates', 'gps_accuracy',
    'network_voltage_confirmed', 'kva_rating_confirmed', 'rating_discrepancy_flag',
    'rating_discrepancy_details', 'physical.overall_condition', 'physical.rust_corrosion',
    'physical.oil_leakage', 'physical.bushing_condition', 'physical.tank_body_damage',
    'physical.cooling_fins_condition', 'physical.sound_level', 'physical.temperature',
    'oil_breather.oil_level', 'oil_breather.silica_gel_color',
    'oil_breather.oil_test_required', 'oil_breather.oil_test_notes',
    'oil_breather.oil_temperature', 'electrical.load_current_a',
    'electrical.load_current_b', 'electrical.load_current_c',
    'electrical.voltage_hv_side', 'electrical.voltage_lv_side',
    'electrical.load_percentage', 'electrical.overload_flag',
    'electrical.power_factor', 'electrical.frequency', 'site_safety.security_fencing',
    'site_safety.earthing', 'site_safety.warning_signs',
    'site_safety.vegetation_encroachment', 'site_safety.unauthorised_connections',
    'site_safety.safety_notes', 'condition_narrative', 'recommended_action',
    'recommended_action_details', 'sync_status', 'sync_version', 'is_deleted', 'deleted_at'
  ]),
  Fault: Object.freeze([
    'transformer_id', 'inspection_id', 'reported_by', 'fault_date', 'fault_source',
    'fault_description', 'fault_type', 'severity', 'network_voltage_kv',
    'customers_affected', 'area_affected', 'fault_status', 'assigned_to',
    'date_assigned', 'target_resolution_date', 'resolved_date',
    'resolution_description', 'root_cause', 'parts_replaced', 'downtime_hours', 'resolved_by'
  ]),
  Maintenance: Object.freeze([
    'transformer_id', 'technician_id', 'maintenance_date', 'maintenance_type',
    'team_contractor', 'supervised_by', 'work_order_number',
    'work_performed.oil_top_up.performed', 'work_performed.oil_top_up.litres_added',
    'work_performed.oil_replacement', 'work_performed.oil_filtration',
    'work_performed.silica_gel_replaced', 'work_performed.bushing_replacement',
    'work_performed.tap_changer_service', 'work_performed.cooling_system_service',
    'work_performed.physical_cleaning', 'work_performed.painting',
    'work_performed.earthing_repair', 'work_performed.other_work',
    'pre_maintenance_load.phase_a', 'pre_maintenance_load.phase_b',
    'pre_maintenance_load.phase_c', 'pre_maintenance_notes', 'post_condition_narrative',
    'post_maintenance_load.phase_a', 'post_maintenance_load.phase_b',
    'post_maintenance_load.phase_c', 'post_maintenance_readings.voltage_hv',
    'post_maintenance_readings.voltage_lv', 'post_maintenance_readings.oil_temperature',
    'post_maintenance_readings.ambient_temperature', 'completed_by', 'reviewed_by',
    'reviewed_at', 'review_notes', 'next_maintenance_date', 'next_maintenance_notes',
    'total_cost', 'parts_cost', 'labour_cost', 'sync_status', 'sync_version',
    'is_deleted', 'deleted_at'
  ])
});

const DISTRICT_SPECS = freezeSpecs([
  { code: 'P9FR-D01', name: 'Phase 9F Railway Kampala District', region: 'Central', is_active: true },
  { code: 'P9FR-D02', name: 'Phase 9F Railway Jinja District', region: 'Eastern', is_active: true },
  { code: 'P9FR-D03', name: 'Phase 9F Railway Mbarara District', region: 'Western', is_active: true },
  { code: 'P9FR-D04', name: 'Phase 9F Railway Mukono District', region: 'Central', is_active: true },
  { code: 'P9FR-D05', name: 'Phase 9F Railway Mbale District', region: 'Eastern', is_active: true }
]);

const FEEDER_SPECS = freezeSpecs([
  { code: 'P9FR-F01', name: 'Kampala North Demo Feeder', serviceAreaCode: 'P9FSA1', network_voltage_kv: 11, is_active: true },
  { code: 'P9FR-F02', name: 'Kampala Central Demo Feeder', serviceAreaCode: 'P9FSA1', network_voltage_kv: 33, is_active: true },
  { code: 'P9FR-F03', name: 'Jinja Riverside Demo Feeder', serviceAreaCode: 'P9FSA2', network_voltage_kv: 11, is_active: true },
  { code: 'P9FR-F04', name: 'Jinja Industrial Demo Feeder', serviceAreaCode: 'P9FSA2', network_voltage_kv: 33, is_active: true },
  { code: 'P9FR-F05', name: 'Mbarara West Demo Feeder', serviceAreaCode: 'P9FSA3', network_voltage_kv: 11, is_active: true },
  { code: 'P9FR-F06', name: 'Mukono Town Demo Feeder', serviceAreaCode: 'P9FSA4', network_voltage_kv: 11, is_active: true },
  { code: 'P9FR-F07', name: 'Mbale Highlands Demo Feeder', serviceAreaCode: 'P9FSA5', network_voltage_kv: 33, is_active: true }
]);

const transformerRows = [
  ['P9FR-TX-001', 'P9FC', 'P9FSA1', 'P9FR-D01', 'P9FR-F01', 'Active', 100, 11, 32.5825, 0.3476],
  ['P9FR-TX-002', 'P9FC', 'P9FSA1', 'P9FR-D01', 'P9FR-F02', 'Faulty', 315, 33, 32.5751, 0.3320],
  ['P9FR-TX-003', 'P9FC', 'P9FSA1', 'P9FR-D01', 'P9FR-F01', 'Active', 160, 11, 32.6012, 0.3650],
  ['P9FR-TX-004', 'P9FE', 'P9FSA2', 'P9FR-D02', 'P9FR-F03', 'Active', 200, 11, 33.2042, 0.4479],
  ['P9FR-TX-005', 'P9FE', 'P9FSA2', 'P9FR-D02', 'P9FR-F04', 'Faulty', 500, 33, 33.2160, 0.4380],
  ['P9FR-TX-006', 'P9FE', 'P9FSA2', 'P9FR-D02', 'P9FR-F03', 'Under Maintenance', 250, 11, 33.1910, 0.4550],
  ['P9FR-TX-007', 'P9FW', 'P9FSA3', 'P9FR-D03', 'P9FR-F05', 'Active', 100, 11, 30.6545, -0.6072],
  ['P9FR-TX-008', 'P9FW', 'P9FSA3', 'P9FR-D03', 'P9FR-F05', 'Faulty', 315, 11, 30.6680, -0.6150],
  ['P9FR-TX-009', 'P9FW', 'P9FSA3', 'P9FR-D03', 'P9FR-F05', 'Decommissioned', 50, 11, 30.6410, -0.5980],
  ['P9FR-TX-010', 'P9FC', 'P9FSA4', 'P9FR-D04', 'P9FR-F06', 'Active', 160, 11, 32.7553, 0.3533],
  ['P9FR-TX-011', 'P9FC', 'P9FSA4', 'P9FR-D04', 'P9FR-F06', 'Under Maintenance', 200, 11, 32.7700, 0.3610],
  ['P9FR-TX-012', 'P9FC', 'P9FSA4', 'P9FR-D04', 'P9FR-F06', 'Active', 250, 11, 32.7420, 0.3460],
  ['P9FR-TX-013', 'P9FE', 'P9FSA5', 'P9FR-D05', 'P9FR-F07', 'Active', 500, 33, 34.1750, 1.0821],
  ['P9FR-TX-014', 'P9FE', 'P9FSA5', 'P9FR-D05', 'P9FR-F07', 'Active', 630, 33, 34.1870, 1.0710],
  ['P9FR-TX-015', 'P9FE', 'P9FSA5', 'P9FR-D05', 'P9FR-F07', 'Unverified', 1000, 33, 34.1600, 1.0940]
];

const TRANSFORMER_SPECS = freezeSpecs(transformerRows.map((row, index) => ({
  asset_id: row[0], territoryCode: row[1], serviceAreaCode: row[2], districtCode: row[3],
  feederCode: row[4], operational_status: row[5], kva_rating: row[6], network_voltage_kv: row[7],
  longitude: row[8], latitude: row[9], manufacturer: ['ABB', 'Siemens', 'TBEA', 'Elsewedy'][index % 4],
  year_manufactured: 2010 + (index % 13), site_number: index + 1
})));

const inspectionRows = [
  ['001', '001', 'technician1@phase9f.io', -180, 'Fair', 'Monitor', 56],
  ['002', '001', 'supervisor.north@phase9f.io', -120, 'Fair', 'Schedule Maintenance', 62],
  ['003', '002', 'technician1@phase9f.io', -8, 'Critical', 'Urgent Repair', 96],
  ['004', '003', 'supervisor.north@phase9f.io', -105, 'Good', 'Monitor', 48],
  ['005', '004', 'technician2@phase9f.io', -95, 'Fair', 'Monitor', 61],
  ['006', '005', 'supervisor.south@phase9f.io', -5, 'Poor', 'Urgent Repair', 89],
  ['007', '006', 'technician2@phase9f.io', -14, 'Fair', 'Schedule Maintenance', 73],
  ['008', '007', 'technician3@phase9f.io', -140, 'Fair', 'Monitor', 52],
  ['009', '008', 'technician3@phase9f.io', -3, 'Critical', 'Replace', 100],
  ['010', '009', 'technician3@phase9f.io', -300, 'Poor', 'Replace', 20],
  ['011', '010', 'technician4@phase9f.io', -22, 'Good', 'No Action', 45],
  ['012', '011', 'technician4@phase9f.io', -10, 'Fair', 'Schedule Maintenance', 71],
  ['013', '012', 'technician4@phase9f.io', -35, 'Good', 'No Action', 54],
  ['014', '013', 'technician5@phase9f.io', -16, 'Good', 'No Action', 49],
  ['015', '014', 'technician5@phase9f.io', -6, 'Fair', 'Monitor', 68],
  ['016', '015', 'technician5@phase9f.io', -45, 'Fair', 'Monitor', 42],
  ['017', '002', 'supervisor.north@phase9f.io', -40, 'Poor', 'Schedule Maintenance', 84],
  ['018', '005', 'supervisor.south@phase9f.io', -50, 'Fair', 'Monitor', 75],
  ['019', '010', 'supervisor.north@phase9f.io', -70, 'Good', 'No Action', 43],
  ['020', '013', 'supervisor.south@phase9f.io', -60, 'Good', 'No Action', 47]
];

const INSPECTION_SPECS = freezeSpecs(inspectionRows.map((row) => ({
  key: `P9FR-INS-${row[0]}`, transformerAssetId: `P9FR-TX-${row[1]}`,
  inspectorEmail: row[2], inspectionDayOffset: row[3], condition: row[4],
  recommended_action: row[5], load_percentage: row[6]
})));

const FAULT_SPECS = freezeSpecs([
  { key: 'P9FR-FLT-001', transformerAssetId: 'P9FR-TX-002', reporterEmail: 'technician1@phase9f.io', assigneeEmail: null, status: 'Open', severity: 'Critical', type: 'Complete Failure', faultDayOffset: -2 },
  { key: 'P9FR-FLT-002', transformerAssetId: 'P9FR-TX-005', reporterEmail: 'technician2@phase9f.io', assigneeEmail: 'technician2@phase9f.io', status: 'Assigned', severity: 'Major', type: 'Oil Leak', faultDayOffset: -4 },
  { key: 'P9FR-FLT-003', transformerAssetId: 'P9FR-TX-008', reporterEmail: 'technician3@phase9f.io', assigneeEmail: 'technician3@phase9f.io', status: 'In Progress', severity: 'Complete Outage', type: 'HV Side Fault', faultDayOffset: -1 },
  { key: 'P9FR-FLT-004', transformerAssetId: 'P9FR-TX-011', reporterEmail: 'technician4@phase9f.io', assigneeEmail: 'technician4@phase9f.io', status: 'Open', severity: 'Minor', type: 'Other', faultDayOffset: -7 },
  { key: 'P9FR-FLT-005', transformerAssetId: 'P9FR-TX-001', reporterEmail: 'supervisor.north@phase9f.io', assigneeEmail: 'technician1@phase9f.io', resolverEmail: 'technician1@phase9f.io', status: 'Resolved', severity: 'Minor', type: 'LV Side Fault', faultDayOffset: -35, resolvedDayOffset: -34 },
  { key: 'P9FR-FLT-006', transformerAssetId: 'P9FR-TX-004', reporterEmail: 'supervisor.south@phase9f.io', assigneeEmail: 'technician2@phase9f.io', resolverEmail: 'technician2@phase9f.io', status: 'Resolved', severity: 'Major', type: 'Bushing Failure', faultDayOffset: -80, resolvedDayOffset: -78 },
  { key: 'P9FR-FLT-007', transformerAssetId: 'P9FR-TX-007', reporterEmail: 'technician3@phase9f.io', assigneeEmail: 'technician3@phase9f.io', resolverEmail: 'technician3@phase9f.io', status: 'Closed', severity: 'Minor', type: 'Vandalism', faultDayOffset: -120, resolvedDayOffset: -118 }
]);

const MAINTENANCE_SPECS = freezeSpecs([
  { work_order_number: 'P9FR-WO-001', transformerAssetId: 'P9FR-TX-001', technicianEmail: 'technician1@phase9f.io', type: 'Preventive', maintenanceDayOffset: -30, nextDayOffset: 5 },
  { work_order_number: 'P9FR-WO-002', transformerAssetId: 'P9FR-TX-006', technicianEmail: 'technician2@phase9f.io', type: 'Corrective', maintenanceDayOffset: -6, nextDayOffset: 12 },
  { work_order_number: 'P9FR-WO-003', transformerAssetId: 'P9FR-TX-008', technicianEmail: 'technician3@phase9f.io', type: 'Emergency', maintenanceDayOffset: -3, nextDayOffset: 28 },
  { work_order_number: 'P9FR-WO-004', transformerAssetId: 'P9FR-TX-010', technicianEmail: 'technician4@phase9f.io', type: 'Preventive', maintenanceDayOffset: -190, nextDayOffset: -10 },
  { work_order_number: 'P9FR-WO-005', transformerAssetId: 'P9FR-TX-011', technicianEmail: 'technician4@phase9f.io', type: 'Corrective', maintenanceDayOffset: -2, nextDayOffset: 45 },
  { work_order_number: 'P9FR-WO-006', transformerAssetId: 'P9FR-TX-013', technicianEmail: 'technician5@phase9f.io', type: 'Preventive', maintenanceDayOffset: -60, nextDayOffset: null },
  { work_order_number: 'P9FR-WO-007', transformerAssetId: 'P9FR-TX-014', technicianEmail: 'technician5@phase9f.io', type: 'Preventive', maintenanceDayOffset: -20, nextDayOffset: 20 },
  { work_order_number: 'P9FR-WO-008', transformerAssetId: 'P9FR-TX-004', technicianEmail: 'technician2@phase9f.io', type: 'Corrective', maintenanceDayOffset: -90, nextDayOffset: -35 }
]);

function getMongoUri(env = process.env) {
  const value = env[REQUIRED_ENV_VAR];
  if (!value || !value.trim()) {
    throw new Error(`${REQUIRED_ENV_VAR} is required. Refusing to run without an explicit database target.`);
  }
  return value.trim();
}

function utcDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid seed anchor date is required.');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(anchor, offset) {
  const result = new Date(anchor.getTime());
  result.setUTCDate(result.getUTCDate() + offset);
  return result;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeErrorMessage(error, secret = process.env[REQUIRED_ENV_VAR]) {
  const message = error?.message || String(error);
  const normalized = typeof secret === 'string' ? secret.trim() : '';
  return normalized ? message.split(normalized).join('[REDACTED]') : message;
}

function getPath(value, path) {
  if (value && typeof value.get === 'function') return value.get(path);
  return path.split('.').reduce((current, part) => current?.[part], value);
}

function setPath(target, path, value) {
  if (target && typeof target.set === 'function') {
    target.set(path, value);
    return;
  }
  const parts = path.split('.');
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!current[parts[index]] || typeof current[parts[index]] !== 'object') {
      current[parts[index]] = {};
    }
    current = current[parts[index]];
  }
  current[parts.at(-1)] = value;
}

function normalizedValue(value) {
  if (value === undefined || value === null) return value;
  if (value instanceof Date) return { $date: value.getTime() };
  if (value instanceof mongoose.Types.ObjectId) return { $oid: String(value) };
  if (Array.isArray(value)) return value.map(normalizedValue);
  if (typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = normalizedValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(normalizedValue(left)) === JSON.stringify(normalizedValue(right));
}

function canonicalMarker(kind, key) {
  return `Phase 9F Railway Demo [${key}]`;
}

function exactMarkerRegex(kind, key) {
  const marker = canonicalMarker(kind, key);
  return new RegExp(`^${escapeRegex(marker)}(?:\\s|$)`);
}

function mergeNarrativeForReconcile(current, desired) {
  if (!current || typeof current !== 'string') return desired;
  const closing = desired.indexOf(']');
  const marker = desired.slice(0, closing + 1);
  if (!current.startsWith(marker)) return desired;
  const newline = current.indexOf('\n');
  return newline === -1 ? desired : `${desired}${current.slice(newline)}`;
}

function groupBy(items, field) {
  const groups = new Map();
  for (const item of items) {
    const key = String(item[field]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function makeFailure(key, message) {
  return { key, status: 'FAILED', message };
}

function referenceAssignmentsEqual(user, spec, territoriesByCode, serviceAreasByCode) {
  const keys = spec.referenceKeys || {};
  const expectedTerritory = keys.territoryCode ? territoriesByCode.get(keys.territoryCode)?._id : undefined;
  const expectedServiceArea = keys.serviceAreaCode ? serviceAreasByCode.get(keys.serviceAreaCode)?._id : undefined;
  return valuesEqual(user.territory_id, expectedTerritory)
    && valuesEqual(user.service_area_id, expectedServiceArea);
}

async function loadDependencies() {
  const territoryCodes = TERRITORY_SPECS.map((spec) => spec.code);
  const serviceAreaCodes = SERVICE_AREA_SPECS.map((spec) => spec.code);
  const emails = DEMO_USER_SPECS.map((spec) => spec.email);
  const [territories, serviceAreas, users] = await Promise.all([
    Territory.find({ code: { $in: territoryCodes } }).lean(),
    ServiceArea.find({ code: { $in: serviceAreaCodes } }).lean(),
    User.find({ email: { $in: emails } }).lean()
  ]);
  const territoryGroups = groupBy(territories, 'code');
  const serviceAreaGroups = groupBy(serviceAreas, 'code');
  const userGroups = groupBy(users, 'email');
  const failures = [];
  const territoriesByCode = new Map();
  const serviceAreasByCode = new Map();
  const usersByEmail = new Map();

  for (const spec of TERRITORY_SPECS) {
    const matches = territoryGroups.get(spec.code) || [];
    if (matches.length !== 1) {
      failures.push(makeFailure(spec.code, `Expected exactly one territory; found ${matches.length}`));
      continue;
    }
    if (matches[0].is_active !== true) {
      failures.push(makeFailure(spec.code, 'Required territory is inactive'));
      continue;
    }
    territoriesByCode.set(spec.code, matches[0]);
  }

  for (const spec of SERVICE_AREA_SPECS) {
    const matches = serviceAreaGroups.get(spec.code) || [];
    const territory = territoriesByCode.get(spec.territoryCode);
    if (matches.length !== 1) {
      failures.push(makeFailure(spec.code, `Expected exactly one service area; found ${matches.length}`));
      continue;
    }
    if (!territory || !valuesEqual(matches[0].territory_id, territory._id) || matches[0].is_active !== true) {
      failures.push(makeFailure(spec.code, 'Service area parent or active state is inconsistent'));
      continue;
    }
    serviceAreasByCode.set(spec.code, matches[0]);
  }

  for (const spec of DEMO_USER_SPECS) {
    const matches = userGroups.get(spec.email) || [];
    if (matches.length !== 1) {
      failures.push(makeFailure(spec.email, `Expected exactly one demo user; found ${matches.length}`));
      continue;
    }
    const user = matches[0];
    if (user.role !== spec.role || user.is_active !== spec.is_active) {
      failures.push(makeFailure(spec.email, 'Demo user role or active state differs from the approved intent'));
      continue;
    }
    if (!referenceAssignmentsEqual(user, spec, territoriesByCode, serviceAreasByCode)) {
      failures.push(makeFailure(spec.email, 'Demo user territory or service-area assignment is inconsistent'));
      continue;
    }
    usersByEmail.set(spec.email, user);
  }

  return { territoriesByCode, serviceAreasByCode, usersByEmail, failures };
}

async function loadCanonicalDocuments() {
  const [districts, feeders, transformers, inspections, faults, maintenances] = await Promise.all([
    District.find({
      $or: [
        { code: { $in: DISTRICT_SPECS.map((spec) => spec.code) } },
        { name: { $in: DISTRICT_SPECS.map((spec) => spec.name) } }
      ]
    }),
    Feeder.find({ code: { $in: FEEDER_SPECS.map((spec) => spec.code) } }),
    Transformer.find({ asset_id: { $in: TRANSFORMER_SPECS.map((spec) => spec.asset_id) } }),
    Inspection.find({ condition_narrative: /^Phase 9F Railway Demo \[P9FR-INS-/ }),
    Fault.find({ fault_description: /^Phase 9F Railway Demo \[P9FR-FLT-/ }),
    Maintenance.find({ work_order_number: { $in: MAINTENANCE_SPECS.map((spec) => spec.work_order_number) } })
  ]);
  return { districts, feeders, transformers, inspections, faults, maintenances };
}

function oneMatch(items, predicate, key, failures) {
  const matches = items.filter(predicate);
  if (matches.length > 1) failures.push(makeFailure(key, `Duplicate canonical matches found: ${matches.length}`));
  return matches.length === 1 ? matches[0] : null;
}

function inspectionDesired(spec, transformer, user, anchorDate) {
  const poor = ['Poor', 'Critical'].includes(spec.condition);
  const critical = spec.condition === 'Critical';
  const narrative = `${canonicalMarker('inspection', spec.key)} ${spec.condition} condition; recommended action: ${spec.recommended_action}.`;
  const longitude = transformer.gps.coordinates[0];
  const latitude = transformer.gps.coordinates[1];
  return {
    transformer_id: transformer._id,
    inspector_id: user._id,
    inspection_date: addUtcDays(anchorDate, spec.inspectionDayOffset),
    visit_type: spec.key.endsWith('002') ? 'Follow-up' : 'Routine Inspection',
    gps_at_inspection: { type: 'Point', coordinates: [longitude, latitude] },
    gps_accuracy: 4 + Number(spec.key.slice(-1)),
    network_voltage_confirmed: true,
    kva_rating_confirmed: true,
    rating_discrepancy_flag: false,
    rating_discrepancy_details: null,
    physical: {
      overall_condition: spec.condition,
      rust_corrosion: critical ? 'Severe' : poor ? 'Minor' : 'None',
      oil_leakage: critical ? 'Active Leak' : poor ? 'Slow Drip' : 'None',
      bushing_condition: critical ? 'Cracked' : 'Good',
      tank_body_damage: critical ? 'Dents' : 'None',
      cooling_fins_condition: poor ? 'Damaged' : 'Good',
      sound_level: critical ? 'Loud' : poor ? 'Unusual' : 'Normal',
      temperature: 48 + Math.round(spec.load_percentage / 5)
    },
    oil_breather: {
      oil_level: critical ? 'Very Low' : poor ? 'Low' : 'Adequate',
      silica_gel_color: poor ? 'Pink' : 'Blue',
      oil_test_required: poor,
      oil_test_notes: poor ? 'Demo oil sample recommended.' : null,
      oil_temperature: 45 + Math.round(spec.load_percentage / 6)
    },
    electrical: {
      load_current_a: spec.load_percentage * 1.7,
      load_current_b: spec.load_percentage * 1.68,
      load_current_c: spec.load_percentage * 1.72,
      voltage_hv_side: transformer.network_voltage_kv * 1000,
      voltage_lv_side: 415,
      load_percentage: spec.load_percentage,
      overload_flag: spec.load_percentage > 90,
      power_factor: spec.load_percentage > 90 ? 0.82 : 0.91,
      frequency: 50
    },
    site_safety: {
      security_fencing: poor ? 'Damaged' : 'Present',
      earthing: 'Present',
      warning_signs: critical ? 'Absent' : 'Present',
      vegetation_encroachment: poor ? 'Moderate' : 'None',
      unauthorised_connections: false,
      safety_notes: critical ? 'Demo safety controls require urgent attention.' : null
    },
    condition_narrative: narrative,
    recommended_action: spec.recommended_action,
    recommended_action_details: `${spec.recommended_action} for fictional preview asset ${spec.transformerAssetId}.`,
    sync_status: 'synced',
    sync_version: 1,
    is_deleted: false,
    deleted_at: null
  };
}

function transformerDesired(spec, dependencies, resolved, anchorDate) {
  const territory = dependencies.territoriesByCode.get(spec.territoryCode);
  const serviceArea = dependencies.serviceAreasByCode.get(spec.serviceAreaCode);
  const district = resolved.districtsByCode.get(spec.districtCode);
  const feeder = resolved.feedersByCode.get(spec.feederCode);
  const superAdmin = dependencies.usersByEmail.get('super.admin@phase9f.io');
  const transformerInspections = INSPECTION_SPECS.filter((item) => item.transformerAssetId === spec.asset_id);
  const latestInspection = transformerInspections.reduce((latest, item) =>
    (!latest || item.inspectionDayOffset > latest.inspectionDayOffset ? item : latest), null);
  const transformerMaintenance = MAINTENANCE_SPECS.filter((item) => item.transformerAssetId === spec.asset_id);
  const latestMaintenance = transformerMaintenance.reduce((latest, item) =>
    (!latest || item.maintenanceDayOffset > latest.maintenanceDayOffset ? item : latest), null);
  const openFault = FAULT_SPECS.some((item) => item.transformerAssetId === spec.asset_id
    && ['Open', 'Assigned', 'In Progress'].includes(item.status));
  const installYear = 2011 + (spec.site_number % 10);
  return {
    asset_id: spec.asset_id,
    uedcl_reference: `P9F-RAILWAY-DEMO-${String(spec.site_number).padStart(3, '0')}`,
    manufacturer: spec.manufacturer,
    serial_number: `P9FR-SN-${String(spec.site_number).padStart(4, '0')}`,
    year_manufactured: spec.year_manufactured,
    record_status: spec.operational_status === 'Unverified' ? 'Draft' : 'Active',
    kva_rating: spec.kva_rating,
    network_voltage_kv: spec.network_voltage_kv,
    display_rating: `${spec.kva_rating}kVA/${spec.network_voltage_kv}kV`,
    voltage_secondary: '415V',
    phase_type: 'Three Phase',
    cooling_type: spec.kva_rating >= 500 ? 'ONAF' : 'ONAN',
    mounting_type: spec.kva_rating >= 500 ? 'Plinth' : 'Pole Mounted',
    vector_group: 'Dyn11',
    location_operational: {
      territory_id: territory._id,
      territory_name: territory.name,
      service_area_id: serviceArea._id,
      service_area_name: serviceArea.name,
      feeder_id: feeder._id,
      feeder_name: feeder.name,
      feeder_code: feeder.code,
      substation_name: `${serviceArea.location_town || serviceArea.name} Demo Substation`
    },
    location_administrative: {
      district_id: district._id,
      district_name: district.name,
      sub_county: `${serviceArea.location_town || 'Phase 9F'} Central`,
      parish: `Demo Parish ${spec.site_number}`,
      village: `Demo Village ${spec.site_number}`,
      site_name: `Phase 9F Railway Demo Site ${String(spec.site_number).padStart(2, '0')}`
    },
    gps: {
      type: 'Point', coordinates: [spec.longitude, spec.latitude], method: 'Estimated',
      accuracy_metres: 8 + spec.site_number,
      captured_at: new Date(Date.UTC(2025, (spec.site_number - 1) % 12, 1))
    },
    installation: {
      install_date: new Date(Date.UTC(installYear, 0, 15)),
      installing_contractor: 'Phase 9F Railway Demo Energy Services',
      commissioned_by: 'Phase 9F Demo Commissioning Team',
      commissioning_date: new Date(Date.UTC(installYear, 0, 20)),
      warranty_expiry: new Date(Date.UTC(installYear + 5, 0, 20))
    },
    operational_status: spec.operational_status,
    has_open_fault: openFault,
    last_inspection_date: latestInspection ? addUtcDays(anchorDate, latestInspection.inspectionDayOffset) : null,
    last_maintenance_date: latestMaintenance ? addUtcDays(anchorDate, latestMaintenance.maintenanceDayOffset) : null,
    last_load_reading_date: latestInspection ? addUtcDays(anchorDate, latestInspection.inspectionDayOffset) : null,
    last_load_percentage: latestInspection?.load_percentage ?? null,
    overdue_inspection_flag: spec.operational_status !== 'Decommissioned'
      && (!latestInspection || latestInspection.inspectionDayOffset < -90),
    is_deleted: false,
    deleted_at: null,
    created_by: superAdmin._id,
    updated_by: superAdmin._id
  };
}

function faultDesired(spec, transformer, inspection, dependencies, anchorDate) {
  const reportedBy = dependencies.usersByEmail.get(spec.reporterEmail);
  const assignedTo = spec.assigneeEmail ? dependencies.usersByEmail.get(spec.assigneeEmail) : null;
  const resolvedBy = spec.resolverEmail ? dependencies.usersByEmail.get(spec.resolverEmail) : null;
  const resolvedDate = spec.resolvedDayOffset == null ? null : addUtcDays(anchorDate, spec.resolvedDayOffset);
  const faultDate = addUtcDays(anchorDate, spec.faultDayOffset);
  return {
    transformer_id: transformer._id,
    inspection_id: inspection?._id || null,
    reported_by: reportedBy._id,
    fault_date: faultDate,
    fault_source: 'Field Observation',
    fault_description: `${canonicalMarker('fault', spec.key)} ${spec.type} on fictional preview asset ${spec.transformerAssetId}.`,
    fault_type: spec.type,
    severity: spec.severity,
    network_voltage_kv: transformer.network_voltage_kv,
    customers_affected: spec.severity === 'Complete Outage' ? 420 : spec.severity === 'Critical' ? 250 : 65,
    area_affected: transformer.location_administrative.site_name,
    fault_status: spec.status,
    assigned_to: assignedTo?._id || null,
    date_assigned: assignedTo ? addUtcDays(anchorDate, spec.faultDayOffset + 1) : null,
    target_resolution_date: ['Open', 'Assigned', 'In Progress'].includes(spec.status)
      ? addUtcDays(anchorDate, spec.faultDayOffset + 7) : null,
    resolved_date: resolvedDate,
    resolution_description: resolvedDate ? 'Fictional demo fault repaired and verified.' : null,
    root_cause: resolvedDate ? 'Phase 9F demo wear condition.' : null,
    parts_replaced: resolvedDate ? 'Demo fuse assembly' : null,
    downtime_hours: resolvedDate ? Math.round((resolvedDate - faultDate) / 3600000) : null,
    resolved_by: resolvedBy?._id || null
  };
}

function maintenanceDesired(spec, transformer, user, anchorDate) {
  const index = Number(spec.work_order_number.slice(-3));
  return {
    transformer_id: transformer._id,
    technician_id: user._id,
    maintenance_date: addUtcDays(anchorDate, spec.maintenanceDayOffset),
    maintenance_type: spec.type,
    team_contractor: 'Phase 9F Railway Demo Maintenance Team',
    supervised_by: 'Phase 9F Demo Operations Supervisor',
    work_order_number: spec.work_order_number,
    work_performed: {
      oil_top_up: { performed: index % 2 === 0, litres_added: index % 2 === 0 ? 8 + index : 0 },
      oil_replacement: index === 3,
      oil_filtration: index % 3 === 0,
      silica_gel_replaced: true,
      bushing_replacement: spec.type === 'Emergency',
      tap_changer_service: index % 2 === 1,
      cooling_system_service: index % 3 === 1,
      physical_cleaning: true,
      painting: index === 4,
      earthing_repair: index === 5,
      other_work: `Fictional demo work package ${index}.`
    },
    pre_maintenance_load: { phase_a: 80 + index, phase_b: 78 + index, phase_c: 82 + index },
    pre_maintenance_notes: `Phase 9F demo pre-maintenance assessment ${index}.`,
    post_condition_narrative: `Phase 9F demo maintenance ${spec.work_order_number} completed for browsing.`,
    post_maintenance_load: { phase_a: 72 + index, phase_b: 71 + index, phase_c: 73 + index },
    post_maintenance_readings: { voltage_hv: transformer.network_voltage_kv * 1000, voltage_lv: 415, oil_temperature: 52, ambient_temperature: 27 },
    completed_by: user.name,
    reviewed_by: 'Phase 9F Demo Operations Supervisor',
    reviewed_at: addUtcDays(anchorDate, spec.maintenanceDayOffset + 1),
    review_notes: 'Fictional preview work reviewed.',
    next_maintenance_date: spec.nextDayOffset == null ? null : addUtcDays(anchorDate, spec.nextDayOffset),
    next_maintenance_notes: spec.nextDayOffset == null ? null : 'Phase 9F demo follow-up window.',
    total_cost: 250000 + index * 75000,
    parts_cost: 50000 + index * 10000,
    labour_cost: 200000 + index * 65000,
    sync_status: 'synced',
    sync_version: 1,
    is_deleted: false,
    deleted_at: null
  };
}

function buildEntry(modelName, Model, key, document, desired) {
  return {
    modelName, Model, key, document, desired,
    plannedId: document?._id || new mongoose.Types.ObjectId(),
    ownedFields: OWNED_FIELDS[modelName]
  };
}

async function buildExecutionPlan({ anchorDate = new Date() } = {}) {
  const anchor = utcDay(anchorDate);
  const dependencies = await loadDependencies();
  if (dependencies.failures.length > 0) {
    return { entries: [], failures: dependencies.failures, dependencies, anchorDate: anchor };
  }
  const canonical = await loadCanonicalDocuments();
  const failures = [];
  const entries = [];
  const resolved = {
    districtsByCode: new Map(), feedersByCode: new Map(), transformersByAssetId: new Map(),
    inspectionsByKey: new Map()
  };

  for (const spec of DISTRICT_SPECS) {
    const document = oneMatch(canonical.districts, (item) => item.code === spec.code, spec.code, failures);
    const nameConflicts = canonical.districts.filter((item) => item.name === spec.name && item.code !== spec.code);
    if (nameConflicts.length > 0) {
      failures.push(makeFailure(spec.code, `District name is already owned by another code: ${spec.name}`));
    }
    const entry = buildEntry('District', District, spec.code, document, { ...spec });
    entries.push(entry);
    resolved.districtsByCode.set(spec.code, document || { _id: entry.plannedId, ...spec });
  }

  for (const spec of FEEDER_SPECS) {
    const document = oneMatch(canonical.feeders, (item) => item.code === spec.code, spec.code, failures);
    const serviceArea = dependencies.serviceAreasByCode.get(spec.serviceAreaCode);
    if (document && !valuesEqual(document.service_area_id, serviceArea._id)) {
      failures.push(makeFailure(spec.code, 'Canonical feeder exists under a different service area'));
    }
    const desired = {
      service_area_id: serviceArea._id, name: spec.name, code: spec.code,
      network_voltage_kv: spec.network_voltage_kv, is_active: spec.is_active
    };
    const entry = buildEntry('Feeder', Feeder, spec.code, document, desired);
    entries.push(entry);
    resolved.feedersByCode.set(spec.code, document || { _id: entry.plannedId, ...desired });
  }

  for (const spec of TRANSFORMER_SPECS) {
    const document = oneMatch(canonical.transformers, (item) => item.asset_id === spec.asset_id, spec.asset_id, failures);
    const desired = transformerDesired(spec, dependencies, resolved, anchor);
    const entry = buildEntry('Transformer', Transformer, spec.asset_id, document, desired);
    entries.push(entry);
    resolved.transformersByAssetId.set(spec.asset_id, document || { _id: entry.plannedId, ...desired });
  }

  for (const spec of INSPECTION_SPECS) {
    const matcher = exactMarkerRegex('inspection', spec.key);
    const document = oneMatch(canonical.inspections, (item) => matcher.test(item.condition_narrative || ''), spec.key, failures);
    const transformer = resolved.transformersByAssetId.get(spec.transformerAssetId);
    const user = dependencies.usersByEmail.get(spec.inspectorEmail);
    if (!transformer || !user || user.is_active !== true) {
      failures.push(makeFailure(spec.key, 'Inspection transformer or active inspector dependency is unavailable'));
      continue;
    }
    const desired = inspectionDesired(spec, transformer, user, anchor);
    const entry = buildEntry('Inspection', Inspection, spec.key, document, desired);
    entries.push(entry);
    resolved.inspectionsByKey.set(spec.key, document || { _id: entry.plannedId, ...desired });
  }

  for (const spec of FAULT_SPECS) {
    const matcher = exactMarkerRegex('fault', spec.key);
    const document = oneMatch(canonical.faults, (item) => matcher.test(item.fault_description || ''), spec.key, failures);
    const transformer = resolved.transformersByAssetId.get(spec.transformerAssetId);
    const inspectionSpec = INSPECTION_SPECS.find((item) => item.transformerAssetId === spec.transformerAssetId);
    const inspection = inspectionSpec ? resolved.inspectionsByKey.get(inspectionSpec.key) : null;
    const requiredEmails = [spec.reporterEmail, spec.assigneeEmail, spec.resolverEmail].filter(Boolean);
    if (!transformer || requiredEmails.some((email) => !dependencies.usersByEmail.get(email)?.is_active)) {
      failures.push(makeFailure(spec.key, 'Fault transformer or active user dependency is unavailable'));
      continue;
    }
    entries.push(buildEntry('Fault', Fault, spec.key, document,
      faultDesired(spec, transformer, inspection, dependencies, anchor)));
  }

  for (const spec of MAINTENANCE_SPECS) {
    const document = oneMatch(canonical.maintenances,
      (item) => item.work_order_number === spec.work_order_number,
      spec.work_order_number, failures);
    const transformer = resolved.transformersByAssetId.get(spec.transformerAssetId);
    const user = dependencies.usersByEmail.get(spec.technicianEmail);
    if (!transformer || !user?.is_active) {
      failures.push(makeFailure(spec.work_order_number, 'Maintenance transformer or active technician dependency is unavailable'));
      continue;
    }
    entries.push(buildEntry('Maintenance', Maintenance, spec.work_order_number, document,
      maintenanceDesired(spec, transformer, user, anchor)));
  }

  failures.push(...await validatePlannedEntries(entries));
  return { entries, failures, dependencies, anchorDate: anchor };
}

function targetValue(entry, path) {
  const desired = getPath(entry.desired, path);
  if (!entry.document || !['condition_narrative', 'fault_description'].includes(path)) return desired;
  return mergeNarrativeForReconcile(getPath(entry.document, path), desired);
}

function changedPaths(entry) {
  if (!entry.document) return [...entry.ownedFields];
  const ignored = entry.modelName === 'Transformer' ? new Set(['created_by', 'updated_by']) : new Set();
  return entry.ownedFields.filter((path) => !ignored.has(path)
    && !valuesEqual(getPath(entry.document, path), targetValue(entry, path)));
}

async function validatePlannedEntries(entries) {
  const failures = [];
  for (const entry of entries) {
    const candidate = entry.document
      ? new entry.Model(entry.document.toObject({ depopulate: true }))
      : new entry.Model({ _id: entry.plannedId, ...entry.desired });
    if (entry.document) {
      for (const path of changedPaths(entry)) setPath(candidate, path, targetValue(entry, path));
    }
    try {
      await candidate.validate();
    } catch (validationError) {
      failures.push(makeFailure(entry.key,
        `${entry.modelName} candidate validation failed: ${validationError.message}`));
    }
  }
  return failures;
}

function plannedStatus(entry, dryRun) {
  const changed = changedPaths(entry);
  if (!entry.document) return dryRun ? 'WOULD_CREATE' : 'CREATED';
  if (changed.length > 0) return dryRun ? 'WOULD_UPDATE' : 'UPDATED';
  return dryRun ? 'WOULD_SKIP' : 'SKIPPED';
}

async function reconcileEntry(entry) {
  if (!entry.document) {
    const document = new entry.Model({ _id: entry.plannedId, ...entry.desired });
    await document.save();
    return { key: entry.key, model: entry.modelName, status: 'CREATED' };
  }
  const paths = changedPaths(entry);
  if (paths.length === 0) return { key: entry.key, model: entry.modelName, status: 'SKIPPED' };
  for (const path of paths) setPath(entry.document, path, targetValue(entry, path));
  if (entry.modelName === 'Transformer') entry.document.set('updated_by', entry.desired.updated_by);
  await entry.document.save();
  return { key: entry.key, model: entry.modelName, status: 'UPDATED' };
}

function summarize(results, dryRun = false) {
  const summary = dryRun
    ? { WOULD_CREATE: 0, WOULD_UPDATE: 0, WOULD_SKIP: 0, FAILED: 0 }
    : { CREATED: 0, UPDATED: 0, SKIPPED: 0, FAILED: 0 };
  for (const result of results) summary[result.status] += 1;
  return summary;
}

function printResults(results, summary, dryRun = false) {
  console.log(dryRun ? 'Operational demo seed dry-run:' : 'Operational demo seed:');
  for (const result of results) {
    const suffix = result.message ? ` ${result.message}` : '';
    console.log(`${result.status} ${result.model || 'Preflight'} ${result.key}${suffix}`);
  }
  console.log('Operational demo seed summary:');
  console.log(Object.entries(summary).map(([key, value]) => `${key}=${value}`).join(' '));
}

function connectionOptions(dryRun) {
  return dryRun ? { autoIndex: false, autoCreate: false } : {};
}

async function connectForSeed(uri, { dryRun = false } = {}) {
  if (mongoose.connection.readyState !== 0) return;
  await mongoose.connect(uri, connectionOptions(dryRun));
}

async function seedRailwayPhase9FOperationalData(options = {}) {
  const {
    dryRun = false, print = true, connect = true, anchorDate = new Date(), env = process.env
  } = options;
  const mongoUri = getMongoUri(env);
  if (connect) await connectForSeed(mongoUri, { dryRun });
  const plan = await buildExecutionPlan({ anchorDate });
  let results;
  if (plan.failures.length > 0) {
    results = plan.failures;
  } else if (dryRun) {
    results = plan.entries.map((entry) => ({
      key: entry.key, model: entry.modelName, status: plannedStatus(entry, true)
    }));
  } else {
    results = [];
    let halted = false;
    for (const entry of plan.entries) {
      if (halted) {
        results.push(makeFailure(entry.key, 'Not attempted after an earlier reconciliation failure'));
        continue;
      }
      try {
        results.push(await reconcileEntry(entry));
      } catch (error) {
        results.push({
          key: entry.key, model: entry.modelName, status: 'FAILED',
          message: safeErrorMessage(error, mongoUri)
        });
        halted = true;
      }
    }
  }
  const summary = summarize(results, dryRun);
  const exitCode = summary.FAILED > 0 ? 1 : 0;
  if (print) printResults(results, summary, dryRun);
  return { results, summary, exitCode, anchorDate: plan.anchorDate };
}

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  try {
    const result = await seedRailwayPhase9FOperationalData({ dryRun });
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main();

module.exports = {
  OWNED_FIELDS,
  DISTRICT_SPECS,
  FEEDER_SPECS,
  TRANSFORMER_SPECS,
  INSPECTION_SPECS,
  FAULT_SPECS,
  MAINTENANCE_SPECS,
  getMongoUri,
  utcDay,
  addUtcDays,
  escapeRegex,
  mergeNarrativeForReconcile,
  safeErrorMessage,
  getPath,
  setPath,
  valuesEqual,
  exactMarkerRegex,
  loadDependencies,
  buildExecutionPlan,
  validatePlannedEntries,
  summarize,
  connectionOptions,
  connectForSeed,
  seedRailwayPhase9FOperationalData
};
