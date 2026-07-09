# Phase 9C-R — Backup Architecture Review Before Restore

**Date:** 2026-07-06  
**Scope:** Documentation-only architecture review of Phase 9C backup foundation before Phase 9D restore work.  
**Status:** Review complete. No runtime backend or frontend code changed.

## Objective

Assess whether the Phase 9C backup architecture is safe enough to support a future restore implementation, identify risks, and define required fixes before Phase 9D Restore Backend Safety Layer begins.

## Files Inspected

- `docs/superpowers/reports/2026-07-06-phase-9c-backup-backend-foundation.md`
- `docs/superpowers/reports/2026-07-05-phase-9a-backup-restore-maintenance-readiness-audit.md`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `src/models/BackupJob.js`
- `src/services/backupService.js`
- `src/services/manifestService.js`
- `src/services/checksumService.js`
- `src/services/compressionService.js`
- `src/services/storageProvider.js`
- `src/services/maintenanceModeService.js`
- `src/controllers/adminController.js`
- `src/routes/adminRoutes.js`
- `src/validators/adminValidator.js`
- `src/tests/admin.test.js`
- `swagger.yaml`
- `.env.example`

## Files Modified

- `docs/superpowers/reports/2026-07-06-phase-9c-r-backup-architecture-review.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`

No runtime backend or frontend files were modified.

## Architecture Assessment

Phase 9C is a useful backup foundation, but it is not yet restore-ready without targeted hardening. It creates a durable job record, enforces maintenance mode, writes compressed backup artifacts, records metadata, stores a manifest, and logs backup lifecycle events. That is enough for backup creation/history and enough to start designing restore.

However, restore would be too risky if implemented directly against the current artifact without fixes. The main blockers are checksum semantics, user-controlled collection selection, missing restore allowlists, no artifact read/verify API in the storage provider, no active job lock, no pre-restore backup flow, and no dry-run validation.

## BackupJob Model Review

Strengths:

- Has a stable `backup_id`, filename, storage key, status, timestamps, creator, checksum, compression, encryption flag, size, collections, schema/app version, retention, metadata, manifest, and failure message.
- Status lifecycle supports `QUEUED`, `RUNNING`, `COMPLETED`, and `FAILED`.
- Indexes support status/history queries, creator queries, and retention lookup.
- Failed backups are persisted with `FAILED` status and `error_message`.

Gaps before restore:

- No restore-specific fields such as `restore_eligible`, `verified_at`, `artifact_checksum`, `manifest_checksum`, `source_environment`, or `pre_restore_backup_id`.
- No immutable/hash-protected job metadata. A future restore should not trust mutable DB metadata alone.
- Retention is metadata only; there is no expiry/deletion enforcement.
- `storage_key` is exposed in metadata. It is not a signed URL, but it may reveal local filesystem paths and should not be exposed to non-operational UI later.

## Manifest Review

Strengths:

- Contains backup ID, timestamp, schema version, app version, Mongo version when available, collections, document counts, checksum, compression, encryption flag, and creator ID.
- Collection inventory is generated from MongoDB and excludes `system.*` collections.
- Payload includes both manifest and collection data, so the artifact is portable in principle.

Restore gaps:

- Manifest does not include source database name, environment, collection restore policy, model/schema compatibility map, total document count, total uncompressed bytes, total compressed bytes, or per-collection checksums.
- Manifest does not include an artifact format version beyond `schema_version`.
- Manifest document counts are taken before data collection; there is no snapshot transaction or lock, so counts can drift if writes occur outside maintenance enforcement or from non-API writers.
- Optional `collections` are caller-selected and only filtered against existing collection names. That means a Super Admin can create partial backups. Partial backups are useful, but restore must treat them differently and require an explicit restore allowlist.

## Checksum Review

Current design:

- `checksumService` computes SHA-256.
- `backupService` computes the checksum over an intermediate gzip buffer that contains the manifest before checksum is inserted.
- Then it inserts that checksum into the manifest, rebuilds the payload, gzips again, and stores the second gzip buffer.

Verdict:

- The checksum does not currently protect the exact stored artifact bytes. It protects an earlier compressed representation.
- This is acceptable for Phase 9C metadata proof, but it must be fixed before restore.

Required correction before restore:

- Compute and store an `artifact_checksum` over the final stored bytes.
- Optionally store a separate `manifest_checksum` over canonical manifest JSON.
- Restore must download/read the artifact, recompute `artifact_checksum`, and reject mismatches before decompression or mutation.

## Compression Review

Strengths:

- Uses standard gzip through Node `zlib`.
- Manifest records `compression: gzip`.
- Payload is JSON plus gzip, so future restore can parse it without proprietary tooling.

Gaps:

- No decompression helper yet.
- No compression ratio or uncompressed size in metadata.
- Synchronous whole-buffer compression is risky for large databases.

Recommendation:

- Add `gunzip` support in Phase 9D.
- Include uncompressed byte size and final compressed byte size.
- Move to streaming or background-job backup before production-scale datasets.

## Storage Review

Strengths:

- Server generates filenames with `backup_id` plus sanitized backup name.
- Local writes use `flag: 'wx'`, avoiding accidental overwrite.
- Default local storage is isolated under `/tmp/kvassettracker-backups`.
- MinIO/S3-compatible storage can be used when configured.
- Backup history exposes no download or signed URL.

Risks and gaps:

- `BACKUP_LOCAL_DIR` is environment-controlled and not constrained to an application-owned base path.
- `storageProvider` does not yet implement read/get methods needed for restore.
- MinIO object names use `BACKUP_PREFIX` without sanitization. Since this is environment-configured rather than user-controlled, it is lower risk, but should still be normalized.
- No server-side encryption or object-lock/retention enforcement.
- Local `storage_key` is an absolute path and appears in API metadata.

Path traversal verdict:

- User-controlled filename input is constrained by Joi and sanitized again in `backupService`, and `backup_id` is server-generated. Direct path traversal through backup name is effectively blocked.
- Restore must not accept arbitrary filenames, filesystem paths, or user-provided storage keys. It should resolve artifacts only through a trusted `BackupJob` by `backup_id`.

## Collection Inventory Accuracy

The inventory is accurate enough for metadata and small controlled backups, but not enough for guaranteed restore consistency:

- Collection names come from MongoDB at backup time.
- `system.*` collections are excluded.
- Counts are generated before collection data is read.
- No snapshot/session transaction is used.
- API maintenance mode blocks normal API writes, but it cannot stop direct database writes, background jobs, or external processes.

Phase 9D should verify document counts after reading payload and treat manifest counts as validation inputs, not absolute truth.

## Restore Compatibility

The current artifact can be restored in principle because it contains:

- A manifest.
- Collection names.
- Serialized documents.
- Compression metadata.
- Schema/app/Mongo version metadata.

But Phase 9D should not proceed with mutation until it adds:

- Artifact read support.
- Final artifact checksum verification.
- Decompression.
- JSON payload validation.
- Manifest schema validation.
- Restore allowlist.
- Maintenance mode prerequisite.
- Active job lock.
- Pre-restore backup.
- Typed confirmation.
- Dry-run validation.

## Maintenance Mode Enforcement

Strengths:

- Backup creation calls `MaintenanceModeService.getState({ useCache: false })`.
- If maintenance mode is disabled, backup returns `409` with a clear message.
- Admin maintenance endpoints remain available.

Gaps:

- Maintenance mode blocks API writes, but direct DB writers and job workers are not coordinated.
- Backup can still run concurrently with another backup because there is no active job lock.
- Restore will need stricter operation locking than backup creation currently has.

## Audit Trail Review

Strengths:

- Backup lifecycle logs:
  - `SYSTEM_BACKUP_STARTED`
  - `SYSTEM_BACKUP_COMPLETED`
  - `SYSTEM_BACKUP_FAILED`
- Audit entries include backup ID, status, and filename.
- Payload contents and secrets are not logged.

Gaps:

- Audit does not include artifact checksum, size, storage provider, collection count, or failure class.
- Restore will need separate requested/started/completed/failed logs, typed-confirmation metadata, pre-restore backup ID, and verified checksum metadata.

## Failure Handling

Strengths:

- Failures after job creation mark the job `FAILED`.
- `error_message` is persisted.
- `SYSTEM_BACKUP_FAILED` is logged.
- Tests cover a storage failure path.

Gaps:

- Failures before `BackupJob.create()` are not represented as failed jobs.
- Storage artifacts may be orphaned if failure occurs after write but before job save.
- No retry/cleanup model exists.

## Concurrency And Locking Risk

Current backup can run while another backup is running. This is acceptable for a foundation phase but not acceptable before restore.

Required before Phase 9D mutation:

- Add a lock or guard preventing concurrent `RUNNING` backup/restore jobs.
- Prefer a durable MongoDB lock with expiry/heartbeat fields.
- Tests should prove a second backup or restore request is rejected while an operation is active.

## Large Database Risk

The current implementation loads all documents into memory, serializes them into one JSON buffer, gzips that buffer, rebuilds another JSON buffer with checksum, and gzips again. This is fine for local MVP data but not production scale.

Before production restore:

- Move to streaming export/import or `mongodump`/`mongorestore` style artifacts.
- Enforce backup size limits.
- Run backup/restore as background jobs rather than request-response work.

## Sensitive Data Exposure Risk

Backups include raw database contents, which may include:

- User records.
- Tokens or token-like metadata if stored in collections.
- GPS coordinates.
- Audit details.
- Operational asset data.

Current API does not expose download URLs, but local backup files are unencrypted. Backups must be treated as highly sensitive.

Required before production:

- Encrypt backup artifacts or store only in encrypted object storage.
- Restrict download/restore access to Super Admin with typed confirmation and audit logging.
- Avoid showing local storage paths in frontend UI.

## Key Questions Answered

**Can Phase 9D safely restore from the current backup artifact?**  
Not without fixes. The artifact is structurally restorable, but the checksum does not verify the final stored artifact, collection selection is not restore-policy controlled, and there is no artifact read/verify/decompress path yet.

