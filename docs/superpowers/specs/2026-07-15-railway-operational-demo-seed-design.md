# Railway-Safe Phase 9F Operational Demo Seed — Audit and Design

**Date:** 2026-07-15
**Status:** Approved and implemented
**Railway project:** `sunny-creation`
**Railway environment:** `production`
**Implementation status:** Complete
**Railway completion:** The design was approved, implementation completed, the Railway dry-run was separately approved, and the Railway live write was separately approved. The first live run created 62 canonical records and the same-UTC-day rerun skipped all 62. No authentication or configuration mutation occurred.

## 1. Objective

Add a narrow, model-backed, idempotent operational demo seeder for the existing Railway Phase 9F preview dataset. The result must populate the live dashboard and the transformer, inspection, fault, maintenance, asset-map, and supported report workflows without changing authentication, demo credentials, existing sessions, existing refresh tokens, unrelated data, or production configuration.

This design is based on repository evidence and a secret-safe, read-only inspection of the linked Railway production database.

## 2. Audit conclusion

The Railway dashboard is empty because the production database contains the expected Phase 9F users and location references but contains no operational records. This is a missing-data problem, not a frontend hardcoding issue, authorization failure, relationship-corruption issue, soft-delete issue, or status/date-filter mismatch.

The existing Railway seed sequence created:

- 11 Phase 9F demo users;
- 3 Phase 9F territories; and
- 5 Phase 9F service areas.

It did not create districts, feeders, transformers, inspections, faults, maintenance records, or QR records. Every operational dashboard query therefore correctly returns zero or an empty list.

## 3. Railway read-only audit

The linked project and environment were confirmed as `sunny-creation / production`, with the expected `TrafoLog`, `imaginative-art`, `MongoDB`, and `Redis` services.

The database inspection used only count, canonical-key, status/date-bucket, and orphan-detection queries. It did not print or retain database URLs, passwords, password hashes, access tokens, refresh tokens, JWT secrets, cookies, or private credentials.

### 3.1 Current collection counts

| Mongoose collection | Count |
|---|---:|
| `users` | 11 |
| `territories` | 3 |
| `districts` | 0 |
| `serviceareas` | 5 |
| `feeders` | 0 |
| `transformers` | 0 |
| `inspections` | 0 |
| `faults` | 0 |
| `maintenances` | 0 |
| `qrcodes` | 0 |
| `notifications` | 0 |
| `auditlogs` | 3 |
| `sessions` | 2 |
| `refreshtokens` | 2 |

### 3.2 Phase 9F prerequisites

- All 11 expected Phase 9F demo users exist.
- Ten demo users are active.
- The intentionally inactive viewer remains inactive.
- Role counts are one Territory Manager, one Super Admin, two Engineers, five Field Technicians, and two Viewers.
- Territories `P9FC`, `P9FE`, and `P9FW` exist.
- Service areas `P9FSA1` through `P9FSA5` exist.
- No Phase 9F feeders exist.
- No Phase 9F transformers exist.

### 3.3 Query-exclusion and integrity results

- No transformer records exist under another status or ownership shape.
- No transformers, inspections, or maintenance records are excluded by soft-delete filters.
- Active/open fault count is zero because `faults` is empty.
- Overdue transformer count is zero because `transformers` is empty.
- Upcoming maintenance count is zero because `maintenances` is empty.
- All orphan counts are zero because the affected child collections are empty.

## 4. Existing seed architecture assessment

### 4.1 `scripts/seedRailwayPhase9FReferences.js`

**Creates or updates:**

- territories `P9FC`, `P9FE`, and `P9FW`;
- service areas `P9FSA1` through `P9FSA5`.

**Deletes:** Nothing.

**Safety properties:**

- requires explicit `MONGODB_URI`;
- has no localhost fallback;
- reconciles by stable code;
- preserves document identity and unrelated metadata;
- uses Mongoose validation;
- reports `CREATED`, `UPDATED`, `SKIPPED`, and `FAILED`.

**Assessment:** Railway-safe for its documented narrow responsibility. It has no dry-run mode, but it is not responsible for operational data.

