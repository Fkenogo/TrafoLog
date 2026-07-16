# Railway Operational Demo Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Do not dispatch subagents because repository control must remain exclusive. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build and verify a narrow, dry-run-capable, idempotent operational demo reconciler that makes the Phase 9F Railway preview useful without modifying users, authentication state, existing core references, or unrelated records.

**Architecture:** A single CommonJS script owns deterministic specifications plus small exported preflight, planning, comparison, reconciliation, output, and CLI functions. It resolves every existing dependency and every canonical match before the first write, assigns planned ObjectIds in memory for absent records, and then performs sequential model-backed saves only for six owned collections. Tests use the existing Mongoose/Jest/Supertest architecture and exercise both database results and the actual authenticated APIs.

**Tech Stack:** Node.js, CommonJS, Mongoose 9, Jest 30, Supertest, existing Express application and models; no new dependency.

## Global Constraints

- Do not recreate, execute, or use the rejected implementation removed by the wrong concurrent agent.
- Require a nonblank `MONGODB_URI`; never supply a localhost fallback or print the URI.
- Dry-run connects with `{ autoIndex: false, autoCreate: false }` and performs reads only.
- Never save a `User`, `Territory`, or `ServiceArea`; never touch sessions or refresh tokens.
- Never use delete, drop, replacement, or broad update methods.
- Use exact canonical keys, query all matches, and fail preflight on ambiguity.
- Build and validate the complete dependency and desired-document graph before a normal-run write.
- Preserve document `_id`, timestamps except when an owned update legitimately changes `updated_at`, and all non-owned top-level and nested paths.
- Anchor relative dates at `00:00:00.000Z` of the supplied/current UTC day.
- A failed record produces `FAILED`; CLI exits non-zero when any failure exists.
- During implementation, do not run against Railway, commit, stage, or push. Railway dry-run and live execution later occurred only through separately authorized gates; commit and push remain pending.

---

## File structure

- Create `src/tests/seedRailwayPhase9FOperationalData.test.js`: focused integration, safety, preservation, output, and API acceptance tests.
- Create `scripts/seedRailwayPhase9FOperationalData.js`: approved dataset, dependency preflight, dry-run planner, model-backed reconciler, summary, CLI.
- Create and maintain `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`: chronological evidence and command results.
- Update `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`: safe order, commands, outputs, ownership, touched/untouched collections, rerun and rollback warnings.
- Update `docs/CHANGELOG_LOCAL_SETUP.md`: implementation and validation record.
- Create `docs/superpowers/reports/2026-07-15-railway-operational-demo-seed-audit-and-fix.md`: final audit, implementation, tests, database impact, risks, rollback, Git/Railway status.

## Exact owned-field contract

Only the paths below may be assigned on an existing canonical document. Paths omitted from this list are non-owned and must survive unchanged. `created_at`, unknown metadata, and `__v` are never assigned.

### District

Canonical lookup: all records where `code` equals one of `P9FR-D01` through `P9FR-D05`.

Owned paths: `name`, `code`, `region`, `is_active`.

### Feeder

Canonical lookup: all records where both `code` and `service_area_id` equal the specification. Also fail if the same Phase 9F code exists under a different service area, because the code is dataset-global even though the schema does not enforce it.

Owned paths: `service_area_id`, `name`, `code`, `network_voltage_kv`, `is_active`.

### Transformer

Canonical lookup: all records where `asset_id` equals `P9FR-TX-001` through `P9FR-TX-015`.

Owned paths: `asset_id`, `uedcl_reference`, `manufacturer`, `serial_number`, `year_manufactured`, `record_status`, `kva_rating`, `network_voltage_kv`, `display_rating`, `voltage_secondary`, `phase_type`, `cooling_type`, `mounting_type`, `vector_group`, `location_operational.territory_id`, `location_operational.territory_name`, `location_operational.service_area_id`, `location_operational.service_area_name`, `location_operational.feeder_id`, `location_operational.feeder_name`, `location_operational.feeder_code`, `location_operational.substation_name`, `location_administrative.district_id`, `location_administrative.district_name`, `location_administrative.sub_county`, `location_administrative.parish`, `location_administrative.village`, `location_administrative.site_name`, `gps.type`, `gps.coordinates`, `gps.method`, `gps.accuracy_metres`, `gps.captured_at`, `installation.install_date`, `installation.installing_contractor`, `installation.commissioned_by`, `installation.commissioning_date`, `installation.warranty_expiry`, `operational_status`, `has_open_fault`, `last_inspection_date`, `last_maintenance_date`, `last_load_reading_date`, `last_load_percentage`, `overdue_inspection_flag`, `is_deleted`, `deleted_at`, `created_by`, `updated_by`.

