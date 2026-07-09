# Phase 9A — Backup, Restore & Maintenance Mode Readiness Audit

**Date:** 2026-07-05  
**Scope:** Documentation-only readiness audit for backup, backup history, restore, and maintenance mode.  
**Implementation status:** No code implementation performed.

## Objective

Audit the intentionally deferred admin operations before implementation:

- Backup
- Backup history
- Restore
- Maintenance mode

The goal was to identify current route readiness, missing backend architecture, storage/config requirements, security risks, data-loss risks, and a practical implementation order.

## Audit Strategy

I reviewed the current Admin backend contract, controller stubs, models, storage-related configuration, authentication/RBAC middleware, Swagger coverage, and prior Phase 8E frontend report. I also ran the requested repository searches for backup, restore, and maintenance references to confirm there is no hidden implementation behind the existing route stubs.

## Files Inspected

- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-05-phase-8e-admin-user-audit-frontend-ui.md`
- `src/routes/adminRoutes.js`
- `src/controllers/adminController.js`
- `src/models`
- `src/models/AuditLog.js`
- `src/models/AssetPhoto.js`
- `src/models/ExportJob.js`
- `src/models/ImportLog.js`
- `src/config/database.js`
- `src/config/redis.js`
- `src/middleware/auth.js`
- `src/middleware/rbac.js`
- `src/routes/index.js`
- `src/app.js`
- `src/tests/admin.test.js`
- `src/services/auditService.js`
- `.env.example`
- `package.json`
- `swagger.yaml`

## Files Modified

- `docs/superpowers/reports/2026-07-05-phase-9a-backup-restore-maintenance-readiness-audit.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`

## Current Route Readiness

| Route | Current behavior | Access | Readiness |
|---|---|---|---|
| `POST /api/admin/backup` | Mounted, authenticated, Super Admin-only, returns 501 | Super Admin | Not ready |
| `GET /api/admin/backups` | Mounted, authenticated, Super Admin-only, returns 501 | Super Admin | Not ready |
| `POST /api/admin/restore/:backupId` | Mounted, authenticated, Super Admin-only, returns 501 | Super Admin | Not ready |
| `POST /api/admin/maintenance` | Mounted, authenticated, Super Admin-only, returns 501 | Super Admin | Not ready |

`src/controllers/adminController.js` still wires these methods through `notImpl(...)`. Phase 8D tests intentionally assert that backup, restore, and maintenance mode remain 501.

## Backup Readiness

Backup is not implementation-ready yet.

What exists:

- Admin route shell for `POST /api/admin/backup`.
- Super Admin-only route protection.
- Existing MinIO/S3-compatible dependency and environment pattern for photos/reports.
- `archiver`, `minio`, `aws-sdk`, and MongoDB dependencies already exist.
- Audit category `SYSTEM` already exists, and `auditService` maps `SYSTEM_BACKUP` to `SYSTEM`.

What is missing:

- No `BackupJob`, `BackupManifest`, or equivalent model.
- No backup service.
- No backup validator.
- No backup storage bucket/path contract.
- No encryption/checksum contract.
- No backup metadata schema.
- No retention policy.
- No background job/locking behavior.
- No tested response shape.
- No Swagger documentation for backup endpoints.
- No `.env.example` backup-specific variables.

Recommended backup scope for first implementation:

- Start with MongoDB application data only.
- Exclude uploaded files/photos initially unless the product explicitly requires full media recovery in the same backup artifact.
- Store backup artifacts in S3-compatible/MinIO storage for production-like environments.
- Allow local filesystem storage only for development and tests.
- Include a manifest, checksum, app version, schema version, creator, creation timestamp, included collections, storage key, size, status, and expiry/retention metadata.

Recommended backup format:

- `tar.gz` or zip archive containing:
  - `manifest.json`
  - collection dumps as JSONL or BSON/archive data
  - checksum file
- Prefer a deterministic manifest and checksum even if the underlying collection dump format changes later.

## Backup History Readiness

Backup history is not implementation-ready yet.

What exists:

- Admin route shell for `GET /api/admin/backups`.
- `ExportJob` and `ImportLog` models show existing job-history patterns, but neither is semantically correct for backup history.

What is missing:

- Dedicated backup history model.
- Pagination/filter contract.
- Status lifecycle.
- Retention/expiry metadata.
- Storage object metadata.
- Failure details.
- Audit linkage.

Recommendation:

- Add a dedicated `BackupJob` model rather than overloading `ExportJob`.
- Statuses should be explicit: `queued`, `running`, `completed`, `failed`, `expired`, `deleted`.
- History should expose metadata only; never expose raw storage credentials or filesystem paths.

## Restore Readiness

Restore is not implementation-ready and is the highest-risk operation in this group.

What exists:

- Admin route shell for `POST /api/admin/restore/:backupId`.
- Super Admin-only route protection.
- Audit category `SYSTEM` exists, and `auditService` maps `SYSTEM_RESTORE` to `SYSTEM`.

What is missing:

- Restore service.
- Restore validator.
- Typed confirmation.
- Backup manifest verification.
- Checksum verification.
- Backup compatibility checks.
- Pre-restore backup.
- Maintenance-mode prerequisite.
- Collection allowlist.
- Transaction/lock strategy.
- Dry-run validation.
- Rollback plan.
- Tests for partial failure.

Recommended restore safety requirements:

- Require active maintenance mode before restore begins.
- Require typed confirmation such as the backup ID plus a phrase like `RESTORE PRODUCTION DATA`.
- Always create a pre-restore backup before mutating data.
- Verify backup manifest, checksum, app version, schema version, and storage object identity before restore.
- Restore only allowlisted collections.
- Block restore from arbitrary file paths or user-provided storage keys.
- Prevent concurrent restore/backup jobs.
- Record full audit events without logging secrets.

## Maintenance Mode Readiness

Maintenance mode is not implementation-ready yet.

What exists:

- Admin route shell for `POST /api/admin/maintenance`.
- Super Admin-only route protection.
- Redis configuration that could cache maintenance state.
- MongoDB configuration that could persist maintenance state.
- Audit category `SYSTEM` exists, and `auditService` maps `SYSTEM_MAINTENANCE` to `SYSTEM`.

What is missing:

- Maintenance state model.
- Global middleware.
- Read/write blocking policy.
- Bypass rules.
- Status endpoint.
- Frontend status/banner contract.
- Tests for write blocking and Super Admin bypass.
- Cache invalidation behavior.
- Safe behavior if Redis is unavailable.

Recommended state strategy:

- Persist maintenance mode in MongoDB for durability.
- Cache the current state in Redis for fast request checks.
- Treat MongoDB as source of truth if Redis is unavailable or cold.
- Add middleware after authentication where practical, so role-based bypass can be evaluated.

Recommended policy:

- Super Admin can bypass maintenance mode for admin/maintenance endpoints.
- Normal users should receive a clear 503 maintenance response for writes.
- Reads can remain allowed initially unless an operation is known to be unsafe during restore.
- During restore, block all non-admin writes and consider blocking non-admin reads if consistency is uncertain.
- Frontend should eventually show a maintenance banner/status page, but that is not part of this audit.

## Storage And Config Requirements

Existing relevant environment/config:

- `MONGODB_URI`
- `MONGO_ROOT_USER`
- `MONGO_ROOT_PASSWORD`
- `REDIS_URL`
- `REDIS_PASSWORD`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET_PHOTOS`
- `MINIO_BUCKET_REPORTS`
- `MAX_FILE_SIZE`
- `ALLOWED_FILE_TYPES`

