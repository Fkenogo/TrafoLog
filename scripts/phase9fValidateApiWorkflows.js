/**
 * Phase 9F API workflow validation runner.
 *
 * Runs customer-like workflows against the Express app using the seeded Phase 9F
 * accounts/data. It records evidence rather than fixing bugs.
 */
const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');
require('dotenv').config();

const app = require('../src/app');
const database = require('../src/config/database');
const redis = require('../src/config/redis');
const User = require('../src/models/User');
const Transformer = require('../src/models/Transformer');
const Territory = require('../src/models/Territory');
const ServiceArea = require('../src/models/ServiceArea');
const Feeder = require('../src/models/Feeder');
const District = require('../src/models/District');

const ARTIFACT_DIR = path.resolve(__dirname, '../docs/superpowers/reports/phase9f-validation-artifacts');
const PASSWORD = 'Phase9F@1234';

const result = {
  generated_at: new Date().toISOString(),
  summary: {
    passed: 0,
    failed: 0,
    skipped: 0
  },
  timings_ms: {},
  workflows: [],
  bugs: [],
  gaps: [],
  created_records: {}
};

let tokens = {};
let refreshToken;

function token(name) {
  return tokens[name];
}

function authed(method, url, tokenName = 'admin') {
  return request(app.getApp())[method](url).set('Authorization', `Bearer ${token(tokenName)}`);
}

function recordBug({ severity, workflow, steps, expected, actual, suggested_fix }) {
  result.bugs.push({ severity, workflow, steps, expected, actual, suggested_fix });
}

function recordGap(workflow, reason) {
  result.gaps.push({ workflow, reason });
}

function getData(res) {
  return res.body?.data;
}

async function step(workflow, name, fn, expectedStatuses = [200]) {
  const started = performance.now();
  try {
    const res = await fn();
    const elapsed = Math.round(performance.now() - started);
    result.timings_ms[`${workflow}: ${name}`] = elapsed;
    const ok = expectedStatuses.includes(res.statusCode);
    result.workflows.push({
      workflow,
      name,
      status: ok ? 'passed' : 'failed',
      http_status: res.statusCode,
      elapsed_ms: elapsed,
      message: res.body?.message || res.text?.slice(0, 160) || ''
    });
    if (ok) {
      result.summary.passed += 1;
    } else {
      result.summary.failed += 1;
      recordBug({
        severity: res.statusCode >= 500 ? 'Critical' : 'High',
        workflow: `${workflow}: ${name}`,
        steps: [`Run API validation step ${workflow}: ${name}`],
        expected: `HTTP ${expectedStatuses.join(' or ')}`,
        actual: `HTTP ${res.statusCode}: ${res.body?.message || res.text?.slice(0, 200)}`,
        suggested_fix: 'Inspect controller/service contract for this endpoint and align the frontend workflow with the tested backend response.'
      });
    }
    return res;
  } catch (error) {
    const elapsed = Math.round(performance.now() - started);
    result.timings_ms[`${workflow}: ${name}`] = elapsed;
    result.workflows.push({
      workflow,
      name,
      status: 'failed',
      elapsed_ms: elapsed,
      message: error.message
    });
    result.summary.failed += 1;
    recordBug({
      severity: 'Critical',
      workflow: `${workflow}: ${name}`,
      steps: [`Run API validation step ${workflow}: ${name}`],
      expected: 'Request completes without throwing',
      actual: error.message,
      suggested_fix: 'Check server logs, validation middleware, and test data assumptions for this workflow.'
    });
    return undefined;
  }
}

