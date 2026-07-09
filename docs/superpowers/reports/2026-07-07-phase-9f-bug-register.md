# Phase 9F Bug Register

## Summary

| Severity | Count |
|---|---:|
| Critical | 8 |
| High | 6 |
| Medium | 4 |
| Low | 3 |

## Phase 9F-Fix1 Status

| Bug | Severity | Status | Fix1 outcome |
|---|---|---|---|
| BUG-9F-001 | Critical | Fixed | Transformer detail now uses the real service method and returns 200 for valid IDs. |
| BUG-9F-002 | Critical | Fixed | Inspection detail now uses the real service method and returns 200 for valid IDs. |
| BUG-9F-003 | Critical | Fixed | Asset-register report tolerates missing GPS and returns `N/A` coordinates. |
| BUG-9F-004 | Critical | Fixed | Asset-register JSON export shares the missing-GPS-safe report path. |
| BUG-9F-005 | Critical | Fixed | Asset-register CSV export shares the missing-GPS-safe report path. |
| BUG-9F-006 | Critical | Fixed | Missing transformer detail now returns clean 404 through the corrected service path. |
| BUG-9F-007 | Critical | Fixed | Fault list response is normalized defensively; Phase 9F browser capture no longer crashes on `/faults`. |
| BUG-9F-008 | Critical | Fixed | Maintenance list response and `DataTable` rows are normalized defensively; Phase 9F browser capture no longer crashes on `/maintenance`. |
| BUG-9F-009 | High | Fixed | Report/export failures are fixed and the backend test script now runs integration suites serially to avoid shared Mongo/Redis worker contention. Exact `npm test` passes 184/184. |
| BUG-9F-010 | High | Fixed | Phase 9F validation now uses the existing ready dashboard KPI endpoint `/api/dashboard/kpi`. |
| BUG-9F-011 | High | Fixed | Restore refresh validation now uses `/api/dashboard/kpi` through the same contract alignment. |
| BUG-9F-012 | High | Fixed | Nearby validation now sends `lat`/`lng`, matching the backend contract and existing frontend wrapper. |
| BUG-9F-013 | High | Fixed | Browser capture now performs `/api/version` and `/api/admin/system-stats` preflight checks before screenshots. |
| BUG-9F-014 | High | Fixed | Admin workspace queries now load by active tab with stale windows, reducing parallel admin refetch pressure. |
| BUG-9F-015 | Medium | Deferred | Notification validation warning remains out of scope for this Critical/High sprint. |
| BUG-9F-016 | Medium | Deferred | Dashboard status-chart data mapping remains out of scope for this Critical/High sprint. |
| BUG-9F-017 | Medium | Deferred | Mobile layout compaction remains a later UX polish item. |
| BUG-9F-018 | Medium | Deferred | Expected unauthenticated refresh 401 remains visible in browser console. |
| BUG-9F-019 | Low | Deferred | Missing favicon remains. |
| BUG-9F-020 | Low | Deferred | React Router future-flag warnings remain. |
| BUG-9F-021 | Low | Deferred | Multi-browser validation remains a release-validation follow-up. |

## Phase 9F-Rerun Status