Recommended additions before backup implementation:

- `BACKUP_STORAGE_PROVIDER`
- `BACKUP_BUCKET`
- `BACKUP_PREFIX`
- `BACKUP_TMP_DIR`
- `BACKUP_RETENTION_DAYS`
- `BACKUP_MAX_BYTES`
- `BACKUP_ENCRYPTION_ENABLED`
- `BACKUP_ENCRYPTION_KEY` or KMS-specific configuration
- `BACKUP_INCLUDE_UPLOADS`
- `BACKUP_MONGODUMP_PATH` and `BACKUP_MONGORESTORE_PATH` if external MongoDB tools are used

Storage recommendation:

- Production: S3-compatible storage via MinIO/S3 with encryption and checksums.
- Development/test: local temp directory or mocked storage.
- Avoid storing production backups only on the application host.

## Security And RBAC Requirements

Minimum security requirements:

- Super Admin only for backup, history, restore, and maintenance mode.
- Strong validation for every request body and route parameter.
- Re-authentication or typed confirmation for restore.
- No raw storage paths, credentials, signed secrets, token values, password hashes, or reset tokens in API responses.
- Audit every backup, restore, and maintenance state change.
- Avoid path traversal by using server-generated storage keys only.
- Enforce one active backup/restore job at a time.
- Do not let backup download/list operations expose GPS-rich datasets casually; treat backup artifacts as highly sensitive.

Recommended audit actions:

- `SYSTEM_BACKUP_REQUESTED`
- `SYSTEM_BACKUP_STARTED`
- `SYSTEM_BACKUP_COMPLETED`
- `SYSTEM_BACKUP_FAILED`
- `SYSTEM_RESTORE_REQUESTED`
- `SYSTEM_RESTORE_STARTED`
- `SYSTEM_RESTORE_COMPLETED`
- `SYSTEM_RESTORE_FAILED`
- `SYSTEM_MAINTENANCE_ENABLED`
- `SYSTEM_MAINTENANCE_DISABLED`