### 4.2 `scripts/seedRailwayDemoUsers.js`

**Creates or updates:** Exactly 11 documented Phase 9F demo users.

**Deletes or resets:**

- deletes external `RefreshToken` records for each demo user;
- deletes external `Session` records for each demo user;
- clears embedded refresh tokens;
- resets passwords, login attempts, lock state, and password-reset state.

**Safety properties:**

- requires explicit `MONGODB_URI`;
- has no localhost fallback;
- validates reference dependencies;
- preserves unrelated users.

**Limitations:** Every rerun rewrites the password and returns `UPDATED`, so it is not a no-op idempotent reconciler. Its authentication and session behavior is intentional for initial demo-user setup but is explicitly outside the operational seed scope.

**Assessment:** Appropriate only for its documented user-seeding workflow. The operational seeder must not invoke it or reproduce its user/session mutations.

### 4.3 `scripts/phase9fSeedData.js`

**Creates:**

- 3 territories;
- 6 service areas;
- 12 feeders;
- 6 districts;
- transformer rating references;
- 11 users;
- 50 transformers;
- 180 inspections;
- 40 faults;
- 80 maintenance records;
- 330 audit logs;
- 90 notifications; and
- backup-history fixtures through the real backup service.

**Deletes before reseeding:**

- Phase 9F notifications;
- Phase 9F audit logs;
- maintenance, faults, and inspections related to Phase 9F transformers;
- Phase 9F transformers;
- Phase 9F backup jobs; and
- Phase 9F users.

**Other mutations:**

- enables and disables maintenance mode;
- creates backup artifacts;
- recreates passwords and demo users;
- prints the demo password and complete credential block.

**Targeting:** Uses `MONGODB_URI` when present but silently falls back to `mongodb://localhost:27017/kVAssetTracker`.

**Current-schema conflict:** It creates inspection load percentages of `110` for overload examples, while the active Mongoose and Joi validation permit a maximum of `100`.

**Assessment:** A disposable-local validation dataset builder. It is not Railway-safe and must remain explicitly prohibited for the preview database.

### 4.4 `scripts/resetDemoPasswords.js`

**Updates:** All 11 Phase 9F demo users, including password, lock state, password-reset state, login attempts, and embedded refresh tokens.

**Targeting:** Silently falls back to localhost.

**Output:** Prints the password.

**Assessment:** Local recovery utility only. It must not be used by the operational seeder or run against Railway for this task.

### 4.5 `src/scripts/seed.js`

**Creates or updates:** General territories, service areas, feeders, districts, transformer ratings, a general administrator, and up to two demo transformers.

**Limitations:**

- silently falls back to localhost;
- has broad reference-data responsibility;
- skips all demo transformers when any transformer already exists;
- generates transformer identifiers based on existing maximum values;
- contains overlapping legacy reference codes;
- is not scoped to the Phase 9F Railway dataset.

**Assessment:** General/local bootstrap utility, not a Railway operational reconciler.

### 4.6 `scripts/phase9fValidateApiWorkflows.js`

This is an end-to-end validation runner, not a seed utility. It exercises authentication, CRUD, maintenance mode, backup, restore, reports, and other API workflows. It creates and mutates operational records and system state through the application.

**Assessment:** Useful after local setup, but unsafe as a production seed mechanism.

## 5. Active data model and relationships

### 5.1 Reference relationships

- `Territory` has unique `name` and unique `code`.
- `ServiceArea.territory_id` is required and references `Territory`.
- `Feeder.service_area_id` is required and references `ServiceArea`.
- `District` is independent; the active schema has no territory reference.
- A transformer links territory and district independently.

The requested conceptual territory-to-district mapping does not exist in the active schema. The new dataset will distribute transformers coherently across both references without inventing a district schema field.

### 5.2 Transformer

Required active-schema fields include unique `asset_id` and `network_voltage_kv`. The operational implementation will also supply the API-required identity, rating, location, GPS, and installation fields.

Relevant enums are:

- `record_status`: `Draft`, `Verified`, `Active`;
- `operational_status`: `Active`, `Faulty`, `Under Maintenance`, `Decommissioned`, `Unverified`;
- `network_voltage_kv`: `11`, `33`;
- `voltage_secondary`: `415V`, `240V`, `Other`;
- `phase_type`: `Single Phase`, `Three Phase`;
- `cooling_type`: `ONAN`, `ONAF`, `OFAF`;
- `mounting_type`: `Pole Mounted`, `Plinth`, `Ground`, `Indoor Substation`.

Transformers soft-delete through `is_deleted`. Dashboard and list queries require `is_deleted: false`.

There is no transformer assigned-users array. User relationships are expressed through `created_by`/`updated_by` and related operational records.

### 5.3 Inspection

Required relationships and fields are:

- `transformer_id` → `Transformer`;
- `inspector_id` → `User`;
- `inspection_date`.

Inspection dates cannot be in the future through the API validator. The schema has no scheduled/upcoming state and no completion status. An inspection document represents a performed inspection.

The overdue dashboard endpoint does not query old inspection documents directly. It queries transformers whose `last_inspection_date` is missing or older than 90 days.

Therefore this implementation can demonstrate completed inspections and overdue transformers, but it cannot truthfully create upcoming inspection records without a product/schema change. No such schema change is proposed.

### 5.4 Fault

Required relationships and fields are:

- `transformer_id` → `Transformer`;
- `reported_by` → `User`;
- `fault_date`;
- `fault_description`;
- `severity`.

Optional relationships include `inspection_id`, `assigned_to`, and `resolved_by`.

Valid statuses are `Open`, `Assigned`, `In Progress`, `Resolved`, and `Closed`. Dashboard-active faults are exactly `Open`, `Assigned`, or `In Progress`.

### 5.5 Maintenance

Required relationships and fields are:

- `transformer_id` → `Transformer`;
- `technician_id` → `User`;
- `maintenance_date`;
- `maintenance_type`.

Valid maintenance types are `Preventive`, `Corrective`, and `Emergency`.

The active schema has no maintenance status or assigned-user field. Maintenance documents represent performed work and may include `next_maintenance_date`. The dashboard considers records upcoming only when `next_maintenance_date` falls between execution time and 30 days later.

An in-progress operational scenario can be represented by transformer status `Under Maintenance`, but the seeder will not invent a maintenance lifecycle field.

### 5.6 QR codes, notifications, audit logs, and reports

- `QRCode.transformer_id` is unique and references a transformer.
- The existing QR service generates a QR record on demand for a transformer.
- Notifications require a user and are not required by the dashboard or operational lists.
- Audit logs require a user and are not required for operational browsing.
- No persistent `Report` model exists. Reports query transformers, inspections, faults, and maintenance directly.

The operational seeder will not manufacture QR records, notifications, or audit history. It will preserve the existing authentication audit logs and allow the QR service to generate records only when a user requests a QR code.

### 5.7 Sessions and refresh tokens

Sessions and refresh tokens are authentication artifacts. The operational seeder will not import, query for reconciliation, update, or delete them. The current two sessions and two refresh tokens will be preserved.

## 6. Dashboard and module query map

The current frontend dashboard does not use the broader `/api/dashboard/*` endpoints for its visible widgets. It composes the dashboard from the operational module APIs below.

