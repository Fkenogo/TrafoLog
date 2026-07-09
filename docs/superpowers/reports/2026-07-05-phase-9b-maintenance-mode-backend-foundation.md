# Phase 9B — Maintenance Mode Backend Foundation

**Date:** 2026-07-05  
**Scope:** Backend-only maintenance mode foundation.  
**Status:** Implemented and tested.

## Objective

Implement durable maintenance mode support without implementing backup, restore, backup history, or frontend UI.

## Implementation Strategy

I kept the Phase 8D Admin architecture intact and replaced only the `toggleMaintenanceMode` stub. The implementation adds a small singleton-style MongoDB state model, a service that treats MongoDB as source of truth and Redis as a best-effort cache, middleware that blocks unsafe writes during active maintenance, and Super Admin-only Admin endpoints for status and toggling. Backup, backup history, and restore routes remain untouched 501 stubs.

Tests were written first against the expected behavior. The first focused run failed because maintenance mode was still a 501 stub, `GET /api/admin/maintenance` was missing, write blocking was absent, and audit logs were not written. Production code was then added to satisfy those tests.

## Files Modified

- `src/app.js`
- `src/controllers/adminController.js`
- `src/middleware/maintenanceMode.js`
- `src/models/MaintenanceMode.js`
- `src/models/index.js`
- `src/routes/adminRoutes.js`
- `src/services/maintenanceModeService.js`
- `src/tests/admin.test.js`
- `src/validators/adminValidator.js`
- `swagger.yaml`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-05-phase-9b-maintenance-mode-backend-foundation.md`

## Code Diff Summary

### Maintenance Model

Added `MaintenanceMode` as a durable MongoDB singleton state document with:

- `enabled`
- `message`
- `reason`
- `enabled_by`
- `enabled_at`
- `disabled_by`
- `disabled_at`
- timestamps

### Maintenance Service

Added `maintenanceModeService` with:

- MongoDB source-of-truth reads.
- Redis best-effort cache with short TTL.
- Enable/disable persistence.
- Safe normalized response shape.
- `SYSTEM` audit logging for state changes.

### Maintenance Middleware

Added global `/api` middleware that:

- Allows safe methods: `GET`, `HEAD`, `OPTIONS`.
- Allows auth/session endpoints required for access: login, refresh, logout, logout-all.
- Allows `/api/admin/maintenance`.
- Blocks unsafe methods while enabled: `POST`, `PUT`, `PATCH`, `DELETE`.
- Returns `503 Service Unavailable` with a clean maintenance envelope for normal users.
- Allows Super Admin access to Admin endpoints so maintenance mode can be disabled and not-ready admin stubs can still return their intended 501 responses.

### Admin Controller And Routes

Implemented:

- `GET /api/admin/maintenance`
- `POST /api/admin/maintenance`

Kept as 501:

- `POST /api/admin/backup`
- `GET /api/admin/backups`
- `POST /api/admin/restore/:backupId`

### Validation

Added `adminValidator.js` with validated maintenance payload:

```json
{
  "enabled": true,
  "message": "System is under maintenance",
  "reason": "Planned maintenance"
}
```

## Endpoint Behavior

### `GET /api/admin/maintenance`

Super Admin-only. Returns:

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "message": "System is under maintenance",
    "reason": "Planned maintenance",
    "enabled_by": "...",
    "enabled_at": "...",
    "disabled_by": null,
    "disabled_at": null,
    "updated_at": "..."
  }
}
```

### `POST /api/admin/maintenance`

Super Admin-only. Enables or disables maintenance mode and returns the same state shape.

## Write-Blocking Behavior

When enabled, normal users receive:

```json
{
  "success": false,
  "message": "System is under maintenance",
  "maintenance": {
    "enabled": true,
    "message": "System is under maintenance",
    "reason": "..."
  }
}
```

HTTP status: `503 Service Unavailable`.

Reads remain allowed for now.

## Super Admin Bypass Behavior

Super Admin users can still access Admin endpoints while maintenance mode is active. This is required so the maintenance endpoint remains usable for disabling maintenance mode and so backup/restore stubs continue returning 501 instead of being hidden behind maintenance blocking.

## Audit Logging Behavior

Maintenance state changes write `SYSTEM` audit logs:

- `SYSTEM_MAINTENANCE_ENABLED`
- `SYSTEM_MAINTENANCE_DISABLED`

Audit entries contain safe state metadata only and do not log secrets.

## Tests Added/Updated

Updated `src/tests/admin.test.js` to cover:

1. Auth guard for maintenance endpoint.
2. Non-Super Admin receives 403.
3. Super Admin can enable maintenance mode.
4. Super Admin can read persisted maintenance state.
5. Normal user unsafe write returns 503 while enabled.
6. Normal user GET still works while enabled.
7. Super Admin can disable maintenance mode while enabled.
8. Maintenance changes write `SYSTEM` audit logs.
9. Backup route remains 501.
10. Restore route remains 501.

## APIs Implemented

- `GET /api/admin/maintenance`
- `POST /api/admin/maintenance`

## APIs Still Not Ready

- `POST /api/admin/backup`
- `GET /api/admin/backups`
- `POST /api/admin/restore/:backupId`

## Swagger And API Readiness Updates

Updated `swagger.yaml` with the tested maintenance endpoints, request body, and response schema.

Updated `docs/API_FRONTEND_READINESS_MAP.md` to mark only the tested maintenance endpoints as ready and keep backup, backup history, and restore marked as stubs.

## Commands Executed

```bash
npx jest --testPathPatterns=src/tests/admin --forceExit
npx jest --testPathPatterns=src/tests/admin --forceExit
npm test
npm start
PORT=3001 npm start
git status --short
```

The first focused test run was the expected red run. The second focused run passed after implementation.

## Verification Result

- Focused Admin tests passed: 20/20.
- Full backend tests passed: 11 suites, 159 tests.
- `npm start` on the default port reached MongoDB/Redis, then exited because port 3000 was already occupied.
- `PORT=3001 npm start` booted successfully and printed the server ready banner.
- Stopping the port 3001 process with Ctrl-C surfaced an existing shutdown warning: `The client is closed`.

## Dependencies Added

None.

## Config Changes

None.

## Risks

- Maintenance mode currently blocks API writes only; it does not add a frontend maintenance banner or public status page.
- Redis cache is best-effort by design. MongoDB remains the source of truth.
- Super Admin bypass is limited to Admin endpoints. Non-admin writes remain blocked while maintenance is enabled.
- Existing test output still includes known Mongoose duplicate-index warnings unrelated to this phase.
- Default local port 3000 may already be occupied by another backend process; use `PORT=3001 npm start` for smoke verification when needed.

## Rollback Instructions

Remove the Phase 9B files and revert touched route/controller/docs:

```bash
rm -f src/models/MaintenanceMode.js src/services/maintenanceModeService.js src/middleware/maintenanceMode.js src/validators/adminValidator.js docs/superpowers/reports/2026-07-05-phase-9b-maintenance-mode-backend-foundation.md
git checkout -- src/app.js src/controllers/adminController.js src/models/index.js src/routes/adminRoutes.js src/tests/admin.test.js swagger.yaml docs/API_FRONTEND_READINESS_MAP.md docs/CHANGELOG_LOCAL_SETUP.md
```

No database migration is required, but any `maintenancemodes` collection documents created locally can be removed manually if desired.