| Bug | Severity | Status | Rerun outcome |
|---|---|---|---|
| BUG-9F-001 | Critical | Fixed | API validation confirms transformer detail works. |
| BUG-9F-002 | Critical | Fixed | API validation confirms inspection detail works. |
| BUG-9F-003 | Critical | Fixed | Asset-register report passed. |
| BUG-9F-004 | Critical | Fixed | Asset-register JSON export passed. |
| BUG-9F-005 | Critical | Fixed | Asset-register CSV export passed. |
| BUG-9F-006 | Critical | Fixed | Missing transformer returns clean 404. |
| BUG-9F-007 | Critical | Fixed | `/faults` browser capture no longer shows the application error boundary. |
| BUG-9F-008 | Critical | Fixed | `/maintenance` browser capture no longer shows the application error boundary. |
| BUG-9F-009 | High | Still failing | `npm test` failed after refreshed evidence run: 6 suites failed, 123 tests failed, 61 passed. Failures are setup-hook timeouts. |
| BUG-9F-010 | High | Fixed | Dashboard KPI validation passed against `/api/dashboard/kpi`. |
| BUG-9F-011 | High | Fixed | Dashboard refresh after restore passed. |
| BUG-9F-012 | High | Fixed | Nearby search passed with `lat`/`lng`. |
| BUG-9F-013 | High | Fixed | Browser preflight confirmed current backend version `2.0.0` and Admin stats HTTP 200. |
| BUG-9F-014 | High | Fixed | Admin Operations rendered against current backend without stale/not-ready endpoint evidence. |
| BUG-9F-015 | Medium | Still failing | Non-fatal notification validation warning still appears during fault assignment. |
| BUG-9F-016 | Medium | Deferred | Dashboard data-presentation polish still needs a focused UI pass. |
| BUG-9F-017 | Medium | Deferred | Mobile dashboard remains long. |
| BUG-9F-018 | Medium | Still failing | Expected unauthenticated refresh 401 remains visible in browser console. |
| BUG-9F-019 | Low | Still failing | Missing favicon 404 remains. |
| BUG-9F-020 | Low | Still failing | React Router future-flag warnings remain. |
| BUG-9F-021 | Low | Deferred | Cross-browser validation remains incomplete. |

### BUG-9F-022: Backend test suite times out after refreshed Phase 9F evidence

- **Severity:** High
- **Status:** New issue
- **Steps:** Run the full refreshed evidence chain, then run `npm test`.
- **Expected:** Full backend suite passes.
- **Actual:** `npm test` failed with 6 suites failed, 123 tests failed, and 61 tests passed. Failures were setup-hook timeouts in integration suites after the seeded/backup/restore validation flow.
- **Suggested fix:** Create a focused test-harness stabilization sprint: isolate test data, reduce broad cleanup, verify maintenance/backup/restore state reset, and ensure Mongo/Redis lifecycle remains healthy after Phase 9F seed and restore workflows.

## Phase 9F-Fix2 Status

| Bug | Severity | Status | Fix2 outcome |
|---|---|---|---|
| BUG-9F-009 | High | Fixed | `npm test` now passes after the full Phase 9F seed/API/browser validation chain. |
| BUG-9F-015 | Medium | Fixed | Fault assignment now resolves a valid recipient and creates a `FAULT_ASSIGNED` in-app notification. Local SMTP failures are handled after notification creation and do not mark notification creation failed. |
| BUG-9F-018 | Medium | Deferred | The remaining browser console entry is the expected unauthenticated `/api/auth/refresh` 401 before login. Session semantics were left unchanged. |
| BUG-9F-019 | Low | Fixed | Added a frontend SVG favicon and linked it from `index.html`; favicon 404 no longer appears in refreshed browser evidence. |
| BUG-9F-020 | Low | Fixed | Opted into React Router `v7_startTransition` and `v7_relativeSplatPath` future flags; warnings no longer appear in refreshed browser evidence. |
| BUG-9F-021 | Low | Deferred | Automated browser evidence remains Chromium-only. Pilot scope should explicitly include Chrome/Edge first, with Safari/Firefox as manual or later Playwright coverage. |
| BUG-9F-022 | High | Fixed | Root cause addressed by removing test-runtime app side effects and fixing notification middleware; full backend suite passes after Phase 9F validation. |

## Phase 9G Status

| Bug | Severity | Status | Phase 9G outcome |
|---|---|---|---|
| BUG-9F-016 | Medium | Fixed | Dashboard transformer status display now normalizes multiple stats shapes and friendly status labels. |
| BUG-9F-017 | Medium | Fixed | Mobile dashboard lower-priority widgets are compacted into collapsible sections while desktop layout remains intact. |
| BUG-9F-018 | Medium | Fixed | Login-page bootstrap no longer calls refresh when there is no access token, removing the expected pre-login refresh 401 from browser evidence while preserving protected-route cookie refresh behavior. |
| BUG-9F-021 | Low | Deferred | Browser support is documented for pilot: Chrome/Edge primary, Safari/Firefox manual validation recommended. Screenshot script now records Puppeteer/Chromium metadata. |