`location_operational`, `location_administrative`, `gps`, and `installation` must be patched leaf-by-leaf; assigning a whole nested object is prohibited. `created_by` is creation-owned: set it when creating, but preserve it on rerun. `updated_by` is set only when another owned transformer path changes.

### Inspection

Canonical marker: exact leading segment `Phase 9F Railway Demo [P9FR-INS-NNN]` in `condition_narrative`. Construct the regular expression with an escaped marker and `^`; fetch all matches; more than one is a preflight failure.

Owned paths: `transformer_id`, `inspector_id`, `inspection_date`, `visit_type`, `gps_at_inspection.type`, `gps_at_inspection.coordinates`, `gps_accuracy`, `network_voltage_confirmed`, `kva_rating_confirmed`, `rating_discrepancy_flag`, `rating_discrepancy_details`, each specified `physical.*` leaf, each specified `oil_breather.*` leaf, each specified `electrical.*` leaf, each specified `site_safety.*` leaf, the canonical leading segment of `condition_narrative`, `recommended_action`, `recommended_action_details`, `sync_status`, `sync_version`, `is_deleted`, `deleted_at`.

The reconciler owns only the canonical leading narrative segment. It must render `canonicalSegment + existingSuffix`, where `existingSuffix` is all text after a recognized canonical segment. A manually appended suffix is never removed or rewritten.

### Fault

Canonical marker: exact leading segment `Phase 9F Railway Demo [P9FR-FLT-NNN]` in `fault_description`; use an escaped anchored regular expression, fetch all matches, and fail on more than one.

Owned paths: `transformer_id`, `inspection_id`, `reported_by`, `fault_date`, `fault_source`, the canonical leading segment of `fault_description`, `fault_type`, `severity`, `network_voltage_kv`, `customers_affected`, `area_affected`, `fault_status`, `assigned_to`, `date_assigned`, `target_resolution_date`, `resolved_date`, `resolution_description`, `root_cause`, `parts_replaced`, `downtime_hours`, `resolved_by`.

As with inspection narratives, only the canonical leading segment is owned; manually appended text is a preserved suffix. Photos are non-owned.

### Maintenance

Canonical lookup: all records where `work_order_number` exactly equals `P9FR-WO-001` through `P9FR-WO-008`. The field is optional, unindexed, and non-unique in the active schema, so every key uses `find()`/equivalent and more than one match is a preflight failure.

Owned paths: `transformer_id`, `technician_id`, `maintenance_date`, `maintenance_type`, `team_contractor`, `supervised_by`, `work_order_number`, each specified `work_performed.*` leaf, `pre_maintenance_load.phase_a`, `pre_maintenance_load.phase_b`, `pre_maintenance_load.phase_c`, `pre_maintenance_notes`, `post_condition_narrative`, `post_maintenance_load.phase_a`, `post_maintenance_load.phase_b`, `post_maintenance_load.phase_c`, `post_maintenance_readings.voltage_hv`, `post_maintenance_readings.voltage_lv`, `post_maintenance_readings.oil_temperature`, `post_maintenance_readings.ambient_temperature`, `completed_by`, `reviewed_by`, `reviewed_at`, `review_notes`, `next_maintenance_date`, `next_maintenance_notes`, `total_cost`, `parts_cost`, `labour_cost`, `sync_status`, `sync_version`, `is_deleted`, `deleted_at`.

`work_performed`, load objects, and readings must be patched by owned leaf paths. `parts_used`, photos, and unknown nested metadata are non-owned.

---

### Task 1: Record concurrent-agent artifact loss

**Files:**
- Modify: `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`

**Interfaces:**
- Consumes: forensic conclusion that the wrong concurrent agent removed the two untracked files.
- Produces: accurate documentation without reconstructing rejected code or nonexistent evidence.

- [x] Verify that the rejected implementation and untracked inspection report are absent.
- [x] Record that the wrong concurrent agent removed both before quarantine could be preserved.
- [x] Do not recreate the rejected implementation or inspection evidence.

### Task 2: Establish the red test and change log

**Files:**
- Create: `src/tests/seedRailwayPhase9FOperationalData.test.js`
- Create: `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`

**Interfaces:**
- Consumes: existing model exports, `database.connect()`, Express `app.getApp()`, and `DEMO_USER_SPECS`.
- Produces: a Jest suite importing `../../scripts/seedRailwayPhase9FOperationalData` and a chronological evidence log.

