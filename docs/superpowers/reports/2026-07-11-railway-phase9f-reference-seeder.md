# Railway-Safe Phase 9F Reference Seeder Implementation Report

## 1. Executive summary

Implemented a narrow, idempotent seeder that creates, updates, or skips exactly three Phase 9F territories and five Phase 9F service areas required by `scripts/seedRailwayDemoUsers.js`. It requires an explicit database target, uses stable codes, preserves existing document identities and unrelated metadata, performs no deletion, and fails safely when a parent territory cannot be resolved.

## 2. Confirmed cause of missing prerequisites

The Railway demo-user seeder resolves scoped user assignments by exact territory and service-area codes. Its Railway output confirmed that `P9FC`, `P9FE`, `P9FW`, and `P9FSA1` through `P9FSA5` were unavailable, so eight scoped users correctly failed instead of receiving invented ObjectIds.

No Railway query was run during this implementation. Similar records under other names or codes therefore were not inventoried and would not satisfy the existing exact-code contract.

## 3. Fix strategy

Use Mongoose model instances to find each canonical document by exact `code`. Create absent records, update only explicitly canonical fields when values differ, and skip exact matches. Reconcile territories first, then resolve each service area's parent from successful territory outcomes. Report every result and exit non-zero if any required record fails.

## 4. Exact Phase 9F records

| Code | Name | Parent | Canonical details |
|---|---|---|---|
| `P9FC` | Phase 9F Central | — | Central; Phase 9F validation central territory; active |
| `P9FE` | Phase 9F Eastern | — | Eastern; Phase 9F validation eastern territory; active |
| `P9FW` | Phase 9F Western | — | Western; Phase 9F validation western territory; active |
| `P9FSA1` | Phase 9F Service Area 1 | `P9FC` | Kampala; active |
| `P9FSA2` | Phase 9F Service Area 2 | `P9FE` | Jinja; active |
| `P9FSA3` | Phase 9F Service Area 3 | `P9FW` | Mbarara; active |
| `P9FSA4` | Phase 9F Service Area 4 | `P9FC` | Mukono; active |
| `P9FSA5` | Phase 9F Service Area 5 | `P9FE` | Mbale; active |

`P9FSA6` is deliberately excluded.

## 5. Required relationships and dependencies

Territory requires `name` and `code`. ServiceArea requires `territory_id` and `name`; its code is also required by this workflow as the stable natural key used by the user seeder. Service areas require only their canonical territory documents. They do not require districts, feeders, managers/users, geometry, GPS, status documents, or other prerequisite collections.

## 6. Files inspected

- `src/models/Territory.js`
- `src/models/ServiceArea.js`
- `src/models/District.js`
- `src/models/Feeder.js`
- `scripts/phase9fSeedData.js`
- `scripts/seedRailwayDemoUsers.js`
- `docs/LOCAL_DEMO_USERS.md`
- `src/tests/seedRailwayDemoUsers.test.js`
- `src/config/database.js`
- `package.json`
- recent Git history for the Railway demo-user seeder

## 7. Files modified or created

- Created `scripts/seedRailwayPhase9FReferences.js`.
- Created `src/tests/seedRailwayPhase9FReferences.test.js`.
- Updated `docs/CHANGELOG_LOCAL_SETUP.md`.
- Created this implementation report.
- Created the approved design specification and implementation plan under `docs/superpowers/`.

The existing demo-user seeder and production API files were not modified.

## 8. Code diff summary

The implementation adds one standalone two-model reconciler, one focused Jest integration suite, and documentation. The script exports canonical specs and testable helpers, validates `MONGODB_URI`, compares only canonical fields, preserves documents through model `save()`, enforces parent availability, prints deterministic statuses, and sets a failing CLI exit code when required records fail.

## 9. Collections read

- `territories`, by exact canonical Phase 9F code.
- `serviceareas`, by exact canonical Phase 9F code.

Tests additionally read user and transformer counts to prove isolation; the production seeder does not import or query those models.

## 10. Collections modified

- `territories`, limited to `P9FC`, `P9FE`, and `P9FW`.
- `serviceareas`, limited to `P9FSA1`, `P9FSA2`, `P9FSA3`, `P9FSA4`, and `P9FSA5`.