## Critical

### BUG-9F-001: Transformer detail API returns 500

- **Steps:** Create transformer through API validation, then call `GET /api/transformers/:id`.
- **Expected:** HTTP 200 with transformer detail.
- **Actual:** HTTP 500: `TransformerService.getTransformerById is not a function`.
- **Suggested fix:** Align transformer controller with actual service method name and add regression coverage for detail 200 and missing-record 404.

### BUG-9F-002: Inspection detail API returns 500

- **Steps:** Create inspection through API validation, then call `GET /api/inspections/:id`.
- **Expected:** HTTP 200 with inspection detail.
- **Actual:** HTTP 500: `InspectionService.getInspectionById is not a function`.
- **Suggested fix:** Align inspection controller with actual service method name and add detail/missing-record tests.

### BUG-9F-003: Asset-register report fails

- **Steps:** Call `GET /api/reports/asset-register?format=json`.
- **Expected:** HTTP 200 with asset-register report.
- **Actual:** HTTP 500: `Failed to generate asset register`.
- **Suggested fix:** Harden reporting service against transformers with missing GPS and add tests with missing coordinates.

### BUG-9F-004: Asset-register JSON export fails

- **Steps:** Call asset-register JSON export.
- **Expected:** HTTP 200 export response.
- **Actual:** HTTP 500: `Failed to generate asset register`.
- **Suggested fix:** Share the asset-register report fix with export generation and test both formats.

### BUG-9F-005: Asset-register CSV export fails

- **Steps:** Call asset-register CSV export.
- **Expected:** HTTP 200 `text/csv`.
- **Actual:** HTTP 500: `Failed to generate asset register`.
- **Suggested fix:** Share the asset-register report fix with CSV export generation and test missing GPS rows.

### BUG-9F-006: Transformer missing-record error returns 500 instead of 404

- **Steps:** Call `GET /api/transformers/000000000000000000000000`.
- **Expected:** Clean HTTP 404 response.
- **Actual:** HTTP 500: `TransformerService.getTransformerById is not a function`.
- **Suggested fix:** Fix service wiring and preserve clean not-found handling.

### BUG-9F-007: Faults page crashes in browser

- **Steps:** Login as Super Admin and open `/faults`.
- **Expected:** Fault Queue loads with table/filter/error state.
- **Actual:** Application error boundary; console shows `forEach is not a function` in `FaultsPage`.
- **Suggested fix:** Normalize fault list API response before iteration and add UI regression test for non-array/enveloped responses.

### BUG-9F-008: Maintenance page crashes in browser

- **Steps:** Login as Super Admin and open `/maintenance`.
- **Expected:** Maintenance list loads with table/filter/error state.
- **Actual:** Application error boundary; console shows `rows.map is not a function` in `DataTable`/`MaintenancePage`.
- **Suggested fix:** Normalize maintenance list response and make `DataTable` defensively handle non-array rows.

## High

### BUG-9F-009: Full backend test suite fails after Phase 9F seeding

- **Steps:** Run `npm test` after seeding Phase 9F validation data.
- **Expected:** Full backend suite passes.
- **Actual:** 3 suites failed, 22 tests failed, 153 tests passed. Report suite fails asset-register shape assertion; fault suite also hit hook timeouts in the full parallel run.
- **Suggested fix:** Fix seeded-data report/export defect first, then rerun full suite with attention to fault test setup/teardown and parallel database contention.

### BUG-9F-010: Dashboard KPI endpoint missing

- **Steps:** Call `GET /api/dashboard/stats`.
- **Expected:** HTTP 200 dashboard KPI payload.
- **Actual:** HTTP 404: `Route /api/dashboard/stats not found`.
- **Suggested fix:** Align dashboard frontend/API wrapper with documented backend endpoint or add the tested route intentionally.

