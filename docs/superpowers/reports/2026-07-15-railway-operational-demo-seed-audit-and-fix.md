# Railway Operational Demo Seed — Audit and Fix Report

**Date:** 2026-07-15  
**Project:** Railway `sunny-creation`, production environment  
**Railway execution:** Dry-run and live gate completed under separate authorization on 2026-07-16  
**Commit/push:** Not performed; not authorized

## Audit conclusion

The Railway dashboard was empty because the preview contained all 11 Phase 9F users, three territories, and five service areas but no operational records. Read-only inspection found 0 districts, feeders, transformers, inspections, faults, maintenance records, QR codes, and notifications. There were 3 audit logs, 2 sessions, and 2 refresh tokens. No operational records existed behind a status, territory, date, soft-delete, pagination, or authorization filter.

The frontend dashboard calls the real module APIs: transformer stats/list, open faults, overdue inspections, and upcoming maintenance. The backend derives overdue inspections from transformer `last_inspection_date` older than 90 days and upcoming maintenance from `next_maintenance_date` in the next 30 days. Therefore reference/user seeding alone could never populate the dashboard.

### Existing seeder assessment

- `seedRailwayPhase9FReferences.js` is narrow and suitable for its three-territory/five-service-area responsibility.
- `seedRailwayDemoUsers.js` requires an explicit URI but intentionally owns passwords, lock/reset state, embedded/external sessions, roles, assignments, and active intent; it is not an operational seeder.
- `phase9fSeedData.js` is unsafe for the existing Railway preview: it can fall back to localhost, removes/recreates Phase 9F data, touches broad operational/system collections, assumes a disposable validation database, and contains a now-invalid inspection load value.
- `resetDemoPasswords.js` intentionally mutates authentication state and must not be used for this operational task.

## Rejected artifact disposition

The wrong concurrent agent removed the untracked rejected implementation and its untracked inspection report before quarantine could be preserved. The recovered worktree therefore contains neither a quarantine artifact nor the inspection report. They were not reconstructed.

The fresh implementation was written from the approved design supplied in task context after the required initial missing-module test failure; the rejected implementation was not used as source.

## Implementation

`scripts/seedRailwayPhase9FOperationalData.js` reconciles only:

| Collection | Canonical records |
|---|---:|
| districts | 5 (`P9FR-D01`–`D05`) |
| feeders | 7 (`P9FR-F01`–`F07`) |
| transformers | 15 (`P9FR-TX-001`–`015`) |
| inspections | 20 exact `P9FR-INS-NNN` narrative markers |
| faults | 7 exact `P9FR-FLT-NNN` description markers |
| maintenances | 8 exact `P9FR-WO-NNN` work orders |

Transformer status distribution is 8 Active, 3 Faulty, 2 Under Maintenance, 1 Decommissioned, and 1 Unverified. Ratings use only values accepted by the active schema/API contract. Relative dates are anchored to the current UTC day, keeping overdue and upcoming widgets useful over time.

Before any normal write, the seeder validates the explicit URI, all three territories, five correctly parented service areas, all 11 users with expected roles/assignments/active intent, active operational users, every canonical match, every parent/child relationship, duplicate keys, and candidate Mongoose validation. Dry-run connects with automatic index and collection creation disabled.

Existing canonical documents are patched only at the exact owned leaf paths documented in the implementation plan. `_id`, `created_at`, manual metadata, unknown nested fields, and manually appended inspection/fault narrative suffixes are preserved. Users, territories, and service areas are never saved.

## Database impact

### Read

`users`, `territories`, `serviceareas`, `districts`, `feeders`, `transformers`, `inspections`, `faults`, `maintenances`.

### May write in normal mode

Only exact canonical records in `districts`, `feeders`, `transformers`, `inspections`, `faults`, and `maintenances`.

### Never written

`users`, `territories`, `serviceareas`, `qrcodes`, `notifications`, `auditlogs`, `sessions`, `refreshtokens`, backup/import/export/maintenance-mode collections, and unrelated records.

Local/test lifecycle summaries:

```text
Dry-run:        WOULD_CREATE=62 WOULD_UPDATE=0 WOULD_SKIP=0 FAILED=0
First run:      CREATED=62 UPDATED=0 SKIPPED=0 FAILED=0
Same-day rerun: CREATED=0 UPDATED=0 SKIPPED=62 FAILED=0
Later-day:      CREATED=0 UPDATED=50 SKIPPED=12 FAILED=0
```

Railway live lifecycle:

```text
Pre-live:       districts=0 feeders=0 transformers=0 inspections=0 faults=0 maintenances=0
First live run: CREATED=62 UPDATED=0 SKIPPED=0 FAILED=0
Same-day rerun: CREATED=0 UPDATED=0 SKIPPED=62 FAILED=0
Post-live:      districts=5 feeders=7 transformers=15 inspections=20 faults=7 maintenances=8
```

All checked orphan counts were zero. Authentication state matched its pre-live fingerprint exactly.

## API acceptance

With the local/test dataset and then the live Railway dataset present, a mutation-free short-lived Super Admin JWT received non-zero coherent responses from:

- `/api/transformers/stats`, `/api/transformers`, and `/api/transformers/search`;
- `/api/faults/open` and `/api/faults`;
- `/api/inspections/overdue` and `/api/inspections`;
- `/api/maintenance/upcoming` and `/api/maintenance`;
- transformer, inspection, fault, maintenance, and asset-register JSON report endpoints.

