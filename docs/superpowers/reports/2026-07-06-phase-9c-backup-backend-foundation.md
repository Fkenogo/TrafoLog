# Phase 9C — Backup Backend Foundation

**Date:** 2026-07-06  
**Scope:** Backend-only backup creation and backup history foundation.  
**Status:** Implemented and tested.

## Objective

Implement secure backup backend infrastructure without implementing restore, frontend UI, backup download URLs, or destructive admin operations.

## Implementation Strategy

I kept the existing Admin route/controller pattern from Phases 8D and 9B, then replaced only the backup and backup-history stubs. The backup workflow is service-based: the controller validates and authorizes, `backupService` enforces maintenance mode and orchestrates the job, `manifestService` builds inventory and metadata, `compressionService` gzips the payload, `checksumService` computes SHA-256 integrity data, and `storageProvider` writes the artifact to configured local storage or an S3-compatible MinIO bucket when configured.

Tests were written first. The first focused Admin run failed as expected because backup and backup history still returned 501, no metadata/manifest/checksum existed, and backup audit logs were not written. Production code was then added to make the tests pass while leaving restore as a 501.

## Files Modified

- `src/controllers/adminController.js`
- `src/middleware/maintenanceMode.js`
- `src/models/BackupJob.js`
- `src/models/index.js`
- `src/routes/adminRoutes.js`
- `src/services/backupService.js`
- `src/services/checksumService.js`
- `src/services/compressionService.js`
- `src/services/manifestService.js`
- `src/services/storageProvider.js`
- `src/tests/admin.test.js`
- `src/validators/adminValidator.js`
- `.env.example`
- `swagger.yaml`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-06-phase-9c-backup-backend-foundation.md`

## Code Diff Summary

### Backup Model

Added `BackupJob` with:

- `backup_id`
- `filename`
- `storage_key`
- `status`
- `started_at`
- `completed_at`
- `created_by`
- `checksum`
- `compression`
- `encryption`
- `size_bytes`
- `collections`
- `schema_version`
- `app_version`
- `retention_until`
- `metadata`
- `manifest`
- `error_message`

Supported statuses:

- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`

### Backup Service

Added `backupService` to:

- Require active maintenance mode before backup creation.
- Create a `RUNNING` job record.
- Build a manifest and collection inventory.
- Serialize collection data into a portable JSON payload.
- Gzip the backup payload.
- Compute SHA-256 checksums.
- Store the backup artifact through `storageProvider`.
- Mark jobs `COMPLETED` or `FAILED`.
- Return metadata only for backup history.

### Manifest, Compression, Checksum, Storage

Added dedicated services:

- `manifestService` records timestamp, schema/app/Mongo versions, collection counts, creator metadata, compression, encryption flag, and checksum.
- `compressionService` provides a gzip hook.
- `checksumService` computes SHA-256 hashes.
- `storageProvider` writes to local storage by default and uses existing MinIO configuration when `BACKUP_STORAGE_PROVIDER=minio` and `MINIO_BUCKET_BACKUPS` are configured.

### Admin Controller And Routes

Implemented:

- `POST /api/admin/backup`
- `GET /api/admin/backups`

Kept as 501:

- `POST /api/admin/restore/:backupId`

### Maintenance Middleware Test Guard

Added a test-only enforcement header guard so global maintenance state does not poison unrelated parallel Jest suites. Production behavior is unchanged. In tests, normal-user maintenance blocking is asserted with `X-Maintenance-Test-Enforce: true`.

## Endpoint Behavior

### `POST /api/admin/backup`

Super Admin-only. Requires maintenance mode.

If maintenance mode is disabled:

```json
{
  "success": false,
  "message": "Enable Maintenance Mode before creating a backup."
}
```

HTTP status: `409 Conflict`.

On success:

```json
{
  "success": true,
  "data": {
    "backup_id": "BKP-...",
    "filename": "backup-...",
    "storage_key": "backups/...",
    "status": "COMPLETED",
    "checksum": "sha256:...",
    "compression": "gzip",
    "encryption": false,
    "size_bytes": 1234,
    "collections": [],
    "schema_version": "1.0",
    "app_version": "1.0.0",
    "retention_until": "...",
    "metadata": {},
    "manifest": {},
    "started_at": "...",
    "completed_at": "..."
  }
}
```

HTTP status: `201 Created`.

### `GET /api/admin/backups`