- [x] Write the first test with `expect(() => require('../../scripts/seedRailwayPhase9FOperationalData')).not.toThrow()` and imports for the documented public functions/constants.
- [x] Run `npx jest --runInBand src/tests/seedRailwayPhase9FOperationalData.test.js`.
- [x] Record the expected RED result: `Cannot find module '../../scripts/seedRailwayPhase9FOperationalData'`.
- [x] Add fixture setup that creates only the three approved territories, five approved service areas, and 11 users with exact role/active/assignment state; cleanup is test-only and limited to exact canonical test keys.

### Task 3: Implement pure safety, ownership, and planning primitives

**Files:**
- Create: `scripts/seedRailwayPhase9FOperationalData.js`
- Test: `src/tests/seedRailwayPhase9FOperationalData.test.js`

**Interfaces:**
- Produces: `getMongoUri(env)`, `utcDay(value)`, `addUtcDays(anchor, offset)`, `escapeRegex(value)`, `getPath(object,path)`, `setPath(document,path,value)`, `valuesEqual(a,b)`, `preserveNarrativeSuffix(current, canonicalSegment)`, `summarize(results,dryRun)`, `safeErrorMessage(error,secret)`, and frozen `OWNED_FIELDS`.

- [x] Add tests proving blank/missing URI failure, absence of localhost text/fallback, UTC normalization, exact regex escaping, suffix preservation, nested leaf updates, and secret redaction.
- [x] Implement `getMongoUri` so it throws before any connection/model call.
- [x] Implement UTC helpers using `Date.UTC(getUTCFullYear(), getUTCMonth(), getUTCDate())` and immutable day offsets.
- [x] Implement leaf-path getters/setters and value comparison that normalize ObjectIds, Dates, arrays, primitives, `undefined`, and plain objects.
- [x] Export and freeze the exact ownership map above; write a static safety test that production source contains none of `deleteMany`, `deleteOne`, `dropDatabase`, `dropCollection`, `replaceOne`, `findOneAndDelete`, `findByIdAndDelete`, `updateMany`, or `bulkWrite`.
- [x] Run the focused suite and retain the remaining failures for unimplemented dataset/preflight behavior.

### Task 4: Encode the approved deterministic dataset

**Files:**
- Modify: `scripts/seedRailwayPhase9FOperationalData.js`
- Test: `src/tests/seedRailwayPhase9FOperationalData.test.js`

**Interfaces:**
- Produces frozen `DISTRICT_SPECS`, `FEEDER_SPECS`, `TRANSFORMER_SPECS`, `INSPECTION_SPECS`, `FAULT_SPECS`, `MAINTENANCE_SPECS`, `EXPECTED_USER_SPECS`, and `buildDesiredDataset(dependencies, anchorDate)`.

- [x] Add exact-count tests for 5 districts, 7 feeders, 15 transformers, 20 inspections, 7 faults, and 8 maintenance records.
- [x] Add a status-count test for Active 8, Faulty 3, Under Maintenance 2, Decommissioned 1, Unverified 1.
- [x] Add rating assertions limiting `kva_rating` to `50, 100, 160, 200, 250, 315, 500, 630, 1000` and network voltage to 11 or 33.
- [x] Encode five districts for Kampala, Jinja, Mbarara, Mukono, and Mbale with codes `P9FR-D01`–`P9FR-D05`, and seven feeders `P9FR-F01`–`P9FR-F07` mapped to `P9FSA1`–`P9FSA5`.
- [x] Encode 15 assets `P9FR-TX-001`–`P9FR-TX-015` across every territory, service area, district, and feeder with valid coordinates, varied ratings, installation data, and the approved statuses.
- [x] Encode 20 inspection markers `P9FR-INS-001`–`020`, varied conditions/actions/users, and relative performed dates only.
- [x] Encode 7 fault markers `P9FR-FLT-001`–`007` covering Open, Assigned, In Progress, Resolved, Closed and varied severities, with coherent optional assignee/resolver fields.
- [x] Encode 8 work orders `P9FR-WO-001`–`008`, all maintenance types, 30-day upcoming dates, overdue dates, dates outside the window, and one null next date.
- [x] Derive transformer `last_inspection_date`, `last_maintenance_date`, `last_load_reading_date`, `last_load_percentage`, open-fault flag, and overdue flag from the complete child specs before reconciliation.

### Task 5: Implement full read-only dependency and canonical preflight

