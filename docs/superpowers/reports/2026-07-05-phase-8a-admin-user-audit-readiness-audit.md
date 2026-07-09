# Phase 8A - Admin, User Management & Audit Readiness Audit

Date: 2026-07-05

## Objective

Audit Admin, User Management, and Audit Log modules before implementation.

This is an audit and planning task only. No backend implementation or frontend UI was added.

## Files Inspected

- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `src/routes/userRoutes.js`
- `src/controllers/userController.js`
- `src/routes/adminRoutes.js`
- `src/controllers/adminController.js`
- `src/routes/auditRoutes.js`
- `src/controllers/auditController.js`
- `src/services/auditService.js`
- `src/services/authService.js`
- `src/services/baseService.js`
- `src/models/User.js`
- `src/models/AuditLog.js`
- `src/middleware/auth.js`
- `src/middleware/rbac.js`
- `src/routes/index.js`
- `src/validators/userValidator.js`
- `swagger.yaml`

Expected but missing:

- `src/services/userService.js`
- `src/services/adminService.js`
- `src/middleware/authorization.js`

## Existing Routes

### User Routes

Mounted under `/api/users`.

| Method | Path | Controller | Access |
|---|---|---|---|
| GET | `/api/users` | `getAllUsers` | Super Admin, Territory Manager |
| GET | `/api/users/:id` | `getUserById` | Super Admin, Territory Manager |
| POST | `/api/users` | `createUser` | Super Admin, Territory Manager |
| PUT | `/api/users/:id` | `updateUser` | Super Admin, Territory Manager |
| DELETE | `/api/users/:id` | `deleteUser` | Super Admin |
| POST | `/api/users/:id/activate` | `activateUser` | Super Admin |
| POST | `/api/users/:id/deactivate` | `deactivateUser` | Super Admin, Territory Manager |
| POST | `/api/users/:id/role` | `changeUserRole` | Super Admin |
| GET | `/api/users/me/territory` | `getUsersInMyTerritory` | Authenticated |

All user controller methods currently return 501.

### Admin Routes

Mounted under `/api/admin`.

| Method | Path | Controller | Access |
|---|---|---|---|
| GET | `/api/admin/audit-logs` | `getAuditLogs` | Super Admin |
| GET | `/api/admin/system-stats` | `getSystemStats` | Super Admin |
| POST | `/api/admin/backup` | `triggerBackup` | Super Admin |
| GET | `/api/admin/backups` | `getBackupHistory` | Super Admin |
| POST | `/api/admin/restore/:backupId` | `restoreFromBackup` | Super Admin |
| POST | `/api/admin/maintenance` | `toggleMaintenanceMode` | Super Admin |
| GET | `/api/admin/users` | `getAllUsers` | Super Admin |

All admin controller methods currently return 501.

### Audit Routes

Mounted under `/api/audit`.

| Method | Path | Controller | Access |
|---|---|---|---|
| GET | `/api/audit` | `getAuditLogs` | Super Admin |
| GET | `/api/audit/user/:userId` | `getUserAuditLogs` | Super Admin |
| GET | `/api/audit/transformers/:transformerId` | `getTransformerAuditLogs` | Super Admin |
| GET | `/api/audit/actions` | `getAuditActions` | Super Admin |

All audit controller methods currently return 501.

## Stubbed Methods

### User Controller

- `getAllUsers`
- `getUserById`
- `createUser`
- `updateUser`
- `deleteUser`
- `activateUser`
- `deactivateUser`
- `changeUserRole`
- `getUsersInMyTerritory`

### Admin Controller

- `getSystemStats`
- `getAllUsers`
- `getAuditLogs`
- `triggerBackup`
- `restoreFromBackup`
- `getBackupHistory`
- `toggleMaintenanceMode`

### Audit Controller

- `getAuditLogs`
- `getUserAuditLogs`
- `getTransformerAuditLogs`
- `getAuditActions`

## Existing Models

### User

The `User` model is ready enough for backend user management.

Important fields:

- `name`
- `email`
- `password` with select false
- `role`
- `territory_id`
- `service_area_id`
- `is_active`
- `last_login`
- `login_attempts`
- `lock_until`
- password reset and email verification tokens
- preferences and push tokens
- `created_by`, `updated_by`, `deleted_at`, `deleted_by`

Important behavior:

- Password hashing runs in pre-save middleware when password changes.
- `toJSON()` strips password, reset tokens, verification tokens, two-factor secret, and refresh tokens.
- Role validation requires territory for Territory Manager, Engineer, and Field Technician.
- Role validation requires service area for Engineer and Field Technician.
- Deactivation is represented by `is_active = false`; authentication rejects inactive users.

### AuditLog

The `AuditLog` model is strong and implementation-ready for read endpoints.

Important fields:

- `user_id`
- `action`
- `action_category`
- target user, transformer, record type, and record id
- details
- request context
- old and new values
- metadata
- `is_sensitive`

Important behavior:

- Sensitive action classification runs before save.
- JSON transform strips password values from `old_values` and `new_values`.
- Static helpers exist for user trails, transformer trails, category actions, and stats.

## Existing Services

### Present

- `auditService.js`
- `authService.js`
- `baseService.js`

`auditService.js` already supports:

- non-fatal `logAction`
- action category mapping
- user audit trail
- transformer audit trail
- actions by category
- action statistics
- search
- user activity summary
- recent activities
- JSON export helper

`authService.js` already writes audit logs for auth events, but it writes directly to `AuditLog` rather than using `auditService`.

### Missing

- `userService.js`
- `adminService.js`
- `middleware/authorization.js`

The codebase uses `middleware/auth.js` and `middleware/rbac.js`; there is no separate `authorization.js`.

## Role and Permission Model

Roles in the `User` model:

- Super Admin
- Territory Manager
- Engineer
- Field Technician
- Viewer

Current route gates:

- User management is split between Super Admin and Territory Manager for list/read/create/update/deactivate.
- User hard delete, activate, and role changes are Super Admin only.
- Admin and Audit routes are Super Admin only.

RBAC helper capabilities exist in `middleware/rbac.js`, but most routes use simple role allow-lists from `authorize(...)`.

Territory scoping rules exist in helper functions, but they are not applied yet to user controller behavior because the controller is stubbed.

## Security Concerns

1. Password handling must not use `findByIdAndUpdate` for password changes because that would bypass `User` pre-save hashing.
2. User deletion should be deactivate-only for operational auditability. Hard deletion should stay deferred or restricted to a separate purge flow.
3. Territory Manager user management must be scoped to their territory and must not allow creating or promoting Super Admins.
4. Role changes must be Super Admin only and should protect against self-demotion if it would remove the last Super Admin.
5. User list/detail responses must never expose password hashes, refresh tokens, reset tokens, verification tokens, or two-factor secrets.
6. Audit log read endpoints should redact sensitive values consistently and avoid exposing excessive request metadata to non-admin roles.
7. Audit writes are currently non-fatal. That is good for app stability, but later compliance work may need monitoring for audit write failures.
8. Admin backup/restore endpoints are high risk and should remain deferred until storage paths, retention, encryption, and restore safety are designed.
9. Maintenance mode is global-impact functionality and needs explicit confirmation semantics, state storage, and tests before exposure.
10. Swagger and readiness map currently do not exactly match mounted User/Admin/Audit routes in several places.

## Readiness by Module

### User Module

Readiness: Partially ready for backend implementation.

Ready foundations:

- Routes exist.
- Validators exist.
- User model supports role scoping, activation, deactivation, and secure password serialization.
- Auth middleware already blocks deactivated users.

Blockers:

- Controller is fully stubbed.
- No `userService.js`.
- Territory Manager scoping is not implemented.
- Activation/deactivation schemas exist but are not applied in routes.
- Change role schema exists but is not applied in route.
- Delete route says delete/deactivate but needs a clear deactivate-only contract.

Safe first endpoints:

- `GET /api/users/me/territory`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `POST /api/users/:id/deactivate`
- `POST /api/users/:id/activate`
- `POST /api/users/:id/role`

Deferred:

- Hard user deletion.
- Password reset by admin.
- Bulk user import.
- User impersonation.

### Admin Module

Readiness: Mostly not ready; implement only safe read-only endpoints first.

Ready foundations:

- Routes exist.
- Super Admin route gates exist.
- System counts can be built from existing models.
- Admin audit logs and admin users can reuse audit/user services once implemented.

Blockers:

- Controller is fully stubbed.
- No `adminService.js`.
- No backup storage model or job lifecycle.
- No maintenance mode state model.
- Route names differ from readiness map.

Safe first endpoints:

- `GET /api/admin/system-stats`
- `GET /api/admin/users` as a Super Admin-only alias over user listing
- `GET /api/admin/audit-logs` as a Super Admin-only alias over audit listing