| Widget | Frontend source | Endpoint | Backend handler | Collection and filter | Railway zero reason |
|---|---|---|---|---|---|
| Total transformers | `frontend/src/pages/dashboard/DashboardPage.tsx` via `transformerApi.stats` | `GET /api/transformers/stats` | `TransformerController.getStats` → `TransformerService.getStatistics` | `transformers`, `is_deleted=false` | Collection empty |
| Transformers by status | Same | `GET /api/transformers/stats` | Same | Counts active/maintenance/decommissioned status fields, draft records as unverified, and `has_open_fault=true` as faulty exposure | Collection empty |
| Active/open faults | Same via `faultApi.open` | `GET /api/faults/open` | `FaultController.getOpen` → `FaultService.getOpenFaults` | `faults`, status in `Open`, `Assigned`, `In Progress` | Collection empty |
| Overdue inspections | Same via `inspectionApi.overdue` | `GET /api/inspections/overdue` | `InspectionController.getOverdue` → `InspectionService.getOverdueInspections` | Non-deleted transformers with missing or >90-day `last_inspection_date` | Transformer collection empty |
| Upcoming maintenance count | Same via `maintenanceApi.upcoming` | `GET /api/maintenance/upcoming` | `MaintenanceController.getUpcoming` → `MaintenanceService.getUpcomingMaintenance` | Non-deleted maintenance with `next_maintenance_date` in `[now, now+30 days]` | Collection empty |
| Recent transformers | Same via `transformerApi.list` | `GET /api/transformers` | `TransformerController.getAll` → `TransformerService.searchTransformers` | Non-deleted transformers, newest first | Collection empty |
| Recent/open faults | Same via `faultApi.open` | `GET /api/faults/open` | Same open-fault path | Active statuses, newest first | Collection empty |
| Upcoming maintenance list | Same via `maintenanceApi.upcoming` | `GET /api/maintenance/upcoming` | Same upcoming path | Upcoming 30-day window | Collection empty |

The Super Admin is authorized for every endpoint and receives global data because no territory restriction is applied to that user.

### 6.1 Main module pages

- Transformers uses `GET /api/transformers/search` and `GET /api/transformers/stats`.
- Inspections uses `GET /api/inspections`.
- Faults uses `GET /api/faults`.
- Maintenance uses `GET /api/maintenance`.
- Asset Map uses `GET /api/transformers/search?limit=500` and optional nearby search.
- Reports query transformer, inspection, fault, maintenance, and asset-register report endpoints backed by the same four operational collections.

Valid coordinates and complete parent references are sufficient for the requested browsing experience.

## 7. Approaches considered

### 7.1 Dedicated operational reconciler — recommended

Create `scripts/seedRailwayPhase9FOperationalData.js`. It validates existing reference/user dependencies and reconciles only explicitly owned operational records.

**Advantages:**

- narrow collection scope;
- independent dry-run behavior;
- explicit database targeting;
- exact ownership keys;
- no authentication changes;
- clear partial-recovery behavior;
- focused tests can cover every safety property.

**Trade-off:** The script contains a deliberately explicit canonical dataset and reconciliation engine.

### 7.2 Refactor the broad Phase 9F seed

Separate deletion, users, references, backups, maintenance mode, audit logs, notifications, and operational data into selectable phases.

**Advantages:** Reuses more local fixture definitions.

**Disadvantages:** Much larger change, risks the established local validation workflow, and still requires substantial new dry-run and ownership logic.

### 7.3 Seed through public APIs

Authenticate and create the dataset through existing routes and services.

**Advantages:** Exercises API validators and service side effects.

**Disadvantages:** Requires credentials and a running deployment, creates timeline/notification side effects, complicates canonical idempotency, and makes interrupted recovery dependent on API availability.

### 7.4 Selected approach

Use the dedicated operational reconciler. It is the smallest solution consistent with the established Railway reference and user seed architecture.

## 8. Proposed operational dataset

The exact specifications will be encoded as deterministic constants in the dedicated script.

### 8.1 References created by the operational seeder

- 5 Phase 9F Railway districts, corresponding to the existing service-area towns;
- 7 Phase 9F Railway feeders distributed across all five service areas.

The seeder will not create or update territories or service areas. It will require the existing canonical records and fail before operational writes if they are unavailable or inconsistent.

### 8.2 Transformers

Create 15 fictional transformers distributed across all three territories and five service areas, with valid districts, feeders, GPS coordinates, ratings, voltages, installation dates, manufacturers, and varied sites.

Proposed status mix:

| Operational status | Count |
|---|---:|
| `Active` | 8 |
| `Faulty` | 3 |
| `Under Maintenance` | 2 |
| `Decommissioned` | 1 |
| `Unverified` | 1 |

The unverified record will use `record_status: Draft`; other records will use current valid record statuses. Faulty records will have active related faults and `has_open_fault: true`. Other records will remain internally consistent.

### 8.3 Inspections

Create approximately 20 performed inspections across different transformers and active inspectors, including Good, Fair, Poor, and Critical conditions and varied recommended actions.