**Does the manifest contain enough information for restore validation?**  
It contains the basics, but not enough for high-confidence restore. Add artifact checksum, per-collection validation metadata, total counts/bytes, source database/environment, and restore policy metadata.

**Does the checksum protect the right artifact?**  
No. It currently protects an intermediate compressed buffer, not the final stored bytes.

**Are collection names allowlisted or user-controlled?**  
They are user-selected and filtered against current MongoDB collections. Restore must introduce an explicit server-side allowlist.

**Are backup filenames/storage keys server-generated and safe?**  
Mostly yes. Backup filenames include server-generated backup IDs and sanitized names. Local storage keys are server-built. `BACKUP_PREFIX` should be normalized for MinIO.

**Are failed backups safely recorded?**  
Yes for failures after job creation. They are marked `FAILED`, store an error message, and write audit logs.

**Can backup run while another backup is running?**  
Yes. There is no active job lock.

**Should backup creation remain synchronous?**  
Only for MVP/local datasets. It should become queued/background work before production-scale use.

**What must be fixed before restore begins?**  
Final artifact checksum, restore allowlist, storage read support, decompression, manifest validation, typed confirmation, pre-restore backup, operation lock, and dry-run tests.

## Restore-Readiness Verdict

**Recommendation: proceed with Phase 9D design work, but do not implement destructive restore mutation until the required fixes below are part of Phase 9D.**

The Phase 9C foundation is good enough to build on. It is not good enough to trust for direct restore yet.

## Required Fixes Before Phase 9D

1. Compute checksum over the final stored artifact bytes.
2. Add artifact read support to `storageProvider`.
3. Add gzip decompression support.
4. Validate parsed payload shape and manifest before any database mutation.
5. Add a server-side restore collection allowlist.
6. Add active operation locking for backup/restore.
7. Require maintenance mode for restore.
8. Require typed confirmation containing the backup ID and a destructive-action phrase.
9. Create a pre-restore backup before mutating data.
10. Add dry-run validation endpoint or mode before destructive restore.
11. Add tests for checksum mismatch, missing artifact, malformed payload, incompatible manifest, concurrent job blocking, and restore remaining impossible without typed confirmation.

## Nice-To-Have Improvements

- Add per-collection checksums and byte counts.
- Add source database/environment metadata.
- Add encryption support.
- Add artifact retention cleanup.
- Add background queue execution.
- Add restore preview summary.
- Hide or redact local absolute `storage_key` from future UI-facing responses.
- Normalize `BACKUP_PREFIX` for MinIO object keys.
- Add optional backup size limits.

## Security Risks

- Backup artifacts are unencrypted.
- Backup artifacts contain sensitive operational data and likely user/security data.
- `storage_key` can reveal local filesystem paths.
- Collection selection can produce partial backups that are unsafe for full restore.
- No restore-time typed confirmation or re-authentication exists yet.

## Data-Loss Risks

- Restoring partial backups could break references.
- No active operation lock means backup/restore overlap could corrupt assumptions.
- No pre-restore backup yet.
- No dry-run validation yet.
- No transaction/rollback strategy yet.
- Schema/app version mismatch handling is not enforced.

## Commands Executed

```bash
sed -n '1,360p' docs/superpowers/reports/2026-07-06-phase-9c-backup-backend-foundation.md
sed -n '1,380p' docs/superpowers/reports/2026-07-05-phase-9a-backup-restore-maintenance-readiness-audit.md
sed -n '340,410p' docs/API_FRONTEND_READINESS_MAP.md
sed -n '1,90p' docs/CHANGELOG_LOCAL_SETUP.md
sed -n '1,240p' src/models/BackupJob.js
sed -n '1,280p' src/services/backupService.js
sed -n '1,240p' src/services/manifestService.js
sed -n '1,220p' src/services/storageProvider.js
sed -n '1,120p' src/services/checksumService.js
sed -n '1,120p' src/services/compressionService.js
sed -n '1,260p' src/services/maintenanceModeService.js
sed -n '1,260p' src/controllers/adminController.js
sed -n '1,180p' src/routes/adminRoutes.js
sed -n '1,180p' src/validators/adminValidator.js
sed -n '330,540p' src/tests/admin.test.js
sed -n '1,100p' .env.example
rg -n "/admin/backup|/admin/backups|BackupRequest|BackupJob|BackupResponse|BackupListResponse|restore" swagger.yaml
grep -R "backup" -n src/models src/services src/controllers src/routes src/tests
grep -R "restore" -n src/models src/services src/controllers src/routes src/tests
grep -R "checksum" -n src/services src/models src/tests
grep -R "manifest" -n src/services src/models src/tests
npm test
git status --short
```

## Verification Result

Backend tests passed after this documentation-only review:

- 11 test suites passed.
- 164 tests passed.

## Rollback Instructions

This review changed documentation only. To roll back Phase 9C-R:

```bash
rm -f docs/superpowers/reports/2026-07-06-phase-9c-r-backup-architecture-review.md
git checkout -- docs/CHANGELOG_LOCAL_SETUP.md
```

No database, runtime, or frontend rollback is required.