### BUG-9F-011: Dashboard refresh after restore hits missing KPI endpoint

- **Steps:** Complete restore, then refresh dashboard stats.
- **Expected:** Dashboard refresh succeeds.
- **Actual:** HTTP 404 for `/api/dashboard/stats`.
- **Suggested fix:** Same as BUG-9F-010; rerun restore-refresh workflow afterward.

### BUG-9F-012: Nearby search query contract mismatch

- **Steps:** Call `/api/transformers/nearby?latitude=0.36&longitude=32.62&radius=10&limit=10`.
- **Expected:** HTTP 200 nearby result.
- **Actual:** HTTP 400: `lat and lng query parameters are required`.
- **Suggested fix:** Standardize wrapper/UI to `lat`/`lng` or broaden backend validator aliases if desired.

### BUG-9F-013: Admin browser validation showed stale/not-ready endpoint responses

- **Steps:** Open `/admin` through Vite proxy to the already-running backend on port 3000.
- **Expected:** Admin overview/operations data loads from ready endpoints.
- **Actual:** Browser console captured 501/404 responses for Admin endpoints.
- **Suggested fix:** Restart backend with current code before browser validation and add environment health/version display to avoid stale-server confusion.

### BUG-9F-014: Admin Operations panels hit rate limiting during validation

- **Steps:** Open Admin Operations after repeated validation activity.
- **Expected:** Maintenance status and backup history load or show retryable operational state.
- **Actual:** UI displayed `Too many requests, please try again later.`
- **Suggested fix:** Tune local/dev rate limits for admin polling or reduce parallel panel refetches.

## Medium

### BUG-9F-015: Fault assignment logs notification validation warning

- **Steps:** Assign a fault through API validation.
- **Expected:** Assignment succeeds and optional notification writes cleanly.
- **Actual:** Server warning: `Notification validation failed: user_id: User ID is required`.
- **Suggested fix:** Ensure notification payload includes recipient user id or skip notification creation when no recipient exists.

### BUG-9F-016: Dashboard transformer status chart empty despite seeded data

- **Steps:** Open dashboard after seeding 50 Phase 9F transformers.
- **Expected:** Transformer status distribution displays values.
- **Actual:** Panel displays `No transformer status data`.
- **Suggested fix:** Verify dashboard status field mapping and stats aggregation contract.

### BUG-9F-017: Mobile dashboard is very long

- **Steps:** Open dashboard at 390px width.
- **Expected:** Mobile workflow remains compact and easy to scan.
- **Actual:** Page stacks every card and list into a very long scroll.
- **Suggested fix:** Add mobile grouping/collapsible sections for lower-priority widgets.

### BUG-9F-018: Browser console includes initial auth refresh 401

- **Steps:** Open app before login/session restoration.
- **Expected:** No alarming console errors for expected unauthenticated state.
- **Actual:** `/api/auth/refresh` returns 401 in console.
- **Suggested fix:** Suppress expected refresh failures or avoid refresh attempt when no session cookie/token is present.

## Low

### BUG-9F-019: Missing favicon

- **Steps:** Open app in browser.
- **Expected:** Favicon loads.
- **Actual:** `favicon.ico` 404.
- **Suggested fix:** Add app favicon or route to existing asset.

### BUG-9F-020: React Router future flag warnings

- **Steps:** Open app in development.
- **Expected:** Clean console apart from actionable warnings.
- **Actual:** React Router v7 future flag warnings repeat.
- **Suggested fix:** Opt into future flags or track during dependency upgrade.

### BUG-9F-021: Cross-browser validation not complete

- **Steps:** Attempt Phase 9F browser coverage.
- **Expected:** Chrome, Edge, Safari, and Firefox coverage.
- **Actual:** Automated screenshots used Chromium-compatible capture only.
- **Suggested fix:** Add Playwright multi-browser validation in a dedicated release-validation pass.
