# Phase 9D — Restore Backend Safety Layer

**Date:** 2026-07-06  
**Scope:** Backend-only restore safety implementation.  
**Status:** Implemented and tested.

## Objective

Implement a safe restore backend layer without adding frontend UI or accepting user-provided file paths/download URLs.

Restore now supports:

- Final backup artifact checksum verification.
- Trusted artifact read by `BackupJob`.
- Gzip decompression.
- Manifest and payload validation.
- Server-side collection allowlist.
- Maintenance mode requirement.
- Exact typed confirmation.
- Active backup/restore operation lock.
- Dry-run validation.
- Pre-restore backup before destructive restore.
- Restore audit logging.

## Implementation Strategy

I kept the Admin route/controller architecture and added a dedicated `restoreService` rather than embedding restore logic in the controller. The existing backup subsystem was hardened first so new backups store a checksum of the final compressed artifact bytes. Restore resolves artifacts only through a completed `BackupJob`, reads the artifact through `storageProvider`, verifies the final artifact checksum before decompression, parses Extended JSON to preserve MongoDB types, validates the manifest and requested collections, and returns a dry-run plan or executes a guarded restore.

Tests were added before runtime implementation. The first focused Admin run failed because restore still returned 501, checksum/storage/decompression support was missing, and the new restore audit/validation behavior did not exist. Implementation then made the focused suite green.

## Files Modified