Map-compatible transformer results include valid point coordinates. The API test signs a token directly and does not log in or mutate the Super Admin.

Live API evidence:

- Dashboard: 15 transformers, 8 active, 4 faulty, 4 open faults, 5 overdue inspections, and 4 upcoming maintenance records.
- Modules: 15 transformers, 20 inspections, 7 faults, and 8 maintenance records.
- Map: all 15 operational transformers returned coordinates.
- Reports: transformer 15, inspection 20, fault 7, maintenance 8, and asset-register 15.

### Why the dashboard reports four faulty transformers

The canonical `operational_status` distribution remains 8 Active, 3 Faulty, 2 Under Maintenance, 1 Decommissioned, and 1 Unverified. The dashboard's `faulty` value is intentionally a different operational measure.

`DashboardPage.normalizeStatusCounts()` maps its “Faulty” row directly from `transformerApi.stats().faulty`. The API route calls `TransformerController.getStats()`, which passes the request to `TransformerService.getStatistics()`. That aggregation counts `faulty` with:

```text
has_open_fault == true
```

It does not filter only `operational_status == "Faulty"` and does not group all non-active statuses together. The four canonical transformers with open faults are:

- `P9FR-TX-002` — Faulty;
- `P9FR-TX-005` — Faulty;
- `P9FR-TX-008` — Faulty;
- `P9FR-TX-011` — Under Maintenance, with an open fault.

The fourth value is therefore `P9FR-TX-011`. Open-fault exposure and lifecycle status overlap by design, which is also reflected by the Asset Map's “Faulty with GPS” logic (`operational_status === "Faulty" || has_open_fault`). The Transformers page labels the same statistic “Faulty or critical.” No statistics code change was made because the value is consistent with the backend contract and the live open-fault total of four.

## Final UI data-binding review

Dashboard, Transformers, and Asset Map already use the seeded business fields and required no code change. Three binding gaps were confirmed elsewhere:

- Inspection list responses populated only the inspector, so `transformer_id` remained an ObjectId and the table could not display asset ID, site, or territory.
- Fault list/detail responses populated the transformer but not its nested operational references, so territory rendering received a raw ObjectId.
- Maintenance list responses already populated `technician_id`, but the page read only the optional legacy `technician_name` field.

The inspection and fault controllers now populate the transformer plus nested territory, service-area, and feeder business references for list/detail responses. Maintenance now renders the populated technician name/email with legacy-name fallback. The focused authenticated API test verifies canonical inspections and faults include linked transformer/reference values and canonical maintenance includes a populated technician identity.

The local legacy browser fixture contains maintenance references whose user documents no longer exist; “Not assigned” remains correct for those orphaned local-only rows. Railway canonical orphan checks were zero, and the canonical API acceptance assertion resolves technician names without changing seed data.

## Validation results

- Syntax: passed.
- Focused operational suite: 24/24 passed.
- Related suites: references 9/9, demo users 9/9, transformers 30/30, inspections 14/14, faults 20/20, analytics 7/7, auth 9/9.
- Frontend build: passed; existing Vite chunk-size warning remains.
- Full backend final result: 18/18 suites and 262/262 tests passed with `SMTP_HOST=`.
- Frontend production build: passed with 1,736 modules transformed; the existing chunk-size warning remains.

The first full run exposed shared local-database fixture interference, not a production failure: 16/18 suites and 257/262 tests passed. The new suite was moved to a dedicated test database and the two interacting suites then passed together, 33/33. No existing test assertion was weakened.

## Dependencies and configuration

Dependencies added: **None**.

Production/Railway configuration changes: **None**. Test-only configuration uses a dedicated local MongoDB `dbName` and the repository-established `SMTP_HOST=` override.

## Risks

- **Rerun/date drift:** same-day runs skip; later UTC days intentionally update 50 owned date-bearing records.
- **Schema evolution:** future required fields or enum changes cause preflight/save failure and a non-zero exit.
- **Partial failure:** earlier successful records remain; exact-key rerun is recovery. There is no transaction assumption.
- **Rollback:** no automatic deletion is provided, so live rollback requires an approved exact inventory.
- **Manual edits:** owned fields are reconciled; non-owned fields and narrative suffixes are preserved.
- **Future real data:** real records must not reuse `P9FR-*` keys. Mixing demo and real data in one preview database complicates later ownership decisions.

## Rollback

### Code and documentation

Because nothing is committed, review and remove only the files/sections listed in this report. After any later approved commit, create a Git revert commit; do not use destructive reset commands.

### Railway demo records

No rollback was required because both live runs completed with `FAILED=0`. If a future separately approved rollback is required:

1. Perform a read-only inventory of exact work orders, fault markers, inspection markers, transformer asset IDs, feeder codes, and district codes.
2. Reconcile that inventory with the live `CREATED` versus `UPDATED` summary.
3. With separate approval, remove only records proven created by the run, child-first: maintenance, faults, inspections, transformers, feeders, districts.
4. Never remove pre-existing updated records, users, references, sessions, refresh tokens, audit logs, notifications, QR codes, or unrelated records.
5. Never use a broad prefix or collection-wide deletion.

## Executed Railway command

The repository-established, secret-safe dry-run proposal is:

```bash
railway run --service MongoDB sh -c \
  'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FOperationalData.js --dry-run'
```

The dry-run completed with `WOULD_CREATE=62 WOULD_UPDATE=0 WOULD_SKIP=0 FAILED=0`. The corresponding live command was then executed under separate authorization and met both required live and same-day rerun summaries.
