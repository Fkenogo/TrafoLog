# kVAssetTracker Implementation Plan

This plan is designed for a skilled developer or AI coding agent to execute safely in small phases. It assumes the current Express/MongoDB + React/Vite architecture remains the working architecture unless the founder decides otherwise.

## Phase 0: Safety and Setup Checks

### TASK-0.1 — Freeze Product Baseline

- **Linked finding:** A-004, A-018
- **Objective:** Decide whether the current custom stack is accepted as the new implementation baseline.
- **Files likely to change:** `docs/ARCHITECTURE_DECISION_CURRENT_STACK.md`, `docs/LOCAL_ONBOARDING.md`, `docs/API_FRONTEND_READINESS_MAP.md`
- **Steps:**
  1. Read `docs/guides/kVAssetTracker_PRD_v2.0.docx` and all `docs/guides/P*.md`.
  2. Write an architecture decision record explaining Supabase/RLS/Mapbox/Dexie/Tailwind versus current Express/Mongo/Redis/Vite/custom CSS.
  3. Label original guide requirements as accepted, deferred, or replaced.
  4. Update onboarding to describe the full-stack repo accurately.
- **Dependencies:** Founder decision on architecture.
- **Acceptance criteria:** A new developer can understand the intended stack and remaining PRD gaps without reading historical phase reports.
- **Verification commands:** `git diff -- docs`
- **Risk level:** low

### TASK-0.2 — Establish Clean Validation Baseline

- **Linked finding:** A-020
- **Objective:** Confirm the latest validation state before security fixes begin.
- **Files likely to change:** None unless documenting results.
- **Steps:**
  1. Run local environment check.
  2. Run seed script.
  3. Run API workflow validation.
  4. Run screenshot capture.
  5. Run frontend build and backend tests.
  6. Record exact results.
- **Dependencies:** MongoDB, Redis, backend, frontend.
- **Acceptance criteria:** Baseline results are documented before code changes.
- **Verification commands:**
  ```bash
  node scripts/checkLocalEnvironment.js
  node scripts/phase9fSeedData.js
  node scripts/phase9fValidateApiWorkflows.js
  node scripts/phase9fCaptureScreenshots.js
  cd frontend
  npm run build
  cd ..
  npm test
  git status --short
  ```
- **Risk level:** low

## Phase 1: Critical Blockers

### TASK-1.1 — Lock Down Public Registration

- **Linked finding:** A-001
- **Objective:** Prevent unauthenticated users from creating privileged accounts.
- **Files likely to change:** `src/routes/authRoutes.js`, `src/validators/authValidator.js`, `src/services/authService.js`, `src/tests/auth.test.js`, `src/tests/user.test.js`, `swagger.yaml`, `docs/API_FRONTEND_READINESS_MAP.md`
- **Steps:**
  1. Decide whether public registration should exist at all.
  2. If retained, force public registrations to inactive `Viewer` only and ignore/reject role, territory, and service-area fields.
  3. Ensure Super Admin user creation happens only through `/api/users`.
  4. Update tests that currently create Super Admins through `/api/auth/register`.
  5. Add tests proving `POST /api/auth/register` cannot create `Super Admin`, `Territory Manager`, `Engineer`, or `Field Technician`.
  6. Update Swagger and readiness docs.
- **Dependencies:** None.
- **Acceptance criteria:** Public API cannot create any privileged active account.
- **Verification commands:**
  ```bash
  npx jest --testPathPatterns=src/tests/auth --forceExit
  npx jest --testPathPatterns=src/tests/user --forceExit
  npm test
  ```
- **Risk level:** high

### TASK-1.2 — Centralize Data Scope Enforcement

- **Linked finding:** A-002, A-012
- **Objective:** Ensure every role only sees allowed transformer-related data.
- **Files likely to change:** `src/middleware/auth.js`, `src/middleware/rbac.js`, `src/services/transformerService.js`, `src/controllers/transformerController.js`, `src/services/inspectionService.js`, `src/services/faultService.js`, `src/services/maintenanceService.js`, `src/services/dashboardService.js`, `src/services/reportingService.js`, `src/services/exportService.js`, tests under `src/tests`
- **Steps:**
  1. Define one helper that returns permitted transformer Mongo filters for a user.
  2. Define one helper that checks access to a specific transformer.
  3. Apply the helper to transformer list/detail/search/nearby.
  4. Apply it to inspection/fault/maintenance list/detail/history.
  5. Apply it to dashboard KPI/alerts/charts/decision tables/map data.
  6. Apply it to reports, exports, sync, and notifications where transformer data is involved.
  7. Add role-specific regression tests for Super Admin, Territory Manager, Engineer, Field Technician, and Viewer.
