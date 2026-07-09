# Phase 9E — Admin Operations Frontend

**Date:** 2026-07-06  
**Scope:** Frontend Admin Operations UI.  
**Status:** Implemented and build-verified.

## Objective

Add a Super Admin Operations tab inside the existing `/admin` workspace for:

- Maintenance Mode
- Backup Creation
- Backup History
- Restore Dry Run
- Restore Execution with typed confirmation

No backend routes, backup downloads, restore bypasses, or frontend export/download workflows were added.

## Implementation Strategy

I extended the existing `AdminPage` rather than introducing a separate route so the new operations controls inherit the current Super Admin-only Admin workspace behavior. API access remains isolated in `adminApi.ts`, server state stays in TanStack Query, and dangerous restore actions are progressively unlocked only after maintenance mode is active, a matching dry-run succeeds, and the user types the exact confirmation phrase.

A static guard was updated before implementation to fail until the Operations tab, dry-run flow, confirmation phrase, and ready endpoints were wired while forbidding backup downloads, raw storage metadata, and not-ready routes.

## Files Modified

- `frontend/src/api/adminApi.ts`
- `frontend/src/pages/admin/AdminPage.tsx`
- `frontend/src/styles/app.css`
- `frontend/src/types/api.ts`
- `scripts/testAdminFrontendGuards.ts`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-06-phase-9e-admin-operations-frontend.md`

## Code Diff Summary

### API And Types

- Added Admin operations API wrappers:
  - `adminApi.maintenance`
  - `adminApi.updateMaintenance`
  - `adminApi.createBackup`
  - `adminApi.backups`
  - `adminApi.restore`
- Added frontend types for maintenance state, backup jobs, backup filters, backup payloads, and restore results.
- Kept restore route construction from `/admin/restore` without exposing download or storage-path routes.

### Admin Operations Tab

- Added an `Operations` tab to the existing Admin workspace.
- Added operations summary cards for maintenance status, backup count, selected backup, and dry-run state.
- Added maintenance status panel with enable/disable confirmation.
- Added backup creation form with backup name, retention date, and safe collection selection.
- Added backup history table with metadata-only rows and restore actions.
- Added restore panel with collection selection, dry-run validation, warnings, and real restore execution.

### Guarding Dangerous Actions

- Backup creation is disabled unless maintenance mode is enabled.
- Restore defaults to dry-run.
- Real restore is disabled unless:
  - maintenance mode is enabled,
  - selected backup is completed,
  - dry-run succeeded for the selected backup,
  - typed confirmation exactly matches `RESTORE BACKUP <backupId>`.
- No backup download links, raw local paths, or raw storage metadata are rendered.

## APIs Consumed

- `GET /api/admin/maintenance`
- `POST /api/admin/maintenance`
- `POST /api/admin/backup`
- `GET /api/admin/backups`
- `POST /api/admin/restore/:backupId`

## Not-Ready Endpoints Avoided

- Backup download endpoints
- Raw storage-key download routes
- Public backup file URLs
- Any frontend restore path that bypasses dry-run
- Any frontend restore path without typed confirmation

## Query Invalidation Behavior

After maintenance toggle:

- `['admin', 'maintenance']`
- `['admin', 'system-stats']`

After backup creation:

- `['admin', 'backups']`
- `['admin', 'audit-logs']`
- `['admin', 'system-stats']`
- `['audit']`

After real restore:

- `['admin', 'backups']`
- `['admin', 'system-stats']`
- `['admin', 'audit-logs']`
- `['dashboard']`
- `['transformers']`
- `['transformer']`
- `['inspections']`
- `['inspection']`
- `['faults']`
- `['fault']`
- `['maintenance']`
- `['reports']`
- `['analytics']`
- `['audit']`

## Static Guard

Updated `scripts/testAdminFrontendGuards.ts` to assert:

- Operations tab is present.
- Restore dry-run flow is present.
- `RESTORE BACKUP` confirmation phrase is present.
- Ready operations endpoints are wired.
- Backup download routes, raw storage-key references, signed/download URLs, and not-ready user territory route remain absent.
- User hard delete remains absent.

## Verification

Commands run:

```bash
npx tsx scripts/testAdminFrontendGuards.ts
cd frontend && npm run build
cd frontend && npm run dev -- --host 127.0.0.1
npm test
git status --short
```

Frontend guard passed. Frontend build passed. Vite emitted the existing large chunk warning. Backend tests passed: 11 suites, 175 tests. Jest emitted the existing Mongoose duplicate-index/reserved-key warnings and forced-exit/open-handle warning after passing.

## Manual Validation

Dev server started at `http://127.0.0.1:5173/`. Full Super Admin browser smoke for maintenance/backup/restore depends on authenticated local session and backend state; destructive restore was not executed manually during this frontend pass. The frontend guard and build verify the UI does not call not-ready endpoints and enforces dry-run/typed-confirmation paths in code.

## Risks

- Real restore remains inherently destructive; the frontend locks the action behind backend safety controls but operators still need process discipline.
- Backup creation and restore depend on maintenance mode status staying fresh; the UI refetches status and invalidates after toggle, but stale browser tabs can still display old context until refreshed.
- Backend returns metadata fields beyond what the UI renders. The UI intentionally does not expose storage details or download affordances.
- Browser smoke should be repeated against a populated local Super Admin account before release signoff.

## Rollback Instructions

Revert these frontend/documentation changes:

```bash
git checkout -- frontend/src/api/adminApi.ts frontend/src/pages/admin/AdminPage.tsx frontend/src/styles/app.css frontend/src/types/api.ts scripts/testAdminFrontendGuards.ts docs/CHANGELOG_LOCAL_SETUP.md
rm docs/superpowers/reports/2026-07-06-phase-9e-admin-operations-frontend.md
```

This removes the Operations tab and frontend operations API wrappers while leaving backend Phase 9B-9D functionality intact.