**Files:**
- Modify: `scripts/seedRailwayPhase9FOperationalData.js`
- Test: `src/tests/seedRailwayPhase9FOperationalData.test.js`

**Interfaces:**
- Produces: `loadDependencies()`, `validateDependencies(raw)`, `loadCanonicalMatches(dataset)`, and `buildExecutionPlan({anchorDate})` returning `{ dependencies, desired, entries, failures }` without writes.

- [x] Test missing, duplicate, inactive, wrongly parented territories/service areas; missing/duplicate/wrong-role/wrong-active/wrong-assignment users; and duplicate canonical operational records.
- [x] Query all territory, service-area, and user dependencies by exact approved keys and reject missing or duplicate matches.
- [x] Compare all 11 users against `DEMO_USER_SPECS` for email, role, `is_active`, `territory_id`, and `service_area_id`; load password only for the preservation snapshot, never for output.
- [x] Query exact canonical matches for every owned record; use escaped anchored markers for inspections/faults and exact `work_order_number` for maintenance.
- [x] Preassign `new mongoose.Types.ObjectId()` to absent planned parent/transformer records so the entire desired graph can be validated before writes.
- [x] Validate every transformer parent mapping and every child transformer/user reference in memory; return failures instead of beginning writes.
- [x] Prove a preflight failure leaves counts and timestamps unchanged across all six writable collections.

### Task 6: Implement dry-run and sequential reconciliation

**Files:**
- Modify: `scripts/seedRailwayPhase9FOperationalData.js`
- Test: `src/tests/seedRailwayPhase9FOperationalData.test.js`

**Interfaces:**
- Produces: `reconcileEntry(entry,{dryRun})`, `seedRailwayPhase9FOperationalData(options)`, `connectForSeed(uri,{dryRun})`, `printResults(results,{dryRun})`, `shouldExitNonZero(summary)`.

- [x] Test dry-run action names `WOULD_CREATE`, `WOULD_UPDATE`, `WOULD_SKIP`, `FAILED` and normal names `CREATED`, `UPDATED`, `SKIPPED`, `FAILED`.
- [x] Spy on `mongoose.connect` and assert dry-run uses `autoIndex:false` and `autoCreate:false`.
- [x] Snapshot document counts, collection names, indexes, `_id`, `created_at`, and `updated_at`; run dry-run; assert no changes.
- [x] Implement planning comparisons with only `OWNED_FIELDS`, including narrative-segment handling and leaf-by-leaf nested patches.
- [x] If preflight has any failure, print/return only planned and failed outcomes and perform zero normal-run saves.
- [x] In normal mode, save sequentially in District → Feeder → Transformer → Inspection → Fault → Maintenance order, catching each save failure, marking later dependency-sensitive entries failed, and retaining earlier successful records for idempotent recovery.
- [x] Return `{results, summary, exitCode}` with exit code 1 for any failure and 0 otherwise; the CLI sets `process.exitCode` and always disconnects.
- [x] Test an injected save failure produces non-zero, then a rerun completes without duplicate records.

### Task 7: Prove idempotency and preservation

**Files:**
- Modify: `src/tests/seedRailwayPhase9FOperationalData.test.js`

**Interfaces:**
- Consumes: complete `seedRailwayPhase9FOperationalData({ print, anchorDate, connect })`.

- [x] Test first run creates exactly 5/7/15/20/7/8 with `FAILED=0`.
- [x] Capture every canonical `_id`; same-day rerun must return all `SKIPPED`, retain IDs, and leave timestamps unchanged.
- [x] Rerun with anchor +1 day; assert only owned relative date paths change and IDs remain stable.
- [x] Inject raw `preview_metadata.owner`, nested `gps.manual_note`, and nested `work_performed.manual_note`; rerun and assert all survive.
- [x] Append text after an inspection and fault canonical narrative segment; rerun and assert byte-for-byte suffix preservation.
- [x] Snapshot explicit user fields: `email`, `role`, `is_active`, selected password hash, `login_attempts`, `lock_until`, reset fields, embedded refresh tokens, `territory_id`, `service_area_id`, and `updated_at`; assert unchanged. Assert Viewer 2 remains inactive.
- [x] Create unrelated documents in each writable model and assert they are untouched.

### Task 8: Validate dashboard and module APIs

**Files:**
- Modify: `src/tests/seedRailwayPhase9FOperationalData.test.js`

**Interfaces:**
- Consumes: Express `app.getApp()`, Supertest, a signed active Super Admin token, and seeded models.