- **Dependencies:** Clear founder decision on Engineer/Viewer scope.
- **Acceptance criteria:** Tests prove users cannot read data outside their permitted territory/service area.
- **Verification commands:**
  ```bash
  npx jest --testPathPatterns=src/tests/auth --forceExit
  npx jest --testPathPatterns=src/tests/transformer --forceExit
  npx jest --testPathPatterns=src/tests/inspection --forceExit
  npx jest --testPathPatterns=src/tests/fault --forceExit
  npx jest --testPathPatterns=src/tests/report --forceExit
  npm test
  ```
- **Risk level:** high

### TASK-1.3 — Add Frontend Role Route Guards

- **Linked finding:** A-011
- **Objective:** Prevent users from directly opening screens their role should not use.
- **Files likely to change:** `frontend/src/routes/ProtectedRoute.tsx`, `frontend/src/routes/AppRoutes.tsx`, `frontend/src/layouts/AppLayout.tsx`, `frontend/src/components/common/AccessDenied.tsx`, `frontend/src/types/api.ts`
- **Steps:**
  1. Add `requiredRoles` support to `ProtectedRoute`.
  2. Add an `AccessDenied` component.
  3. Protect `/admin`, reference data writes, and other role-specific routes.
  4. Align sidebar visibility with the same route metadata.
  5. Keep backend RBAC as authoritative.
- **Dependencies:** Role model confirmed.
- **Acceptance criteria:** Non-Super Admin cannot use `/admin` route even by URL; user sees a clean access-denied state.
- **Verification commands:**
  ```bash
  cd frontend
  npm run build
  cd ..
  npm test
  ```
- **Risk level:** medium

## Phase 2: Data/Auth/Security Repairs

### TASK-2.1 — Enforce Feeder Voltage Consistency

- **Linked finding:** A-013
- **Objective:** Prevent invalid 11kV/33kV transformer-feeder combinations.
- **Files likely to change:** `src/validators/transformerValidator.js`, `src/services/transformerService.js`, `frontend/src/pages/transformers/TransformerFormPage.tsx`, `src/tests/transformer.test.js`
- **Steps:**
  1. Load selected feeder during transformer create/update when `feeder_id` is provided.
  2. Compare feeder `network_voltage_kv` to transformer `network_voltage_kv`.
  3. Reject mismatch with a friendly validation error.
  4. Add frontend helper text/warning when selected feeder conflicts.
  5. Add tests for matching and mismatching feeder voltage.
- **Dependencies:** Reference data has feeder voltage.
- **Acceptance criteria:** A transformer cannot be saved to a mismatched voltage feeder.
- **Verification commands:**
  ```bash
  npx jest --testPathPatterns=src/tests/transformer --forceExit
  cd frontend
  npm run build
  ```
- **Risk level:** medium

### TASK-2.2 — Review Sensitive GPS Exposure

- **Linked finding:** A-002, A-009
- **Objective:** Confirm GPS data is exposed only to permitted users.
- **Files likely to change:** `src/services/transformerService.js`, `src/services/exportService.js`, `src/services/reportingService.js`, `src/services/syncService.js`, `frontend/src/pages/map/AssetMapPage.tsx`, tests
- **Steps:**
  1. List every endpoint returning GPS coordinates.
  2. Apply scoped filters from TASK-1.2.
  3. Decide whether exports should include GPS for non-Super Admin roles.
  4. Add tests for GPS scoping.
- **Dependencies:** TASK-1.2.
- **Acceptance criteria:** GPS cannot be queried outside user scope.
- **Verification commands:** `npm test`
- **Risk level:** high

## Phase 3: Core Feature Completion

### TASK-3.1 — Complete Maintenance Frontend Workflow