Super Admin-only. Returns backup metadata with pagination. It does not expose download URLs.

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0
  }
}
```

## Backup Architecture

The implementation uses MongoDB as job metadata storage and the configured storage provider for compressed artifacts. Backup creation is synchronous for this foundation phase, but the job status model is compatible with future queue-backed asynchronous execution.

The default storage provider is local filesystem storage under:

```text
BACKUP_LOCAL_DIR=/tmp/kvassettracker-backups
```

S3-compatible storage is available through the existing MinIO dependency and configuration when explicitly enabled.

## Backup Manifest Design

Each backup manifest contains:

- Backup ID
- Timestamp and generated-at date
- Schema version
- Application version
- MongoDB version when available
- Collection names and document counts
- Compression algorithm
- Encryption flag
- Storage provider metadata
- Backup creator ID and email
- SHA-256 checksum

## Validation

Added Admin validation for:

- Optional backup filename.
- Optional future `retention_until`.
- Optional collection allowlist.
- Backup history pagination and status filter.

Invalid retention dates and unsafe filenames return validation errors before backup work begins.

## Audit Implementation

Backup lifecycle writes `SYSTEM` audit logs:

- `SYSTEM_BACKUP_STARTED`
- `SYSTEM_BACKUP_COMPLETED`
- `SYSTEM_BACKUP_FAILED`

Audit metadata excludes backup payload data and secrets.

## Tests Added/Updated

Updated `src/tests/admin.test.js` to cover:

1. Super Admin-only backup access.
2. Maintenance mode requirement.
3. Backup creation starts and completes.
4. Backup history returns metadata.
5. Manifest generation.
6. Checksum persistence.
7. Audit logs for started/completed backups.
8. Storage failure path.
9. Restore remains 501.
10. Maintenance endpoints remain unaffected.

## Commands Executed

```bash
sed -n '1,260p' docs/superpowers/reports/2026-07-05-phase-9b-maintenance-mode-backend-foundation.md
sed -n '1,120p' docs/CHANGELOG_LOCAL_SETUP.md
sed -n '330,430p' docs/API_FRONTEND_READINESS_MAP.md
sed -n '1,220p' src/routes/authRoutes.js
sed -n '1,180p' src/controllers/authController.js
rg -n "phase-9b|running|tracking|Phase 9" docs -g "*.md"
rg -n "admin@|Super Admin|password" src/tests scripts docs .env.example
git status --short
npx jest --testPathPatterns=src/tests/admin --forceExit
npm test
npm start
PORT=3001 npm start
node --input-type=module -e "<authenticated Phase 9C smoke script>"
```

The first focused Admin run was the expected red run. The later focused run passed after implementation.

## Verification Result

- Focused Admin tests passed: 25/25.
- Full backend tests passed: 11 suites, 164 tests.
- `npm start` on port 3000 reached MongoDB/Redis and then exited because port 3000 was already occupied.
- `PORT=3001 npm start` booted successfully and printed the server ready banner.
- Authenticated smoke on port 3001 passed:
  - Login returned 200.
  - Maintenance enable returned 200.
  - Backup creation returned 201.
  - Backup history returned 200.
  - Restore returned 501.
  - Maintenance disable returned 200.

## Dependencies Added

None.

## Config Changes

Added backup-related environment documentation to `.env.example`:

- `MINIO_BUCKET_BACKUPS`
- `BACKUP_STORAGE_PROVIDER`
- `BACKUP_LOCAL_DIR`
- `BACKUP_PREFIX`
- `BACKUP_RETENTION_DAYS`
- `BACKUP_ENCRYPTION_ENABLED`

## Swagger And API Readiness Updates

Updated `swagger.yaml` with:

- `POST /api/admin/backup`
- `GET /api/admin/backups`
- Backup request, response, and job schemas.

Updated `docs/API_FRONTEND_READINESS_MAP.md` to mark:

- `POST /api/admin/backup` ready.
- `GET /api/admin/backups` ready.
- `POST /api/admin/restore/:backupId` still stubbed/not ready.

## Risks

- Backup artifacts are not encrypted yet; the manifest records `encryption: false` unless future encryption is added.
- Backup creation is synchronous in this foundation phase and may need queueing for large production databases.
- Local storage is suitable for development and simple deployments, but production should use durable object storage with retention and access controls.
- Restore is intentionally not implemented, so backups cannot yet be used for automated recovery through the API.
- Existing test output still includes known Mongoose duplicate-index warnings unrelated to this phase.
- The default local port 3000 may already be occupied by another backend process.

## Rollback Instructions

Remove the Phase 9C files and revert touched route/controller/docs:

```bash
rm -f src/models/BackupJob.js src/services/backupService.js src/services/checksumService.js src/services/compressionService.js src/services/manifestService.js src/services/storageProvider.js docs/superpowers/reports/2026-07-06-phase-9c-backup-backend-foundation.md
git checkout -- .env.example src/controllers/adminController.js src/middleware/maintenanceMode.js src/models/index.js src/routes/adminRoutes.js src/tests/admin.test.js src/validators/adminValidator.js swagger.yaml docs/API_FRONTEND_READINESS_MAP.md docs/CHANGELOG_LOCAL_SETUP.md
```

No migration is required. Any local backup files created during testing can be removed from the configured `BACKUP_LOCAL_DIR`.

## Next Phase Recommendation

Proceed to Phase 9D only after reviewing restore safety requirements. Restore should require maintenance mode, typed confirmation, manifest/checksum verification, a pre-restore backup, and explicit collection allowlists.