Transformer `last_inspection_date` values will be reconciled to the relevant latest inspection dates. Several active transformers will have latest inspection dates more than 90 days old so `/api/inspections/overdue` remains visibly non-zero.

No future inspection document will be created because the active contract has no upcoming-inspection representation.

### 8.4 Faults

Create 7 faults using valid statuses and severities:

- at least one `Open`;
- at least one `Assigned`;
- at least one `In Progress`;
- at least one `Resolved`;
- at least one `Closed`;
- multiple severity levels;
- valid reporters, assignees, and resolved-by users where applicable.

At least one active fault will be recent and critical or major so the dashboard and fault list have meaningful content.

### 8.5 Maintenance

Create 8 performed maintenance records across different transformers and technicians:

- preventive, corrective, and emergency examples;
- completed work details and costs;
- several next-maintenance dates inside the next 30 days;
- some overdue next-maintenance dates;
- some future dates outside the dashboard window;
- at least one record without a next date.

The two `Under Maintenance` transformers will demonstrate the current in-progress operational status without adding a nonexistent maintenance status field.

### 8.6 Records intentionally not created

- users;
- territories;
- service areas;
- sessions;
- refresh tokens;
- audit logs;
- notifications;
- QR code records;
- backup jobs;
- maintenance-mode records;
- persistent report records, because none exist in the architecture.

## 9. Ownership and canonical identifiers

No schema field will be added solely for seed ownership.

| Record type | Canonical ownership key |
|---|---|
| District | Phase 9F Railway code, such as `P9FR-D01` |
| Feeder | Phase 9F Railway code, such as `P9FR-F01`, plus canonical service-area parent |
| Transformer | Unique Phase 9F Railway `asset_id`, such as `P9FR-TX-001` |
| Inspection | Exact narrative prefix containing a stable key, such as `Phase 9F Railway Demo [P9FR-INS-001]` |
| Fault | Exact description prefix containing a stable key, such as `Phase 9F Railway Demo [P9FR-FLT-001]` |
| Maintenance | Stable `work_order_number`, such as `P9FR-WO-001` |

The broad local seeder's cleanup prefix can match general `P9F-` identifiers. Documentation will therefore continue to prohibit running that broad script against Railway.

The operational reconciler will never delete a record because it is absent from the expected specification list.

## 10. Reconciliation design

### 10.1 Preflight

Before any normal-run write, the script will validate:

- explicit, non-blank `MONGODB_URI`;
- unique availability of all three territories;
- unique availability and correct parent relationships for all five service areas;
- availability and intended state of all 11 demo users;
- availability of the active users required as inspectors, reporters, assignees, technicians, and creators.

Missing or ambiguous dependencies produce `FAILED` outcomes and a non-zero exit before child records are written.

### 10.2 Per-record behavior

- If the canonical key is absent, create a Mongoose model instance and save it.
- If exactly one record exists, compare only the explicitly owned fields.
- If owned fields differ, assign only those fields and call `save()`.
- If no owned fields differ, report `SKIPPED`.
- If multiple records match a supposedly canonical key, report `FAILED` rather than selecting one arbitrarily.
- Preserve `_id`, `created_at`, unrelated metadata, authentication state, and non-owned fields.

No `deleteMany`, `deleteOne`, `findOneAndDelete`, collection drop, replacement update, or database drop will exist in the production script.

### 10.3 Dates

Dates that must remain operationally meaningful will be calculated from the current UTC day using fixed offsets. Running twice on the same UTC day will not change dates. Running on a later UTC day will update only owned relative-date fields while preserving document identity.

### 10.4 Partial recovery

Writes will be sequential and record-scoped. If execution stops after some successful records, the process exits non-zero. A later rerun will skip already canonical records, reconcile incomplete records, and continue safely.

A cross-collection transaction is not required because Railway Mongo topology support should not be assumed and idempotent partial recovery is an explicit design goal.

## 11. Dry-run design

Command:

```bash
node scripts/seedRailwayPhase9FOperationalData.js --dry-run
```

Dry-run will:

- require explicit `MONGODB_URI`;
- connect with index creation and automatic schema creation disabled;
- execute only reads;
- validate dependencies and relationships;
- calculate the complete desired dataset;
- report what would be created, updated, skipped, or failed;
- perform no save, update, delete, index, or collection-creation operation;
- exit non-zero when the corresponding normal execution would fail.

## 12. Output and exit contract

Each canonical record will produce one result:

- `CREATED`
- `UPDATED`
- `SKIPPED`
- `FAILED`

Dry-run output will clearly mark planned results rather than imply that a write happened.

The final output will include:

```text
Operational demo seed summary:
CREATED=...
UPDATED=...
SKIPPED=...
FAILED=...
```

The process exits `0` only when `FAILED=0`. Error messages will redact the configured database target and will not print secrets or credentials.

## 13. Test design

Create `src/tests/seedRailwayPhase9FOperationalData.test.js` before production implementation and verify that it fails because the module does not exist.

Focused integration coverage will include:

- missing `MONGODB_URI` fails before mutation;
- no localhost fallback;
- dry-run causes no writes or timestamp changes;
- first run creates the expected dataset;
- same-day second run is idempotent;
- canonical keys preserve `_id` values;
- unrelated records remain unchanged;
- existing demo users remain byte-for-byte unchanged for owned authentication and role fields;
- the inactive demo viewer remains inactive;
- territories and service areas are reused rather than created;
- missing or ambiguous dependencies fail clearly;
- transformer parent relationships are valid;
- inspection transformer and inspector relationships are valid;
- active faults satisfy the exact dashboard status filter;
- overdue transformer dates satisfy the exact 90-day endpoint filter;
- upcoming maintenance satisfies the exact 30-day endpoint filter;
- relative dates remain valid after a simulated later-day rerun;
- no broad delete method is invoked;
- injected partial failure produces `FAILED>0` and a non-zero CLI decision;
- printable output excludes database URLs and credential material.

Authenticated API checks will use the real application endpoints for:

- `GET /api/transformers/stats`;
- `GET /api/transformers`;
- `GET /api/transformers/search`;
- `GET /api/faults/open`;
- `GET /api/faults`;
- `GET /api/inspections/overdue`;
- `GET /api/inspections`;
- `GET /api/maintenance/upcoming`;
- `GET /api/maintenance`;
- relevant report endpoints;
- map-compatible transformer search and coordinate assertions.

The Super Admin test must receive non-zero dashboard results.

## 14. Validation plan

After the TDD implementation, run:

```bash
node --check scripts/seedRailwayPhase9FOperationalData.js
npx jest --runInBand src/tests/seedRailwayPhase9FOperationalData.test.js
npx jest --runInBand src/tests/seedRailwayPhase9FReferences.test.js
npx jest --runInBand src/tests/seedRailwayDemoUsers.test.js
npx jest --runInBand src/tests/transformer.test.js
npx jest --runInBand src/tests/inspection.test.js
npx jest --runInBand src/tests/fault.test.js
npx jest --runInBand src/tests/analytics.test.js
npx jest --runInBand src/tests/auth.test.js
SMTP_HOST= npm test
cd frontend && npm run build
cd ..
git diff --check
git status --short
```

There is currently no `src/tests/maintenance.test.js`; maintenance behavior is covered through the new focused integration suite and the existing application/report suites. Actual filenames will be recorded in the final report.

The implementation will also be executed against the established local/test database in normal and dry-run modes before any Railway write is proposed.

## 15. Railway execution design and completion

The live operational seeder was not run as part of implementation validation. After local tests, builds, and dry-run checks passed, the exact Railway commands were presented for separate approval. The dry-run and live-write gates were then independently approved and completed on 2026-07-16.

The repository currently documents a MongoDB-service pattern because local `railway run` cannot resolve Railway internal hostnames and the MongoDB service exposes `MONGO_PUBLIC_URL` to the one-off local process:

```bash
railway run --service MongoDB sh -c \
  'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FOperationalData.js --dry-run'
```

Only after the dry-run reported `FAILED=0` was the separately approved live command executed:

```bash
railway run --service MongoDB sh -c \
  'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FOperationalData.js'
```