- **Linked finding:** A-006
- **Objective:** Add maintenance create/edit/detail comparable to inspections and faults.
- **Files likely to change:** `frontend/src/pages/maintenance`, `frontend/src/api/maintenanceApi.ts`, `frontend/src/routes/AppRoutes.tsx`, `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- **Steps:**
  1. Add `/maintenance/new`, `/maintenance/:id`, `/maintenance/:id/edit`.
  2. Build React Hook Form + Zod maintenance form.
  3. Support transformer preselection from Transformer Detail.
  4. Add detail page sections for work performed, readings, parts, notes, next maintenance.
  5. Invalidate maintenance, transformer, dashboard, and audit queries after changes.
- **Dependencies:** Scoped backend from Phase 1.
- **Acceptance criteria:** User can create, view, edit, and see maintenance history from transformer detail.
- **Verification commands:**
  ```bash
  cd frontend
  npm run build
  cd ..
  npm test
  ```
- **Risk level:** medium

### TASK-3.2 — Add Installation / Replacement UI

- **Linked finding:** A-007
- **Objective:** Expose installation/replacement workflow safely.
- **Files likely to change:** `frontend/src/pages/installations`, `frontend/src/api/installationApi.ts`, `frontend/src/routes/AppRoutes.tsx`, `frontend/src/pages/transformers/TransformerDetailPage.tsx`, `frontend/src/types/api.ts`
- **Steps:**
  1. Add installation API module.
  2. Add list/detail/form routes.
  3. Add replacement-specific previous-transformer selector.
  4. Show warning that replacement decommissions the previous transformer.
  5. Add transformer-detail installations tab.
  6. Add query invalidation for old and new transformer records.
- **Dependencies:** Backend installation tests should be reviewed first.
- **Acceptance criteria:** Replacement decommissions old transformer and timeline/history are visible.
- **Verification commands:**
  ```bash
  cd frontend
  npm run build
  cd ..
  npm test
  ```
- **Risk level:** high

### TASK-3.3 — Fix QR Scan/Open Contract

- **Linked finding:** A-005
- **Objective:** Make QR codes open the correct authenticated asset profile.
- **Files likely to change:** `src/services/qrService.js`, `src/controllers/qrController.js`, `src/routes/qrRoutes.js`, `frontend/src/pages/transformers/TransformerDetailPage.tsx`, possible `frontend/src/pages/qr`
- **Steps:**
  1. Define encoded QR payload and route target.
  2. Ensure generated QR target maps to existing frontend route.
  3. Implement scan endpoint only if needed and tested.
  4. Add authenticated QR landing page or lookup by asset ID.
  5. Record scan count/last scanned where supported.
- **Dependencies:** Product decision on scan UX.
- **Acceptance criteria:** Scanning or opening QR data lands on the correct transformer profile after login.
- **Verification commands:** `npm test`, `cd frontend && npm run build`
- **Risk level:** medium

### TASK-3.4 — Build Bulk Import UI

- **Linked finding:** A-008
- **Objective:** Provide Super Admin import workflow for existing UEDCL records.
- **Files likely to change:** `frontend/src/pages/import`, `frontend/src/api/importApi.ts`, `frontend/src/routes/AppRoutes.tsx`, backend import validator/service if gaps are found
- **Steps:**
  1. Audit current backend import behavior versus guide.
  2. Add `/import` Super Admin route.
  3. Build upload, column mapping, validation, preview, and history screens.
  4. Keep rollback disabled unless backend supports it safely.
  5. Add guard tests that non-Super Admin cannot import.
- **Dependencies:** Route guards and scoping.
- **Acceptance criteria:** Super Admin can validate and import a sample CSV/XLSX with clear row-level feedback.
- **Verification commands:** `cd frontend && npm run build`, `npm test`
- **Risk level:** high

## Phase 4: UX and Product Flow Improvements

### TASK-4.1 — Decide and Implement Real Map Experience

- **Linked finding:** A-009
- **Objective:** Align asset map with pilot needs.
- **Files likely to change:** `frontend/src/pages/map/AssetMapPage.tsx`, `frontend/package.json`, `.env.example`
- **Steps:**
  1. Decide whether Mapbox is mandatory for pilot.
  2. If yes, add Mapbox dependency and map token configuration.
  3. Render markers, clustering, filters, and popups using scoped transformer data.
  4. Keep CSS/dashboard fallback for missing token.
- **Dependencies:** GPS scoping complete.
- **Acceptance criteria:** Map displays real asset markers with filters and secure access.
- **Verification commands:** `cd frontend && npm run build`
- **Risk level:** medium

### TASK-4.2 — Expand Dashboard to PRD Scope

- **Linked finding:** A-014, A-015
- **Objective:** Add manager and field dashboard experiences without breaking the pilot UI.
- **Files likely to change:** `frontend/src/pages/dashboard/DashboardPage.tsx`, `frontend/src/api/dashboardApi.ts`, `src/services/dashboardService.js`
- **Steps:**
  1. Consume ready dashboard endpoints intentionally.
  2. Add alert panel, chart section, activity feed, and decision-support tables for manager roles.
  3. Add field dashboard for Field Technician role.
  4. Ensure territory/service-area scoping.
- **Dependencies:** Scoping fixed.
- **Acceptance criteria:** Dashboard matches manager/field PRD essentials.
- **Verification commands:** `cd frontend && npm run build`, `npm test`
- **Risk level:** medium

### TASK-4.3 — Add Photo Upload and Asset Gallery

- **Linked finding:** A-016
- **Objective:** Make photos visible and useful across field workflows.
- **Files likely to change:** `frontend/src/components/forms`, `frontend/src/pages/transformers/TransformerDetailPage.tsx`, form pages, API modules, file upload middleware if needed
- **Steps:**
  1. Define photo categories and linked-record behavior.
  2. Add upload controls to inspection, fault, maintenance, installation forms.
  3. Add photos tab grouped by category.
  4. Add size/type validation.
  5. Defer offline photo storage until Phase 5 if necessary.
- **Dependencies:** Storage provider readiness.
- **Acceptance criteria:** Photos uploaded through forms appear in asset profile.
- **Verification commands:** `cd frontend && npm run build`, `npm test`
- **Risk level:** medium

## Phase 5: Testing and Verification

### TASK-5.1 — Add Security Regression Suite

- **Linked finding:** A-001, A-002, A-011
- **Objective:** Prevent future regressions in auth and data access.
- **Files likely to change:** `src/tests/security.test.js`, frontend guard script/tests
- **Steps:**
  1. Test public register cannot create privileged users.
  2. Test non-Super Admin cannot reach admin APIs.
  3. Test role-scoped transformer/fault/inspection/maintenance reads.
  4. Test GPS scoping.
  5. Test frontend does not call not-ready endpoints.
- **Dependencies:** Phase 1 fixes.
- **Acceptance criteria:** Security regressions fail loudly.
- **Verification commands:** `npm test`
- **Risk level:** medium

### TASK-5.2 — Add Frontend Workflow Smoke Tests

- **Linked finding:** A-020
- **Objective:** Cover critical UI journeys beyond screenshots.
- **Files likely to change:** `scripts`, optional Playwright setup if approved
- **Steps:**
  1. Decide whether to add Playwright or keep Puppeteer.
  2. Automate login, dashboard, transformers, inspections, faults, maintenance, admin guards.
  3. Record browser console failures.
  4. Keep tests deterministic against Phase 9F seed data.
- **Dependencies:** Tooling decision.
- **Acceptance criteria:** Main UI route failures are caught before release.
- **Verification commands:** new browser validation command plus `npm test`
- **Risk level:** medium

### TASK-5.3 — Offline PWA Verification Suite

- **Linked finding:** A-003
- **Objective:** Prove offline field capture works.
- **Files likely to change:** `scripts`, frontend offline code
- **Steps:**
  1. Simulate offline mode.
  2. Create inspection/fault/maintenance/installation offline.
  3. Reconnect.
  4. Confirm sync and timeline updates.
  5. Test conflict behavior.
- **Dependencies:** Offline implementation.
- **Acceptance criteria:** Offline workflows work without data loss.
- **Verification commands:** dedicated offline browser test command
- **Risk level:** high

## Phase 6: Documentation Cleanup

### TASK-6.1 — Rewrite Local Onboarding

- **Linked finding:** A-018
- **Objective:** Make setup reproducible for a new developer.
- **Files likely to change:** `docs/LOCAL_ONBOARDING.md`, `docs/LOCAL_DEMO_USERS.md`, `README.md`
- **Steps:**
  1. Remove stale “backend-only” language.
  2. Document backend and frontend setup.
  3. Document seed/demo accounts.
  4. Document validation commands.
  5. Document known intentional gaps.
- **Dependencies:** Architecture decision.
- **Acceptance criteria:** New developer can run the app from scratch.
- **Verification commands:** `node scripts/checkLocalEnvironment.js`
- **Risk level:** low

### TASK-6.2 — Refresh API Readiness Map

- **Linked finding:** A-017, A-018, A-019
- **Objective:** Keep API docs aligned with actual readiness.
- **Files likely to change:** `docs/API_FRONTEND_READINESS_MAP.md`, `swagger.yaml`, `src/routes/index.js`
- **Steps:**
  1. Audit every mounted route.
  2. Mark ready, partial, stub, or deprecated.
  3. Correct test counts and latest phase references.
  4. Mark `/api/qr/*` and `/api/geo/*` stubs clearly.
  5. Update `/api/version` metadata.
- **Dependencies:** None.
- **Acceptance criteria:** Developers do not accidentally consume stubs.
- **Verification commands:** `npm test`
- **Risk level:** low
