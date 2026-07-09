/**
 * Phase 9E — Admin/User/Audit/Operations frontend UI guards.
 * Run: npx tsx scripts/testAdminFrontendGuards.ts
 */
import * as assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const exists = (path: string) => existsSync(resolve(root, path));

const expectedFiles = [
  'frontend/src/api/adminApi.ts',
  'frontend/src/api/userApi.ts',
  'frontend/src/api/auditApi.ts',
  'frontend/src/pages/admin/AdminPage.tsx'
];

for (const file of expectedFiles) {
  assert.ok(exists(file), `${file} must exist for Phase 9E`);
}

const routes = read('frontend/src/routes/AppRoutes.tsx');
const layout = read('frontend/src/layouts/AppLayout.tsx');
const adminPage = read('frontend/src/pages/admin/AdminPage.tsx');
const adminApi = read('frontend/src/api/adminApi.ts');
const userApi = read('frontend/src/api/userApi.ts');
const auditApi = read('frontend/src/api/auditApi.ts');
const allAdminFrontend = [routes, layout, adminPage, adminApi, userApi, auditApi].join('\n');

assert.match(routes, /path="\/admin"/, 'AppRoutes must register /admin');
assert.match(layout, /Admin/, 'AppLayout must include Admin navigation text');
assert.match(layout, /Super Admin/, 'Admin navigation must be role-gated for Super Admin');
assert.match(adminPage, /Overview/, 'Admin page must include Overview section');
assert.match(adminPage, /Users/, 'Admin page must include Users section');
assert.match(adminPage, /Audit Logs/, 'Admin page must include Audit Logs section');
assert.match(adminPage, /Operations/, 'Admin page must include Operations section');
assert.match(adminPage, /react-hook-form|useForm/, 'Admin user forms must use React Hook Form');
assert.match(adminPage, /zod|zodResolver/, 'Admin user forms must use Zod validation');
assert.match(adminPage, /RESTORE BACKUP/, 'Restore confirmation phrase must be required in Admin UI');
assert.match(adminPage, /dryRun/, 'Restore dry-run flow must be implemented');

for (const readyEndpoint of [
  '/admin/system-stats',
  '/admin/users',
  '/admin/audit-logs',
  '/admin/maintenance',
  '/admin/backup',
  '/admin/backups',
  '/admin/restore',
  '/users',
  '/audit',
  '/audit/actions'
]) {
  assert.match(allAdminFrontend, new RegExp(readyEndpoint.replace(/[/-]/g, (char) => `\\${char}`)), `${readyEndpoint} should be wired`);
}

for (const forbidden of [
  '/users/me/territory',
  '/admin/restore/',
  '/admin/backups/download',
  '/admin/backup/download',
  '/admin/download',
  'storage_key',
  'download_url',
  'signed_url'
]) {
  assert.doesNotMatch(allAdminFrontend, new RegExp(forbidden.replace(/[/-]/g, (char) => `\\${char}`)), `${forbidden} must not be called or exposed`);
}

assert.doesNotMatch(userApi, /\.delete\(/, 'User hard delete must not be implemented in frontend userApi');

console.log('✅ Phase 9E Admin operations frontend guards passed.');