async function login(label, email) {
  const res = await step('Authentication', `Login ${label}`, () => request(app.getApp())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD }));
  if (res?.statusCode === 200) {
    tokens[label] = res.body.data.accessToken;
    if (label === 'admin') {
      const cookie = (res.headers['set-cookie'] || []).find((item) => item.startsWith('refreshToken='));
      refreshToken = cookie?.split('=')[1]?.split(';')[0];
    }
  }
  return res;
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await database.connect();
  await redis.connect();

  try {
    await login('admin', 'super.admin@phase9f.io');
    await login('viewer', 'viewer1@phase9f.io');
    await login('technician', 'technician1@phase9f.io');

    await step('Authentication', 'Invalid login is rejected', () => request(app.getApp())
      .post('/api/auth/login')
      .send({ email: 'super.admin@phase9f.io', password: 'WrongPassword@123' }), [401]);
    await step('Authentication', 'Refresh token', () => request(app.getApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`])
      .send({}));
    await step('Authentication', 'Invalid token is rejected', () => request(app.getApp())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.value'), [401]);
    await step('Authentication', 'Viewer RBAC blocks admin', () => authed('get', '/api/admin/system-stats', 'viewer'), [403]);
    await step('Environment', 'API version preflight', () => request(app.getApp()).get('/api/version'));

    const refs = {
      territory: await Territory.findOne({ code: 'P9FC' }),
      serviceArea: await ServiceArea.findOne({ code: 'P9FSA1' }),
      feeder: await Feeder.findOne({ code: 'P9FF01' }),
      district: await District.findOne({ code: 'P9FD1' }),
      technician: await User.findOne({ email: 'technician1@phase9f.io' })
    };

    await step('Dashboard', 'KPI dashboard loads', () => authed('get', '/api/dashboard/kpi'));
    await step('Dashboard', 'Transformer stats widget loads', () => authed('get', '/api/transformers/stats'));
    await step('Search and pagination', 'Transformer search returns paginated rows', () => authed('get', '/api/transformers?page=1&limit=10&search=P9F'));
    await step('Search and pagination', 'Fault status filter returns paginated rows', () => authed('get', '/api/faults?page=1&limit=10&status=Open'));
    await step('Search and pagination', 'Inspection pagination returns rows', () => authed('get', '/api/inspections?page=1&limit=10'));
    await step('Search and pagination', 'Maintenance pagination returns rows', () => authed('get', '/api/maintenance?page=1&limit=10'));

    const createTransformerRes = await step('Transformer lifecycle', 'Create transformer', () => authed('post', '/api/transformers').send({
      manufacturer: 'Phase 9F Validation Manufacturer',
      serial_number: `P9F-E2E-SN-${Date.now()}`,
      year_manufactured: 2024,
      kva_rating: 315,
      network_voltage_kv: 11,
      voltage_secondary: '415V',
      phase_type: 'Three Phase',
      cooling_type: 'ONAN',
      mounting_type: 'Pole Mounted',
      vector_group: 'DYN11',
      territory_id: refs.territory._id.toString(),
      service_area_id: refs.serviceArea._id.toString(),
      feeder_id: refs.feeder._id.toString(),
      district_id: refs.district._id.toString(),
      site_name: 'Phase 9F E2E Transformer Site',
      sub_county: 'Phase 9F Sub County',
      parish: 'Phase 9F Parish',
      village: 'Phase 9F Village',
      latitude: 0.36,
      longitude: 32.62,
      gps_method: 'Field Captured',
      gps_accuracy: 5,
      install_date: '2025-01-15'
    }), [201]);
    const createdTransformer = getData(createTransformerRes);
    const transformerId = createdTransformer?._id;
    result.created_records.transformer_id = transformerId;

    if (transformerId) {
      await step('Transformer lifecycle', 'View transformer detail', () => authed('get', `/api/transformers/${transformerId}`));
      await step('Transformer lifecycle', 'Edit transformer', () => authed('put', `/api/transformers/${transformerId}`).send({
        manufacturer: 'Phase 9F Updated Manufacturer',
        site_name: 'Phase 9F E2E Transformer Site Updated'
      }));
      await step('Transformer lifecycle', 'QR data loads', () => authed('get', `/api/transformers/${transformerId}/qr`));
      await step('Transformer lifecycle', 'Nearby search', () => authed('get', '/api/transformers/nearby?lat=0.36&lng=32.62&radius=10&limit=10'));
    }

    let inspectionId;
    if (transformerId) {
      const inspectionRes = await step('Inspection lifecycle', 'Create inspection', () => authed('post', '/api/inspections').send({
        transformer_id: transformerId,
        inspection_date: new Date().toISOString(),
        visit_type: 'Routine Inspection',
        gps_lat: 0.36,
        gps_lng: 32.62,
        gps_accuracy: 4,
        network_voltage_confirmed: true,
        kva_rating_confirmed: true,
        physical: { overall_condition: 'Fair', rust_corrosion: 'Minor', oil_leakage: 'None', bushing_condition: 'Good', tank_body_damage: 'None', cooling_fins_condition: 'Good', sound_level: 'Normal', temperature: 58 },
        oil_breather: { oil_level: 'Adequate', silica_gel_color: 'Blue', oil_test_required: false },
        electrical: { load_percentage: 72, overload_flag: false, power_factor: 0.91, frequency: 50 },
        site_safety: { security_fencing: 'Present', earthing: 'Present', warning_signs: 'Present', vegetation_encroachment: 'None', unauthorised_connections: false },
        condition_narrative: 'Phase 9F E2E inspection created through API validation.',
        recommended_action: 'Monitor',
        recommended_action_details: 'Continue routine monitoring.'
      }), [201]);
      inspectionId = getData(inspectionRes)?._id;
      result.created_records.inspection_id = inspectionId;
    }
    if (inspectionId) {
      await step('Inspection lifecycle', 'View inspection detail', () => authed('get', `/api/inspections/${inspectionId}`));
      await step('Inspection lifecycle', 'Edit inspection', () => authed('put', `/api/inspections/${inspectionId}`).send({
        transformer_id: transformerId,
        visit_type: 'Follow-up',
        physical: { overall_condition: 'Good' },
        condition_narrative: 'Phase 9F E2E inspection updated through API validation.',
        recommended_action: 'No Action'
      }));
      await step('Inspection lifecycle', 'Transformer inspection history', () => authed('get', `/api/inspections/transformer/${transformerId}`));
      await step('Inspection lifecycle', 'Latest inspection', () => authed('get', `/api/inspections/latest/${transformerId}`));
      recordGap('Inspection close', 'No close/complete inspection endpoint exists; inspections are create/update/delete records only.');
      result.summary.skipped += 1;
    }

    let faultId;
    if (transformerId) {
      const faultRes = await step('Fault lifecycle', 'Create fault', () => authed('post', '/api/faults').send({
        transformer_id: transformerId,
        inspection_id: inspectionId,
        fault_source: 'Field Observation',
        fault_description: 'Phase 9F E2E validation fault created from transformer inspection workflow.',
        fault_type: 'Overload',
        severity: 'Major',
        network_voltage_kv: 11,
        customers_affected: 26,
        area_affected: 'Phase 9F E2E feeder section'
      }), [201]);
      faultId = getData(faultRes)?._id;
      result.created_records.fault_id = faultId;
    }
    if (faultId) {
      await step('Fault lifecycle', 'Assign fault', () => authed('put', `/api/faults/${faultId}/assign`).send({
        assigned_to: refs.technician._id.toString(),
        target_resolution_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      }));
      await step('Fault lifecycle', 'Resolve fault', () => authed('put', `/api/faults/${faultId}/resolve`).send({
        resolution_description: 'Phase 9F E2E validation repair completed and overload normalized.',
        root_cause: 'Peak load imbalance',
        parts_replaced: 'LV fuse links'
      }));
      await step('Fault lifecycle', 'Close fault', () => authed('put', `/api/faults/${faultId}/close`).send({}));
    }

    let maintenanceId;
    if (transformerId) {
      const maintenanceRes = await step('Maintenance lifecycle', 'Create maintenance', () => authed('post', '/api/maintenance').send({
        transformer_id: transformerId,
        maintenance_date: new Date().toISOString(),
        maintenance_type: 'Preventive',
        team_contractor: 'Phase 9F Validation Team',
        supervised_by: 'Phase 9F Supervisor North',
        work_order_number: `P9F-E2E-WO-${Date.now()}`,
        work_performed: {
          physical_cleaning: true,
          silica_gel_replaced: true,
          oil_top_up: { performed: true, litres_added: 8 }
        },
        post_condition_narrative: 'Phase 9F E2E preventive maintenance completed.',
        completed_by: 'Phase 9F Field Technician 1',
        next_maintenance_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
      }), [201]);
      maintenanceId = getData(maintenanceRes)?._id;
      result.created_records.maintenance_id = maintenanceId;
    }
    if (maintenanceId) {
      await step('Maintenance lifecycle', 'Update maintenance', () => authed('put', `/api/maintenance/${maintenanceId}`).send({
        transformer_id: transformerId,
        maintenance_type: 'Preventive',
        post_condition_narrative: 'Phase 9F E2E preventive maintenance reviewed and updated.'
      }));
      await step('Maintenance lifecycle', 'Transformer maintenance history', () => authed('get', `/api/maintenance/transformer/${transformerId}`));
      recordGap('Maintenance assign/complete', 'Maintenance has create/update/delete/history endpoints, but no dedicated assign or complete lifecycle endpoints.');
      result.summary.skipped += 1;
    }

    const createdUserEmail = `phase9f.created.${Date.now()}@phase9f.io`;
    let userId;
    const userRes = await step('Admin users', 'Create user', () => authed('post', '/api/users').send({
      name: 'Phase 9F Created User',
      email: createdUserEmail,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      role: 'Viewer',
      is_active: true
    }), [201]);
    userId = getData(userRes)?._id;
    result.created_records.user_id = userId;
    if (userId) {
      await step('Admin users', 'Update user', () => authed('put', `/api/users/${userId}`).send({ name: 'Phase 9F Created User Updated', email: createdUserEmail }));
      await step('Admin users', 'Deactivate user', () => authed('post', `/api/users/${userId}/deactivate`).send({ reason: 'Phase 9F validation deactivation' }));
      await step('Admin users', 'Reactivate user', () => authed('post', `/api/users/${userId}/activate`).send({ notes: 'Phase 9F validation reactivation' }));
    }

    await step('Audit', 'Audit log list loads', () => authed('get', '/api/audit?page=1&limit=20'));
    await step('Audit', 'Audit filters work', () => authed('get', '/api/audit?page=1&limit=10&action_category=USER_MANAGEMENT'));
    await step('Audit', 'Audit actions list loads', () => authed('get', '/api/audit/actions'));
    if (transformerId) await step('Audit', 'Transformer audit route loads', () => authed('get', `/api/audit/transformers/${transformerId}`));

    const reports = ['transformers', 'inspections', 'faults', 'maintenance', 'asset-register'];
    for (const report of reports) {
      await step('Reports', `Generate ${report} report`, () => authed('get', `/api/reports/${report}?format=json&startDate=2020-01-01&endDate=2030-01-01`));
      await step('Exports', `Export ${report} JSON`, () => authed('post', '/api/exports/json').send({ report_type: report, filters: { startDate: '2020-01-01', endDate: '2030-01-01' } }));
      await step('Exports', `Export ${report} CSV`, () => authed('post', '/api/exports/csv').send({ report_type: report, filters: { startDate: '2020-01-01', endDate: '2030-01-01' } }));
    }

    await step('Maintenance mode', 'Enable maintenance mode', () => authed('post', '/api/admin/maintenance').send({
      enabled: true,
      message: 'Phase 9F validation maintenance window',
      reason: 'Phase 9F validation'
    }));
    await step('Maintenance mode', 'Normal user GET still works', () => authed('get', '/api/transformers?page=1&limit=1', 'technician'));
    await step('Maintenance mode', 'Normal user write receives 503', () => authed('post', '/api/inspections', 'technician').send({
      transformer_id: transformerId,
      condition_narrative: 'Should be blocked by maintenance mode.'
    }), [503]);

    const backupRes = await step('Backup', 'Create backup', () => authed('post', '/api/admin/backup').send({
      backup_name: `phase9f-e2e-${Date.now()}`,
      collections: ['transformers'],
      metadata: { phase: 'phase9f-e2e-validation' }
    }), [201, 200]);
    const backupId = getData(backupRes)?.backup_id;
    result.created_records.backup_id = backupId;
    await step('Backup', 'Backup history loads', () => authed('get', '/api/admin/backups?page=1&limit=10'));
    if (backupId) {
      await step('Restore', 'Dry-run restore', () => authed('post', `/api/admin/restore/${backupId}`).send({
        dryRun: true,
        confirmation: `RESTORE BACKUP ${backupId}`,
        collections: ['transformers']
      }));
      await step('Restore', 'Typed-confirmation restore', () => authed('post', `/api/admin/restore/${backupId}`).send({
        dryRun: false,
        confirmation: `RESTORE BACKUP ${backupId}`,
        collections: ['transformers']
      }));
    }
    await step('Maintenance mode', 'Disable maintenance mode', () => authed('post', '/api/admin/maintenance').send({
      enabled: false,
      message: 'System is available',
      reason: 'Phase 9F validation complete'
    }));
    await step('Dashboard', 'Dashboard refresh after restore', () => authed('get', '/api/dashboard/kpi'));

    await step('Error handling', '404 record returns clean response', () => authed('get', '/api/transformers/000000000000000000000000'), [404]);
    recordGap('Network timeout/disconnect backend', 'Not executed against the live app because intentionally killing backend during this validation would interrupt evidence capture.');
    result.summary.skipped += 1;
    recordGap('Cross-browser Edge/Safari/Firefox', 'Automated run is limited to local API validation and Chromium-compatible screenshot capture in this environment.');
    result.summary.skipped += 1;
  } finally {
    if (token('admin')) {
      await request(app.getApp())
        .post('/api/admin/maintenance')
        .set('Authorization', `Bearer ${token('admin')}`)
        .send({ enabled: false, message: 'System is available', reason: 'Phase 9F validation cleanup' })
        .catch(() => undefined);
    }
    await fs.writeFile(
      path.join(ARTIFACT_DIR, 'api-validation-results.json'),
      JSON.stringify(result, null, 2)
    );
    console.log(JSON.stringify(result.summary, null, 2));
  }
}

main()
  .catch(async (error) => {
    result.summary.failed += 1;
    recordBug({
      severity: 'Critical',
      workflow: 'Validation runner',
      steps: ['Run node scripts/phase9fValidateApiWorkflows.js'],
      expected: 'Runner completes and writes validation artifact',
      actual: error.message,
      suggested_fix: 'Inspect validation runner setup, database connectivity, and seeded account availability.'
    });
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, 'api-validation-results.json'), JSON.stringify(result, null, 2));
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.disconnect().catch(() => undefined);
    await redis.disconnect().catch(() => undefined);
    process.exit();
  });
