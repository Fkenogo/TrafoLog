# Railway-Safe Phase 9F Reference Seeder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and deliver an idempotent Railway-safe reconciler for exactly three Phase 9F territories and five Phase 9F service areas.

**Architecture:** A standalone CommonJS script exports canonical specs and testable reconciliation helpers, connects only through an explicit `MONGODB_URI`, reconciles documents by exact code through model instances, and reports deterministic per-record and summary outcomes. Focused integration tests exercise real Mongoose models against the existing test database and verify collection isolation.

**Tech Stack:** Node.js, CommonJS, Mongoose, Jest, existing MongoDB test configuration, Vite frontend build.

## Global Constraints

- Reconcile only territories `P9FC`, `P9FE`, `P9FW` and service areas `P9FSA1` through `P9FSA5`.
- Update only canonical fields identified in the approved specification.
- Preserve `_id`, timestamps, and unrelated metadata.
- Never delete, rename, repurpose, or modify non-Phase-9F records.
- Never create `P9FSA6`.
- Require `MONGODB_URI`; never fall back to localhost.
- Never invent ObjectIds or write a service area without its canonical territory.
- Never modify operational or authentication data.
- Do not run either seeder against Railway.
- Add no dependency unless existing project capabilities cannot implement a requirement.

---

### Task 1: Focused failing tests

**Files:**
- Create: `src/tests/seedRailwayPhase9FReferences.test.js`

**Interfaces:**
- Consumes: planned exports from `scripts/seedRailwayPhase9FReferences.js`: `TERRITORY_SPECS`, `SERVICE_AREA_SPECS`, `getMongoUri`, `reconcileRecord`, `summarize`, and `seedRailwayPhase9FReferences`.
- Produces: executable behavioral contract for the seeder.

- [x] **Step 1: Write focused tests before the script exists**

Cover explicit environment targeting, canonical record creation, relationships, rerun `SKIPPED` outcomes, no duplicates, preservation of unrelated records and metadata, unchanged User and Transformer documents, missing-territory failure with no dependent write, and stable summaries.

- [x] **Step 2: Run the focused suite and verify RED**

Run `npx jest --runInBand src/tests/seedRailwayPhase9FReferences.test.js`.

Expected: FAIL because `scripts/seedRailwayPhase9FReferences.js` does not exist.

### Task 2: Minimal model-backed reconciler

**Files:**
- Create: `scripts/seedRailwayPhase9FReferences.js`
- Test: `src/tests/seedRailwayPhase9FReferences.test.js`

**Interfaces:**
- Consumes: `Territory`, `ServiceArea`, `mongoose`, and `process.env.MONGODB_URI`.
- Produces: exported canonical specs and helpers named in Task 1 plus a CLI `main()` path.

- [x] **Step 1: Add exact canonical specifications**

Define frozen territory and service-area arrays using the values in `scripts/phase9fSeedData.js`, with service areas referring to parent territory codes rather than ObjectIds.

- [x] **Step 2: Add strict environment validation**

Implement `getMongoUri(env = process.env)` so missing or whitespace-only `MONGODB_URI` throws without mentioning localhost or exposing any URI.

- [x] **Step 3: Add field-scoped reconciliation**

Implement a helper that finds by exact code, creates through `new Model(canonicalFields).save()` when absent, compares only canonical fields when present, saves only changed model fields, normalizes ObjectIds for relationship comparison, and returns `CREATED`, `UPDATED`, `SKIPPED`, or `FAILED` without replacement or deletion operations.

- [x] **Step 4: Add dependency-safe orchestration and output**

Reconcile territories first, retain only successfully resolved documents, then reconcile each service area only when its specified territory is available. Print one line for each of the eight codes, print `Summary: CREATED=n UPDATED=n SKIPPED=n FAILED=n`, and set `process.exitCode = 1` when failures exist.

- [x] **Step 5: Verify syntax and GREEN focused tests**

Run `node --check scripts/seedRailwayPhase9FReferences.js` and `npx jest --runInBand src/tests/seedRailwayPhase9FReferences.test.js`.

Expected: syntax exit 0 and focused suite PASS.

### Task 3: Documentation and implementation report

**Files:**
- Modify: `docs/CHANGELOG_LOCAL_SETUP.md`
- Create: `docs/superpowers/reports/2026-07-11-railway-phase9f-reference-seeder.md`

**Interfaces:**
- Consumes: final implementation diff and fresh validation evidence.
- Produces: operational guidance, audit scope, results, risk, and rollback record.

- [x] **Step 1: Update the changelog**

Add a focused 2026-07-11 entry describing exact record scope, safety behavior, later execution order, expected output, validation commands, and warning against `node scripts/phase9fSeedData.js` on Railway preview.

- [x] **Step 2: Write the implementation report**

Document executive summary, cause, strategy, exact records, dependencies, files inspected/modified, diff summary, collections read/modified/not modified, idempotency, commands and results, dependencies/config, risks, rollback, later Railway commands and expected output, and Git delivery evidence. Record final Git evidence after commit and push in the user-facing handoff because a commit cannot contain its own hash.

### Task 4: Complete verification

**Files:**
- Verify all relevant files and repository state.

**Interfaces:**
- Consumes: completed implementation and documentation.
- Produces: fresh evidence required before commit and push.

- [x] **Step 1: Run all requested commands in order**

Run:

```bash
node --check scripts/seedRailwayPhase9FReferences.js
npx jest --runInBand src/tests/seedRailwayPhase9FReferences.test.js
npx jest --runInBand src/tests/seedRailwayDemoUsers.test.js
npm test
cd frontend && npm run build
```

Expected: every command exits 0. Existing non-failing warnings must be recorded rather than omitted.

- [x] **Step 2: Audit safety and diff scope**

Run `git diff --check`, inspect `git diff --stat` and the full diff, search the new script for forbidden destructive operations and non-scope model imports, and confirm no Railway command was run.

### Task 5: Git delivery and remote verification

**Files:**
- Stage only the new seeder, focused test, changelog, implementation report, and implementation plan.

**Interfaces:**
- Consumes: fully passing verification evidence.
- Produces: pushed `origin/main` commit and clean synchronized worktree.

- [ ] **Step 1: Commit only relevant files**

Run:

```bash
git status --short
git add scripts/seedRailwayPhase9FReferences.js src/tests/seedRailwayPhase9FReferences.test.js docs/CHANGELOG_LOCAL_SETUP.md docs/superpowers/reports/2026-07-11-railway-phase9f-reference-seeder.md docs/superpowers/plans/2026-07-11-railway-phase9f-reference-seeder.md
git commit -m "Add Railway-safe Phase 9F reference seeder"
```

- [ ] **Step 2: Push and verify GitHub synchronization**

Run:

```bash
git push origin main
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short --branch
```

Expected: local `HEAD` equals `origin/main`, and the worktree is clean.

- [ ] **Step 3: Deliver the required report**

Report all 28 originally requested items plus the approved condensed checklist, including verified commit hash/message, pushed state, worktree status, report link, changelog update, exact later Railway commands, and confirmation that neither seeder ran against Railway.