- `src/controllers/adminController.js`
- `src/models/BackupJob.js`
- `src/routes/adminRoutes.js`
- `src/services/backupService.js`
- `src/services/compressionService.js`
- `src/services/restoreService.js`
- `src/services/storageProvider.js`
- `src/tests/admin.test.js`
- `src/validators/adminValidator.js`
- `swagger.yaml`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-06-phase-9d-restore-backend-safety-layer.md`

## Code Diff Summary

### Backup Hardening

- `backupService` now computes `checksum` over the final stored compressed artifact bytes.
- Backup payloads are serialized with BSON Extended JSON to preserve ObjectIds and Dates for restore.
- Backup creation checks for active running backup/restore jobs.
- `BackupJob` now includes `operation_type` to distinguish backup jobs from transient restore operation locks.

### Storage And Compression

- `storageProvider.read(job)` reads trusted artifacts by `BackupJob`.
- Local storage maps missing files to `404 Backup artifact not found`.
- MinIO read support resolves objects from trusted backup metadata.
- `compressionService` now supports `gunzip`.

### Restore Service

Added `src/services/restoreService.js` with:

- Maintenance mode enforcement.
- Active operation lock check.
- Completed-backup lookup.
- Exact typed confirmation validation.
- Artifact checksum verification.
- Gunzip and Extended JSON payload parsing.
- Manifest and document-count validation.
- Server-side collection allowlist.
- Dry-run planning.
- Pre-restore backup creation.
- Allowlisted collection restore.
- `SYSTEM` restore audit logs.

## Restore Safety Architecture

Restore follows this order:

1. Require maintenance mode.
2. Reject if any backup/restore job is `RUNNING`.
3. Load completed backup by `backup_id`.
4. Require confirmation phrase: `RESTORE BACKUP <backupId>`.
5. Read artifact using trusted `BackupJob` metadata.
6. Recompute SHA-256 over final stored bytes.
7. Reject checksum mismatch before decompression.
8. Gunzip and parse payload.
9. Validate manifest, backup ID, schema/app fields, collection allowlist, requested collections, and document counts.
10. If `dryRun: true`, return the restore plan without mutation.
11. If `dryRun: false`, create a restore operation lock.
12. Create a pre-restore backup.
13. Restore only requested allowlisted collections.
14. Write completion/failure audit logs.

## Endpoint Behavior

### `POST /api/admin/restore/:backupId`

Request:

```json
{
  "confirmation": "RESTORE BACKUP BKP-...",
  "dryRun": true,
  "collections": ["transformers", "inspections"]
}
```

Dry-run response:

```json
{
  "success": true,
  "data": {
    "dryRun": true,
    "backup_id": "BKP-...",
    "verified": true,
    "collections": ["transformers"],
    "plan": {
      "collections": [{ "name": "transformers", "document_count": 1 }],
      "total_documents": 1
    },
    "warnings": []
  }
}
```

Restore response:

```json
{
  "success": true,
  "data": {
    "dryRun": false,
    "backup_id": "BKP-...",
    "pre_restore_backup_id": "BKP-...",
    "restored_collections": ["transformers"],
    "restored_counts": { "transformers": 1 },
    "completed_at": "2026-07-06T..."
  }
}
```

## Checksum Verification Behavior

Backup now stores the SHA-256 checksum of the final compressed artifact bytes. Restore reads the stored bytes, recomputes SHA-256, and rejects mismatches with:

```text
Backup artifact checksum verification failed
```

Checksum verification happens before decompression or mutation.

## Storage Read And Decompression Behavior

Artifacts are read only through trusted `BackupJob` metadata. The restore request never accepts a raw filesystem path, storage key, or download URL.

- Local missing artifact returns `404 Backup artifact not found`.
- Invalid gzip or invalid payload returns `400 Backup artifact payload is invalid`.
- Gzip decompression uses `compressionService.gunzip`.

## Manifest Validation Behavior

Restore validates:

- Payload has `manifest` and `data`.
- Manifest `backup_id` matches the requested backup.
- Manifest includes required version and collection fields.
- Requested collections exist in the manifest.
- Requested collection payload exists.
- Manifest document count equals payload document count.

App version mismatch currently produces a warning instead of a hard failure.

## Collection Allowlist Behavior

Server-side restore allowlist:

- `transformers`
- `inspections`
- `faults`
- `maintenances`

Sessions, refresh tokens, users, audit logs, backup jobs, and arbitrary collection names are not restorable through the endpoint.

## Active Operation Lock Behavior

Restore and backup reject when any `BackupJob` has `status: RUNNING`.

Real restore creates a transient `BackupJob` with:

- `operation_type: RESTORE`
- `status: RUNNING`

The lock is marked `COMPLETED` or `FAILED` after the restore attempt.

## Maintenance And Confirmation Behavior

Restore requires maintenance mode and returns `409` when disabled:

```text
Enable Maintenance Mode before restoring a backup.
```

Confirmation must exactly match:

```text
RESTORE BACKUP <backupId>
```

Mismatches return `400`.

## Pre-Restore Backup Behavior

Before destructive restore, `restoreService` creates a pre-restore backup using the same selected allowlisted collections. The pre-restore backup ID is returned in the restore response and included in audit metadata.

## Dry-Run Behavior

`dryRun: true` verifies maintenance mode, lock availability, completed backup status, confirmation, checksum, decompression, manifest shape, allowlist, backup contents, and restore plan. It does not mutate the database and writes `SYSTEM_RESTORE_DRY_RUN`.

## Audit Logging

Restore writes `SYSTEM` audit logs:

- `SYSTEM_RESTORE_DRY_RUN`
- `SYSTEM_RESTORE_STARTED`
- `SYSTEM_RESTORE_COMPLETED`
- `SYSTEM_RESTORE_FAILED`

Audit metadata includes:

- `backup_id`
- `pre_restore_backup_id` when available
- `collections`
- `checksum_verified`
- `restored_counts`
- failure message when applicable

Backup payload data is never logged.

## Tests Added/Updated

Updated `src/tests/admin.test.js` to cover:

1. Auth guard.
2. Non-Super Admin forbidden.
3. Restore requires maintenance mode.
4. Restore requires valid completed backup.
5. Restore requires typed confirmation.
6. Dry-run validates artifact without mutation.
7. Checksum mismatch rejects restore.
8. Missing artifact rejects restore.
9. Malformed payload rejects restore.
10. Invalid collection rejects restore.
11. Concurrent backup/restore operations are blocked.
12. Pre-restore backup is created before destructive restore.
13. Successful restore mutates only allowlisted collections.
14. Restore audit logs are written.
15. Backup/history endpoints still pass.

## Commands Executed

```bash
cat /Users/theo/.codex/plugins/cache/claude-plugins-official/superpowers/6.1.1/skills/test-driven-development/SKILL.md
sed -n '1,360p' docs/superpowers/reports/2026-07-06-phase-9c-r-backup-architecture-review.md
sed -n '1,340p' docs/superpowers/reports/2026-07-06-phase-9c-backup-backend-foundation.md
sed -n '340,430p' docs/API_FRONTEND_READINESS_MAP.md
sed -n '1,120p' docs/CHANGELOG_LOCAL_SETUP.md
sed -n '1,220p' src/models/BackupJob.js
sed -n '1,280p' src/services/backupService.js
sed -n '1,220p' src/services/storageProvider.js
sed -n '1,220p' src/services/manifestService.js
sed -n '1,320p' src/tests/admin.test.js
sed -n '320,560p' src/tests/admin.test.js
npx jest --testPathPatterns=src/tests/admin --forceExit
npx jest --testPathPatterns=src/tests/admin --forceExit
npm test
npm start
PORT=3001 npm start
node --input-type=module -e "<authenticated Phase 9D restore smoke script>"
```

The first focused Admin run was the expected red run. The second focused Admin run passed after implementation.

## Verification Result

- Focused Admin tests passed: 36/36.
- Full backend tests passed: 11 suites, 175 tests.
- `npm start` on port 3000 reached MongoDB/Redis and exited because port 3000 was already occupied.
- `PORT=3001 npm start` booted successfully and printed the server ready banner.
- Authenticated smoke on port 3001 passed:
  - Login returned 200.
  - Maintenance enable returned 200.
  - Backup creation returned 201.
  - Dry-run restore returned 200 and `verified: true`.
  - Real restore returned 200.
  - Backup history included the pre-restore backup.
  - Maintenance disable returned 200.

## Dependencies Added

None. The implementation uses the existing transitive `bson` package already available through Mongo/Mongoose dependencies.

## Config Changes

None.

## Swagger And API Readiness Updates

Updated `swagger.yaml` with:

- `POST /api/admin/restore/{backupId}`
- `RestoreRequest`
- `RestoreResult`
- `RestoreResponse`

Updated `docs/API_FRONTEND_READINESS_MAP.md` to mark:

- `POST /api/admin/restore/:backupId` ready.
- Admin stubs reduced to zero.
- Backend test count updated to 175/175.

## Risks

- Restore remains synchronous and memory-buffered, so large production datasets should move to streaming/background execution.
- Backup artifacts are still unencrypted unless storage-level encryption is configured externally.
- Restore currently supports only the server allowlist: transformers, inspections, faults, and maintenances.
- Restore replaces selected collections from the artifact and should be used only during maintenance windows.
- Existing test output still includes known Mongoose duplicate-index warnings unrelated to this phase.
- Default local port 3000 may already be occupied by another backend process.

## Rollback Instructions

Remove the restore service and revert touched backend/docs files:

```bash
rm -f src/services/restoreService.js docs/superpowers/reports/2026-07-06-phase-9d-restore-backend-safety-layer.md
git checkout -- src/controllers/adminController.js src/models/BackupJob.js src/routes/adminRoutes.js src/services/backupService.js src/services/compressionService.js src/services/storageProvider.js src/tests/admin.test.js src/validators/adminValidator.js swagger.yaml docs/API_FRONTEND_READINESS_MAP.md docs/CHANGELOG_LOCAL_SETUP.md
```

No database migration is required. Local backup artifacts created during smoke/testing can be removed from the configured backup directory if desired.

## Next Phase Recommendation

Proceed to Phase 9E Admin Operations Frontend only after deciding how much restore UI exposure is appropriate. The UI should default to dry-run, require explicit typed confirmation for real restore, and surface pre-restore backup IDs and warnings clearly.