- [x] Generate a Super Admin JWT without logging in or altering user state, then call the actual authenticated routes.
- [x] Assert `/api/transformers/stats` total is 15 and status groups are non-zero; `/api/transformers` and `/api/transformers/search` return map-compatible GPS records.
- [x] Assert `/api/faults/open` and `/api/faults` include canonical active/recent faults.
- [x] Assert `/api/inspections/overdue` returns non-decommissioned transformers older than 90 days and `/api/inspections` returns canonical inspections.
- [x] Assert `/api/maintenance/upcoming` returns work within 30 days and `/api/maintenance` returns canonical work orders.
- [x] Call the supported asset-register, inspection, fault, and maintenance report endpoints identified in `src/routes/reportRoutes.js`; assert coherent non-empty data instead of persistent report records.

### Task 9: Run focused and regression validation

**Files:**
- Maintain: `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`

- [x] Run `node --check scripts/seedRailwayPhase9FOperationalData.js`; expect exit 0.
- [x] Run the new focused suite; expect all tests pass.
- [x] Run reference, user, transformer, inspection, fault, analytics, and auth suites exactly as approved; record suite/test totals and failures without suppression.
- [x] Run `SMTP_HOST= npm test`; record exact totals.
- [x] Run `npm run build` from `frontend`; record the build result.

### Task 10: Execute local/test lifecycle proof

**Files:**
- Maintain: `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`

- [x] Identify the established non-Railway local/test `MONGODB_URI` without printing it and confirm it does not identify the Railway production database.
- [x] Run `node scripts/seedRailwayPhase9FOperationalData.js --dry-run`; record planned summary.
- [x] Run the normal seeder; record created/updated/skipped/failed summary.
- [x] Run it again on the same UTC day; record idempotent summary.
- [x] Exercise the exported API with a later `anchorDate` in the focused test rather than adding an unsafe CLI production flag; record the date-only updates.
- [x] Never run `railway run` or any Railway-connected seed command.

Completion note: this restriction was satisfied throughout implementation validation. The Railway dry-run and live write were performed later, on 2026-07-16, through separate explicit approval gates.

### Task 11: Document operations, impact, and rollback

**Files:**
- Modify: `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`
- Modify: `docs/CHANGELOG_LOCAL_SETUP.md`
- Create: `docs/superpowers/reports/2026-07-15-railway-operational-demo-seed-audit-and-fix.md`
- Maintain: `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md`

- [x] Document prerequisite order: references → users (only when intentionally resetting demo users) → operational dry-run → separately approved operational live seed.
- [x] Document output contracts, safe reruns, owned keys/fields, collections read/written/not touched, partial recovery, date drift, and explicit warnings against `phase9fSeedData.js` and `resetDemoPasswords.js` on Railway.
- [x] Keep Railway commands provisional and secret-safe. Present the repository-established MongoDB-service mapping command only as a proposed separate approval step.
- [x] Document rollback as exact canonical child-first removal requiring a separately approved inventory; prohibit prefix-wide or collection-wide deletion.
- [x] Complete the audit/fix report with actual command/test/local-seed evidence; later amend it with the separately authorized 2026-07-16 Railway live-gate evidence.

### Task 12: Final verification and handoff

**Files:**
- Verify all files above; modify only if evidence is inaccurate.

- [x] Run `git diff --check` and fix whitespace errors.
- [x] Run `git status --short --untracked-files=all`, `git branch --show-current`, `git rev-parse HEAD`, and `git rev-list --left-right --count HEAD...@{upstream}` where an upstream exists.
- [x] Verify the quarantine artifact is absent because the wrong concurrent agent removed it; do not recreate it. Verify the approved executable through tests and source safety checks instead.
- [x] Review the production script for destructive methods and credential output.
- [x] Report every modified file, command, exact test/build result, local database impact, unchanged user/session/token confirmation, risks, rollback, Git status, report paths, and proposed Railway dry-run command.
- [x] Do not stage, commit, push, or execute any Railway command.

Completion note: final implementation handoff was completed without staging, committing, or pushing. The later Railway dry-run/live gates were independently authorized and are recorded as historical execution, not implementation-plan execution.

## Self-review result

- Specification coverage: every approved safety, dataset, reconciliation, testing, validation, documentation, and approval-gate requirement maps to a task above.
- Placeholder scan: no `TBD`, `TODO`, deferred implementation instruction, or unspecified error-handling step remains.
- Type/interface consistency: the public function names and return contract are defined once and consumed consistently by later tasks.
- User constraint override: the writing-plans skill normally recommends commits; this plan intentionally contains none because commits are not authorized.