## 11. Collections explicitly not modified

Users, transformers, feeders, districts, transformer ratings, faults, inspections, maintenance records, audit logs, notifications, sessions, refresh tokens, imports, and backups are not imported or modified. No operational collection is touched.

## 12. Idempotency behavior

The first run creates missing canonical records. Later runs compare only canonical fields: exact matches are `SKIPPED`, drifted canonical fields are `UPDATED`, and no duplicates are created. Existing `_id` and `created_at` values remain unchanged. Unknown metadata stored on an existing document remains intact.

## 13. Commands executed

```bash
npm test
npx jest --runInBand src/tests/seedRailwayPhase9FReferences.test.js
node --check scripts/seedRailwayPhase9FReferences.js
npx jest --runInBand src/tests/seedRailwayPhase9FReferences.test.js
npx jest --runInBand src/tests/seedRailwayDemoUsers.test.js
npm test
cd frontend && npm run build
```

The initial sandboxed baseline `npm test` could not access localhost due to sandbox policy; it was immediately rerun with approved local-service access and passed. The first focused test run was the required TDD red result: missing module. The first green attempt found a pre-existing local `P9FSA6`, so the test was corrected to assert its count remains unchanged; the implementation never touched it.

## 14. Focused test results

- New reference-seeder suite: 9 passed, 0 failed.
- Existing demo-user seeder suite: 9 passed, 0 failed.
- TDD red state was observed before production code existed.

## 15. Full backend test results

13 suites passed; 202 tests passed; 0 failed. Existing Mongoose reserved-path, duplicate-index, and deprecated-option warnings remain and were not changed under this task's constraints.

## 16. Frontend build result

Production TypeScript/Vite build passed. Vite emitted the existing warning that a generated JavaScript chunk exceeds 500 kB after minification.

## 17. Dependencies added

None.

## 18. Config changes

None. Railway variables, role definitions, authentication behavior, APIs, package manifests, and build configuration were unchanged.

## 19. Risks

- An existing non-Phase-9F record with a canonical Phase 9F name could trigger the Territory unique-name constraint. The script reports `FAILED` and does not repurpose that record.
- Existing records with canonical codes will have only their canonical fields reconciled, including `is_active: true` and the specified service-area parent.
- Mongoose does not enforce foreign-key existence at the database layer; the script explicitly handles parent resolution to prevent dangling service areas.
- Railway execution remains a later operational action and was not validated against the preview database in this task.

## 20. Rollback instructions

Revert the implementation through a new Git revert commit after identifying the final implementation hash. The seeder intentionally provides no destructive database rollback. If it is later executed and database reversal is required, manually review only the eight canonical records and perform an explicitly authorized reconciliation; do not run broad deletion commands.

## 21. Exact later Railway execution commands

```bash
railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FReferences.js'

railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayDemoUsers.js'
```

Run the second command only after the first reports `FAILED=0`.

Do not run the following against Railway preview:

```bash
node scripts/phase9fSeedData.js
```

## 22. Expected output

A database missing all eight references should report eight `CREATED` records and:

```text
Summary: CREATED=8 UPDATED=0 SKIPPED=0 FAILED=0
```

A fully canonical rerun should report eight `SKIPPED` records and:

```text
Summary: CREATED=0 UPDATED=0 SKIPPED=8 FAILED=0
```

Mixed existing state can produce `CREATED`, `UPDATED`, and `SKIPPED` together. Any `FAILED` count produces a non-zero CLI exit.

## 23–26. Git delivery evidence

The final commit hash, exact commit message, confirmation that it was pushed to `origin/main`, equality of local `HEAD` and `origin/main`, and clean worktree status are verified and reported in the final task handoff after the commit and push. A commit cannot embed its own final hash.

## 27. Markdown implementation report

This file is the required implementation report: `docs/superpowers/reports/2026-07-11-railway-phase9f-reference-seeder.md`.

## 28. Changelog update

`docs/CHANGELOG_LOCAL_SETUP.md` contains the record scope, safety properties, later Railway execution order, expected output, validation results, and broad-seed warning.

## Railway execution confirmation

Neither `seedRailwayPhase9FReferences.js` nor `seedRailwayDemoUsers.js` was run against Railway during implementation.