Use `action_category: SYSTEM`.

## Data-Loss Risks

Key restore risks:

- Accidental restore into the wrong environment.
- Partial restore after process crash.
- Writes occurring during restore.
- Restoring stale or incompatible schema data.
- Restoring users/sessions/tokens in a way that changes admin access.
- Losing records created after backup time.
- Broken references between collections if only some data is restored.
- Missing index rebuilds after restore.
- Restoring metadata without uploaded media, or uploaded media without metadata.
- Corrupted backup artifacts without checksum verification.
- Encryption key loss.

Controls required before implementation:

- Maintenance mode prerequisite.
- Pre-restore backup.
- Compatibility check.
- Dry-run validation.
- Typed confirmation.
- Collection allowlist.
- Operational runbook.
- Clear audit trail.

## Recommended Implementation Order

1. **Phase 9B — Maintenance Mode Backend Foundation**
   - Add persistent maintenance state.
   - Add Redis-backed cache.
   - Add global middleware and bypass policy.
   - Add tests for write blocking, read behavior, and Super Admin bypass.

2. **Phase 9C — Backup Backend Foundation**
   - Add `BackupJob`/manifest model.
   - Add backup service and storage abstraction.
   - Add MongoDB-only backup creation.
   - Add backup history list.
   - Add checksum, metadata, retention fields, and audit logs.

3. **Phase 9D — Restore Backend Safety Layer**
   - Require maintenance mode.
   - Add typed confirmation.
   - Verify manifest/checksum.
   - Create pre-restore backup.
   - Restore allowlisted MongoDB collections only.
   - Add extensive failure tests.

4. **Phase 9E — Admin Operations Frontend**
   - Expose maintenance status/toggle.
   - Expose backup creation/history.
   - Expose restore only behind strong warning and typed confirmation.

5. **Later — Upload/Media Backup Extension**
   - Add optional uploads/photo backup after MongoDB-only backup is proven.

## Next Sprint Recommendation

Implement **Phase 9B — Maintenance Mode Backend Foundation** first. Restore should not be implemented before the system has a tested maintenance-state mechanism that can block writes and communicate safe operational state.

Suggested Phase 9B acceptance criteria:

- Super Admin can enable/disable maintenance mode.
- Maintenance state is persisted in MongoDB and cached in Redis.
- Normal user write requests are blocked while maintenance mode is active.
- Super Admin can access admin maintenance endpoints while maintenance mode is active.
- Maintenance changes write `SYSTEM` audit logs.
- Swagger and readiness map mark only tested maintenance endpoints as ready.

## Commands Executed

```bash
grep -R "backup" -n src
grep -R "restore" -n src
grep -R "maintenance" -n src/controllers src/routes src/services src/models
rg -n "/api/admin|admin/|backup|restore|maintenance" swagger.yaml
sed -n '500,590p' swagger.yaml
sed -n '1,260p' src/routes/adminRoutes.js
sed -n '1,270p' src/controllers/adminController.js
sed -n '1,260p' src/tests/admin.test.js
sed -n '1,340p' src/app.js
sed -n '1,220p' src/routes/index.js
sed -n '1,260p' src/models/ExportJob.js
sed -n '1,260p' src/models/ImportLog.js
sed -n '1,260p' src/models/AuditLog.js
sed -n '1,260p' src/models/AssetPhoto.js
sed -n '1,620p' src/services/auditService.js
sed -n '1,220p' .env.example
sed -n '1,320p' package.json
git status --short
npm test
```

## Verification Result

- Required grep checks confirmed backup/restore are only present in admin stubs/tests/routes.
- Required maintenance grep confirmed operational maintenance CRUD exists, but maintenance mode itself remains only the admin route stub.
- Backend tests were run after the documentation update; see final response for exact output.

## Risks

- Backup/restore require stronger operational design than the current admin route shell provides.
- Restore is especially dangerous without maintenance mode, typed confirmation, pre-restore backup, and checksum verification.
- Uploaded photos/files are referenced by metadata but do not yet have a tested full-backup strategy.
- Existing Swagger correctly avoids documenting the risky admin stubs as ready; future phases must avoid marking them ready until tested.

## Rollback Instructions

To roll back this audit-only phase:

```bash
rm -f docs/superpowers/reports/2026-07-05-phase-9a-backup-restore-maintenance-readiness-audit.md
git checkout -- docs/CHANGELOG_LOCAL_SETUP.md
```

No runtime files were changed.
