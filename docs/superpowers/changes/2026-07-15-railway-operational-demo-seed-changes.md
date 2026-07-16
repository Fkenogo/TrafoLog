# Railway Operational Demo Seed — Running Changes

**Date:** 2026-07-15  
**Railway execution:** Dry-run and live gate completed under separate authorization on 2026-07-16  
**Commit/push:** Not authorized and not performed

## Concurrent-agent loss and planning

- Confirmed exclusive repository control before writes: no competing collaboration agent, repository-scoped editor automation, watcher, writable project-file handle, or Git lock.
- The wrong concurrent agent removed the untracked rejected implementation and its untracked inspection report before quarantine could be preserved.
- Neither `docs/superpowers/quarantine/2026-07-15-unapproved-seedRailwayPhase9FOperationalData.js.txt` nor `docs/superpowers/reports/2026-07-15-untracked-railway-operational-seeder-inspection.md` exists in the recovered worktree.
- The rejected implementation was not recreated or used as an implementation source.
- Created the approved implementation plan with exact per-model owned fields.

## Test-first implementation log

- Created the minimal focused test before creating a fresh production module.
- Initial RED command: `npx jest --runInBand src/tests/seedRailwayPhase9FOperationalData.test.js`.
- Initial RED result: 1 suite failed, 1 test failed, with the expected `Cannot find module '../../scripts/seedRailwayPhase9FOperationalData'`; no production module existed.

## Implementation

- Added a fresh implementation derived from the approved design supplied in task context, not from the removed rejected implementation.
- Defined exact owned paths for District, Feeder, Transformer, Inspection, Fault, and Maintenance.
- Added 5/7/15/20/7/8 deterministic records with exact canonical keys and UTC-day relative operational dates.
- Added complete reference/user/canonical preflight, duplicate detection, candidate Mongoose validation, dry-run planning, sequential model saves, partial-recovery behavior, redacted output, and non-zero failure exits.
- Verified that `work_order_number` is optional, unindexed, and non-unique in the active schema; the seeder therefore queries all exact matches and fails on duplicates.
- The production script contains no delete, drop, replacement, bulk-write, or broad-update method.

## Test-first evidence

- Pure contract cycle: 7 tests passed after the expected missing-export failures.
- Database/API suite expanded to 24 passing tests in a dedicated local MongoDB test database.
- Verified dry-run planned `WOULD_CREATE=62` without writes.
- Verified first normal run `CREATED=62`, same-day rerun `SKIPPED=62`, and later-day reconciliation `UPDATED=50 SKIPPED=12`.
- Verified authenticated Super Admin results from transformer stats/list/search, open/recent faults, overdue inspections, upcoming maintenance, all four operational list pages, coordinates for map use, and five JSON report endpoints.
- Verified user authentication/role/assignment fields, sessions, refresh tokens, reference identities, non-owned top-level/nested metadata, and appended narrative text remain unchanged.

## Validation log

- `node --check scripts/seedRailwayPhase9FOperationalData.js`: passed.
- Focused suite: 1 suite passed; 24 tests passed.
- Reference suite: 1 suite passed; 9 tests passed.
- Demo-user suite: 1 suite passed; 9 tests passed.
- Transformer suite: 1 suite passed; 30 tests passed.
- Inspection suite: 1 suite passed; 14 tests passed.
- Fault suite: initial unmodified command timed out in its pre-existing 5-second setup while configured SMTP was awaited; unchanged suite passed 20/20 with `SMTP_HOST=`.
- Analytics suite: 1 suite passed; 7 tests passed.
- Auth suite: 1 suite passed; 9 tests passed.
- Initial full backend run exposed shared-test-database interference: 16/18 suites and 257/262 tests passed. The new suite was isolated with a dedicated local test `dbName`; the two interacting suites then passed together, 33/33.
- Frontend build: passed; 1,736 modules transformed, with the pre-existing chunk-size warning.
- Final full backend rerun: 18/18 suites and 262/262 tests passed with `SMTP_HOST=`; existing Mongoose warnings and Jest's force-exit notice remain.
- Final frontend production build: passed; 1,736 modules transformed with the existing chunk-size warning.

## Railway live gate — 2026-07-16

- Pre-live counts confirmed the dry-run was mutation-free: districts 0, feeders 0, transformers 0, inspections 0, faults 0, and maintenances 0.
- First live run: `CREATED=62 UPDATED=0 SKIPPED=0 FAILED=0`.
- Same-UTC-day rerun: `CREATED=0 UPDATED=0 SKIPPED=62 FAILED=0`.
- Post-live counts: districts 5, feeders 7, transformers 15, inspections 20, faults 7, and maintenances 8.
- Every checked orphan relationship returned zero.
- The pre/post authentication fingerprint matched exactly: 11 users, 10 active, one inactive, unchanged role/assignment/password/reset/lock state, two sessions, and two refresh tokens.
- Deployed GET API validation passed for dashboard widgets, transformer/inspection/fault/maintenance modules, all 15 map coordinates, and five JSON reports.
- TrafoLog deployment remained `49b9b199-e3ab-4b8f-b2a3-0623ea1947fc` at commit `ec1511cc96b4244ade8b01e5ac5a6540800d4fd5`; no deployment or configuration change occurred.

## Final UI binding review — 2026-07-16

- Traced transformer statistics from `DashboardPage` through `transformerApi.stats`, `TransformerController.getStats`, and `TransformerService.getStatistics`.
- Confirmed `faulty` counts `has_open_fault=true`, not only `operational_status='Faulty'`. The four canonical records are `P9FR-TX-002`, `P9FR-TX-005`, `P9FR-TX-008`, and under-maintenance `P9FR-TX-011`, which also has an open fault.
- Dashboard, Transformers, and Asset Map already use the intended seeded business fields and required no change.
- Added test-first API relationship assertions, then populated transformer plus nested operational references for inspection and fault list/detail responses.
- Updated Maintenance to render populated `technician_id.name`/email with the legacy `technician_name` fallback.
- Focused regression remained 24/24 after the binding corrections.

## Transformer test setup timeout fix — 2026-07-16

- Timed every transformer-suite setup boundary with temporary test-local instrumentation.
- Confirmed application import took 6,981.5 ms but completed before Jest started the hook.
- Measured the original hook at 5,261.0 ms: Mongo/index setup 1,524.0 ms, Redis 891.2 ms, cleanup 103.4 ms, registration/login 2,682.1 ms, and remaining fixtures 44.5 ms.
- Replaced the transformer suite's unrelated registration/login integration workflow with direct `User.create()` plus `generateAuthToken()`. Real authentication middleware still validates the persisted user and JWT on every protected request.
- Measured the resulting hook at 2,210.8 ms, 3,050.2 ms faster and below Jest's default five-second limit without a custom hook timeout.
- Measured the QR idempotency requests at 4,359 ms and 4,156 ms. Retained all assertions and added narrowly scoped 15-second timeouts only to that two-request QR test and the two-transformer bulk-create test, both of which perform serial QR image generation.
- Final transformer suite: 1/1 suite and 30/30 tests passed.
- Final operational gate: 4/4 suites and 88/88 tests passed.
- Final full backend gate: 18/18 suites and 262/262 tests passed with `SMTP_HOST=`.
- Added `docs/superpowers/reports/2026-07-16-transformer-test-setup-timeout-fix.md`.

No commit, push, dependency installation, Railway authentication mutation, production configuration change, or secret-printing command was performed.