The final documentation also explains the alternative TrafoLog service command if Railway executes it in an environment where the backend's internal `MONGODB_URI` is reachable. No URI value was printed.

## 16. Collections read and written

### 16.1 Normal execution reads

- `users`
- `territories`
- `serviceareas`
- `districts`
- `feeders`
- `transformers`
- `inspections`
- `faults`
- `maintenances`

### 16.2 Normal execution may write

- `districts`, limited to documented Phase 9F Railway codes;
- `feeders`, limited to documented Phase 9F Railway codes;
- `transformers`, limited to documented Phase 9F Railway asset IDs;
- `inspections`, limited to documented Phase 9F Railway narrative keys;
- `faults`, limited to documented Phase 9F Railway description keys;
- `maintenances`, limited to documented Phase 9F Railway work-order keys.

### 16.3 Explicitly not written

- `users`
- `territories`
- `serviceareas`
- `qrcodes`
- `notifications`
- `auditlogs`
- `sessions`
- `refreshtokens`
- backup, restore, import, export-job, maintenance-mode, and other system collections.

Dry-run writes no collection.

## 17. Risks

### 17.1 Rerun and date drift

Same-day reruns should skip canonical records. Later-day reruns will intentionally update relative dashboard dates. Only documented owned date fields will change.

### 17.2 Schema evolution

Future schema enum or required-field changes may cause validation failures. The script will report `FAILED` and exit non-zero rather than bypass model validation.

### 17.3 Partial failure

A sequential run can leave a partial Phase 9F Railway dataset. Canonical-key reconciliation makes a later rerun the recovery path. The script does not roll back successful records automatically.

### 17.4 Manual edits

Non-owned fields and unrelated metadata are preserved. Canonical owned fields are reconciled because they define the demo contract. Documentation will identify those fields so manual preview edits are not mistaken for durable production data.

### 17.5 Demo and future real data

The Railway environment is documented as a temporary preview. Future real data must not reuse the Phase 9F Railway canonical keys. The seeder will never delete or modify records merely because they are outside its expected list.

### 17.6 Current model gaps

The schema cannot represent a future inspection schedule or a dedicated maintenance lifecycle status. The implementation will not add convenience fields or fake frontend-only data to simulate unsupported states.

## 18. Rollback design

### 18.1 Code and documentation

Before any commit, local edits can be reviewed and selectively reverted. After a later approved commit, use a new Git revert commit for the exact implementation commit. Do not use destructive Git reset operations.

### 18.2 Railway records

The seeder will not include an automatic delete/rollback mode. If live rollback is later authorized:

1. Run a read-only inventory using the exact documented canonical keys.
2. Confirm which records were created by the live seed versus pre-existing records that were reconciled.
3. Remove child records first: maintenance, faults, and inspections.
4. Remove only exact documented transformer asset IDs.
5. Remove only exact documented feeder and district codes that were created by this seeder.
6. Preserve users, territories, service areas, sessions, refresh tokens, audit logs, notifications, QR records, and all unrelated records.
7. Re-run read-only counts and orphan checks.

Exact rollback commands must be prepared from the live execution summary and separately approved. Broad prefix deletion or collection-wide deletion is prohibited.

## 19. Documentation deliverables completed

Implementation updated:

- `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`;
- `docs/CHANGELOG_LOCAL_SETUP.md`.

Implementation created:

- `docs/superpowers/plans/2026-07-15-railway-operational-demo-seed.md`;
- `docs/superpowers/reports/2026-07-15-railway-operational-demo-seed-audit-and-fix.md`;
- `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`, provided the established `docs/superpowers` tracking structure remains appropriate.

No implementation commit or push occurred during implementation. Railway dry-run and live execution later occurred through separate approval gates after validation.

## 20. Historical approval completion

The design approval authorized the implementation plan and test-first implementation only. It did not authorize a Railway write, commit, or push. Implementation subsequently completed; the Railway dry-run and live write were separately authorized and completed on 2026-07-16. The first run created 62 records, the same-day rerun skipped 62, and authentication state and Railway configuration remained unchanged. Commit and push are still pending separate approval.