Deferred:

- `POST /api/admin/backup`
- `GET /api/admin/backups`
- `POST /api/admin/restore/:backupId`
- `POST /api/admin/maintenance`

### Audit Module

Readiness: Good candidate for first Phase 8 implementation.

Ready foundations:

- Routes exist.
- `AuditLog` model is mature.
- `auditService.js` already has read helpers and stats.
- Auth actions already write audit logs.
- Model JSON transform redacts password values in old/new values.

Blockers:

- Controller is fully stubbed.
- Route-level validators are missing.
- Need pagination/filter contracts.
- Need test fixtures for audit entries.
- Readiness map path says `/api/audit/transformer/:transformerId`, while actual route is `/api/audit/transformers/:transformerId`.

Safe first endpoints:

- `GET /api/audit`
- `GET /api/audit/user/:userId`
- `GET /api/audit/transformers/:transformerId`
- `GET /api/audit/actions`

Deferred:

- Audit export from admin UI.
- Audit retention deletion.
- Non-admin audit views.

## Documentation and Contract Mismatches

The implementation sprint should align docs or routes deliberately before marking endpoints ready.

Observed mismatches:

- Readiness map says `GET /api/users/my-territory`; actual route is `GET /api/users/me/territory`.
- Readiness map says `PUT /api/users/:id/activate`; actual route is `POST /api/users/:id/activate`.
- Readiness map says `PUT /api/users/:id/deactivate`; actual route is `POST /api/users/:id/deactivate`.
- Readiness map says `PUT /api/users/:id/role`; actual route is `POST /api/users/:id/role`.
- Readiness map says `GET /api/admin/stats`; actual route is `GET /api/admin/system-stats`.
- Readiness map says `POST /api/admin/restore`; actual route is `POST /api/admin/restore/:backupId`.
- Readiness map says `POST /api/admin/maintenance-mode`; actual route is `POST /api/admin/maintenance`.
- Readiness map says `GET /api/audit/transformer/:transformerId`; actual route is `GET /api/audit/transformers/:transformerId`.
- Swagger has user schemas but does not document the User/Admin/Audit route contracts yet.

## Required Tests

### User Tests

- Auth guard on all routes.
- Super Admin can list users.
- Territory Manager list is scoped to own territory.
- Territory Manager cannot create Super Admin.
- Create user hashes password and returns sanitized user.
- Update user does not expose sensitive fields.
- Deactivate user blocks future login.
- Activate user restores login only when valid.
- Role change validates required territory/service area.
- Last Super Admin cannot be deactivated or demoted.

### Audit Tests

- Auth guard.
- Super Admin can list audit logs.
- Pagination and filters work.
- User-specific logs work.
- Transformer-specific logs work.
- Available actions/categories return expected values.
- Sensitive password values are redacted.

### Admin Tests

- Auth guard.
- Non-Super Admin receives 403.
- System stats return expected shape.
- Admin users endpoint uses sanitized user data.
- Admin audit logs endpoint uses audit list behavior.
- Backup, restore, and maintenance endpoints remain 501 or not-ready until implemented.

## Recommended Phase 8 Implementation Order

1. Phase 8B - Audit Log Read API
2. Phase 8C - User Management Backend
3. Phase 8D - Admin Read-Only Backend
4. Phase 8E - Admin/User/Audit Frontend UI
5. Later - Backup/restore and maintenance mode design

## Next Sprint Recommendation

Start with Phase 8B - Audit Log Read API.

Reason:

- It is mostly service-backed already.
- It is Super Admin only.
- It has lower mutation risk than user management.
- It gives observability for later user/admin changes.

Suggested Phase 8B scope:

- Add `auditValidator.js`.
- Wire `auditController.js` to `auditService.js`.
- Implement `GET /api/audit`.
- Implement `GET /api/audit/user/:userId`.
- Implement `GET /api/audit/transformers/:transformerId`.
- Implement `GET /api/audit/actions`.
- Add `src/tests/audit.test.js`.
- Update Swagger and readiness map only for tested audit endpoints.

## Verification

Commands requested for this audit:

```bash
grep -R "501" -n src/controllers src/services
grep -R "notImpl" -n src/controllers src/services
npm test
git status --short
```

Results are recorded in the Phase 8A final response.

## Rollback

Revert:

- `docs/superpowers/reports/2026-07-05-phase-8a-admin-user-audit-readiness-audit.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`

No implementation files were intentionally changed for this audit.
