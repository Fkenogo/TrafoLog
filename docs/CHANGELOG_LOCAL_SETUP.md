# Local Setup Change Log

---

## 2026-07-03 — Auth Contract Alignment for Browser Refresh (Session 11)

**Summary:** Aligned `/api/auth/refresh` with browser-based authentication. The route now permits cookie-only refresh requests so the controller can read the HTTP-only `refreshToken` cookie set at login. Refresh responses return only a new `accessToken` in JSON; refresh tokens remain in HTTP-only cookies. Added auth regression tests and corrected auth contract docs.

### Changed

| File | Change |
|---|---|
| `src/validators/authValidator.js` | Made `refreshToken` optional in the refresh request body so cookie-only browser refresh is not rejected by route validation |
| `src/controllers/authController.js` | Removed `refreshToken` from `/api/auth/refresh` JSON response while preserving refresh cookie updates |
| `src/tests/auth.test.js` | Added regression tests for cookie-only refresh, body-token refresh, missing refresh token, and no refresh token in auth JSON responses |
| `swagger.yaml` | Documented HTTP-only cookie refresh and optional body-token refresh; corrected auth schema details for register, reset password, change password, and profile update |
| `docs/API_FRONTEND_READINESS_MAP.md` | Updated auth response and request guidance to match backend behavior |

### Root cause

`authController.refreshToken` already supported `req.body.refreshToken || req.cookies.refreshToken`, but `authRoutes.js` ran Joi body validation first. The validator required `refreshToken` in the body, so browser requests relying only on the HTTP-only cookie failed before reaching the controller.

### Test result

Focused auth verification:

```
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

**Report:** `docs/superpowers/reports/2026-07-03-auth-contract-alignment.md`

---

## 2026-07-03 — Frontend Foundation (Phase 4)

**Summary:** Added a Vite + React frontend foundation in `frontend/` with authentication, protected routing, an enterprise application shell, live dashboard cards, read-only module pages, API service modules, loading/error/empty states, and documentation. The frontend consumes only endpoints marked ready in the API readiness map and hides stubbed modules.

### Changed

| File/Folder | Change |
|---|---|
| `frontend/` | Created Vite React TypeScript app with React Router, Axios, TanStack Query, React Hook Form, Zod, and Sonner |
| `frontend/src/api/` | Added contract-driven API modules for auth, transformers, inspections, faults, maintenance, and reference data |
| `frontend/src/contexts/AuthContext.tsx` | Added login, current user loading, refresh-cookie bootstrap, logout, and session expiry handling |
| `frontend/src/routes/` | Added `/login`, protected app routes, and redirects |
| `frontend/src/layouts/AppLayout.tsx` | Added sidebar, top navigation, breadcrumb placeholder, notification placeholder, profile menu, and responsive shell |
| `frontend/src/pages/` | Added dashboard, transformer list/detail, inspections, faults, maintenance, reference data, settings placeholder |
| `frontend/src/components/` | Added shared loading, error, empty state, error boundary, and table components |
| `frontend/src/styles/app.css` | Added enterprise utility dashboard styling |
| `docs/superpowers/reports/2026-07-03-frontend-foundation.md` | Created Phase 4 implementation report |

### Verification

```
cd frontend
npm install
npm run build
npm run dev
curl http://127.0.0.1:5173/
curl http://127.0.0.1:5173/api
```

Frontend build passed and Vite proxy reached the live backend API root.

**Report:** `docs/superpowers/reports/2026-07-03-frontend-foundation.md`

---

## 2026-07-02 — Swagger/API Contract Cleanup (Session 10)

**Summary:** Rewrote `swagger.yaml` from 3 documented paths to 60 (fixed critical duplicate-key YAML bug). Fixed `Notification validation failed: title is required` that appeared on every fault creation. Corrected 7 errors in `API_FRONTEND_READINESS_MAP.md`. 88/88 tests unchanged.

### Changed

| File | Change |
|---|---|
| `swagger.yaml` | Complete rewrite — 60 documented MVP paths, global bearerAuth scheme, no duplicate keys |
| `src/services/notificationService.js` | Added `title` derivation in `sendNotification`; changed notification catch blocks from `logger.error` → `logger.warn` |
| `docs/API_FRONTEND_READINESS_MAP.md` | Corrected 7 errors (wrong routes, missing endpoints, wrong HTTP methods) |

### Bug fixed: Notification `title` validation failure

`notificationService.sendNotification` created `new Notification({...})` without `title`, but the model requires it. Every fault creation triggered "Notification validation failed: title is required" in logs. Fixed by deriving `title` from notification `type` via a lookup map in `sendNotification`.

### Bug fixed: Swagger duplicate-key YAML bug

`swagger.yaml` had two `/transformers:` entries. YAML parsers keep the last value — the GET operation was silently lost. Only the POST endpoint appeared in Swagger UI. Fixed in the rewrite.

### API_FRONTEND_READINESS_MAP.md corrections

- Removed incorrect `GET /ratings/:id` (route does not exist)
- Added `GET /faults/open`, `GET /faults/transformer/:transformerId`, `PUT /faults/:id/resolve`
- Corrected fault assign/close/escalate from POST → PUT (correct HTTP method)
- Added `PUT /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:sessionToken`
- Added `GET /maintenance/stats`, `GET /maintenance/upcoming`

### Test result

```
Test Suites: 5 passed, 5 total
Tests:       88 passed, 88 total  (unchanged)
```

**Report:** `docs/superpowers/reports/2026-07-02-swagger-api-contract-cleanup.md`

---

## 2026-07-02 — Backend Stabilization & Frontend Readiness (Session 9)

**Summary:** Fixed 3 backend bugs: decommission body validation was not wired in the route (silent data loss), AuditLog writes silently failed for all auth operations due to missing `action_category` field, and dev SMTP noise flooded logs on every email attempt. Added 3 tests. 88/88 passing. Created `docs/API_FRONTEND_READINESS_MAP.md`.

### Changed

| File | Change |
|---|---|
| `src/routes/transformerRoutes.js` | Added `decommissionTransformerSchema` import + `validate()` middleware to `POST /:id/decommission` |
| `src/services/authService.js` | Added `action_category: 'AUTH'` to `logAction`; made `requestPasswordReset` email non-fatal |
| `src/utils/email.js` | Early-exit with `logger.warn` when `SMTP_HOST` not configured |
| `src/tests/transformer.test.js` | Added 2 decommission validation tests (missing reason, invalid enum) |
| `src/tests/auth.test.js` | Added AuditLog audit trail test |
| `docs/API_FRONTEND_READINESS_MAP.md` | CREATED — full API readiness map for frontend |

### Bug fixed: Decommission validation not wired

`POST /api/transformers/:id/decommission` had no body validation middleware. The `decommissionTransformerSchema` Joi schema existed in `transformerValidator.js` but was never imported into `transformerRoutes.js`. Requests without a `reason` silently passed to the service and stored `undefined` in the timeline.

### Bug fixed: AuditLog writes silently failed for all auth operations

`authService.logAction` created `new AuditLog({...})` without `action_category`, which is `required: true` in the model. Every call (login, logout, register, password reset, etc.) threw a Mongoose `ValidationError` that was caught and swallowed — so auth operations didn't crash, but zero audit records were ever written for auth actions. Fixed by adding `action_category: 'AUTH'` (all authService actions are auth-domain).

Also changed `logger.error` → `logger.warn` for audit log failures — non-fatal noise should not appear at error severity.

### Bug fixed: Dev SMTP noise

`email.js` attempted a nodemailer connection on every email, even with no `SMTP_HOST` configured. Fixed by early-returning with `logger.warn` when `SMTP_HOST` is absent. In production (SMTP_HOST set), behavior is unchanged. Also wrapped `requestPasswordReset` email call non-fatally (it was unguarded, causing password reset to return 500 in dev when SMTP failed).

### Test result

```
Test Suites: 5 passed, 5 total
Tests:       88 passed, 88 total  (3 new + 85 existing)
```

**Report:** `docs/superpowers/reports/2026-07-02-backend-stabilization-frontend-readiness.md`

---

## 2026-06-26 — Transformer Stubs Implementation (Session 8)

**Commit:** TBD (this session)

**Summary:** Implemented 7 stubbed transformer controller methods: `search`, `getByServiceArea`, `getNearby`, `getTimeline`, `getQRCode`, `decommission`, `bulkCreate`. Fixed a pre-existing broken `generateQRCode` import in `transformerService.js` that had silently blocked all `POST /api/transformers` (create) requests since initial commit. Added 25 new tests. 85/85 tests passing.

### Changed

| File | Change |
|---|---|
| `src/controllers/transformerController.js` | Implemented 7 stub methods; added TimelineService + QRService imports |
| `src/services/transformerService.js` | Added `getTransformersByServiceArea`; fixed `generateQRCode` import bug |
| `src/tests/transformer.test.js` | CREATED — 25 new tests, all 7 endpoints + auth guards |

### Bug fixed (pre-existing)

`transformerService.js` imported `{ generateQRCode }` from `../utils/qrGenerator`, but that module exports an instance (`new QRGenerator()`), not a named function. `generateQRCode` was always `undefined`, causing a TypeError on every `createTransformer` call. Never caught because all existing tests bypassed the service, creating transformers via `Transformer.create()` directly.

**Fix:** `const qrGeneratorUtil = require('../utils/qrGenerator')` → `qrGeneratorUtil.generate(JSON.stringify(qrData))`.

### Design notes

- `search` is a named alias for the same `searchTransformers` logic used by `getAll` — added for API semantics
- `getByServiceArea` follows the exact same pattern as `getTransformersByTerritory`: returns `{ transformers, stats }`
- `getNearby` requires `lat` and `lng` query params; validates presence before delegating to `getNearbyTransformers`
- `getQRCode` uses `QRService.generateQR` which is generate-or-retrieve (idempotent)
- `bulkCreate` returns HTTP 207 Multi-Status with `{ success: [], failed: [], errors: [] }` shape
- `decommission` body validation (`reason` field) is not yet wired in the route — the `decommissionTransformerSchema` Joi validator exists but needs to be added to `transformerRoutes.js` in a future session

### Test result

```
Test Suites: 5 passed, 5 total
Tests:       85 passed, 85 total  (25 new + 60 existing)
```

**Report:** `docs/superpowers/reports/2026-06-23-transformer-stubs-implementation.md`

---

## 2026-06-23 — Fault Stats Bug Fix (Session 7)

**Commit:** TBD (this session)

**Summary:** Fixed pre-existing bug where `GET /api/faults/stats` returned 500. Single-character fix in controller: wrong method name `getFaultStats` → correct name `getFaultStatistics`. Added 3 new TDD tests. 60/60 tests passing.

### Changed

| File | Change |
|---|---|
| `src/controllers/faultController.js` | Fixed: `getFaultStats` → `getFaultStatistics` (one line) |
| `src/tests/fault.test.js` | Added 3 stats tests (200, shape, 401 guard) |

### Root cause

`faultController.getStats` called `FaultService.getFaultStats()` which never existed. The service method was always `getFaultStatistics`. JavaScript only resolves method names at call time, so no startup error — the 500 only appeared on the first request to `GET /api/faults/stats`.

### Test result

```
Test Suites: 4 passed, 4 total
Tests:       60 passed, 60 total  (3 new + 57 existing)
```

**Report:** `docs/superpowers/reports/2026-06-23-fault-stats-fix.md`

---

## 2026-06-23 — Inspection Endpoint Implementation (Session 5)

**Commit:** TBD (this session)

**Summary:** Implemented 5 stubbed inspection controller methods: `getAll`, `update`, `delete`, `getOverdue`, `getLatest`. Used TDD: wrote 11 failing tests first, verified 501 RED, then implemented, verified GREEN. All 41 tests pass.

### Changed

| File | Change |
|---|---|
| `src/controllers/inspectionController.js` | Implemented `getAll`, `update`, `delete`, `getOverdue`, `getLatest` |
| `src/tests/inspection.test.js` | CREATED — 11 new tests, TDD |

### Design notes

- **Soft delete confirmed**: `Inspection` model has `is_deleted` field; `deleteInspection` service calls `BaseService.delete()` (soft-delete) and updates `transformer.last_inspection_date`.
- **`getOverdue` returns Transformers**: `InspectionService.getOverdueInspections()` queries the Transformer collection, returning transformers with no recent inspection. Response `data` array contains Transformer objects.
- **`getLatest` null guard**: `getLatestInspection` returns null (not ApiError) when no inspection exists. Controller returns 404 in that case.
- **`getAll` filters `is_deleted: false`**: Unlike `getInspectionsByTransformer`, `getAll` explicitly excludes soft-deleted records.
- **Gotcha**: Creating Transformers directly via Mongoose requires valid `gps.coordinates` to satisfy the 2dsphere index (the `gps.type` defaults to `'Point'` which triggers the index).

### Test result

```
Test Suites: 3 passed, 3 total
Tests:       41 passed, 41 total  (11 new + 30 existing)
```

**Report:** `docs/superpowers/reports/2026-06-23-inspection-implementation.md`

---

Tracks changes made to bring the kVAssetTracker backend to a working local state. Not for production deployment; see git history for feature changes.

---

## 2026-06-23 — Fault Endpoint Implementation (Session 6)

**Commit:** TBD (this session)

**Summary:** Implemented 6 stubbed fault controller methods: `getAll`, `getById`, `getAssignedToMe`, `close`, `escalate`, `delete`. Made 4 notification calls in faultService non-fatal (SMTP not configured locally). Added 16 new tests via TDD. All 57 tests passing.

### Changed

| File | Change |
|---|---|
| `src/controllers/faultController.js` | Implemented `getAll`, `getById`, `getAssignedToMe`, `close`, `escalate`, `delete` |
| `src/services/faultService.js` | Wrapped 4 notification calls in non-fatal try/catch (consistent with auth service pattern) |
| `src/tests/fault.test.js` | CREATED — 16 new tests, TDD |

### Design notes

- **Hard delete**: Fault model has no `is_deleted` — `FaultService.hardDelete(id)` used. Route is Super Admin only.
- **`status` → `fault_status` mapping**: query param `status` maps to model field `fault_status`.
- **Close lifecycle**: `closeFault` validates fault must be `Resolved` first → 400 if not.
- **Non-fatal notifications**: SMTP failures are now non-fatal in fault operations. Without this fix, `assignFault` always fails (email is always sent). Pattern matches Session 2's `authService` fix.
- **Pre-existing bug NOT fixed**: `getStats` calls `getFaultStats` but service has `getFaultStatistics` → 500.
- **Missing schema fields**: `escalation_reason`, `reviewed_by` etc. exist in service logic but not in Fault schema — Mongoose strict mode drops them silently.
- **Test transformer**: needs `location_administrative.site_name` to avoid TypeError in notification email templates.

### Test result

```
Test Suites: 4 passed, 4 total
Tests:       57 passed, 57 total  (16 new + 41 existing)
```

**Report:** `docs/superpowers/reports/2026-06-23-fault-implementation.md`

---

## 2026-06-23 — Location Reference Data Implementation (Session 4)

**Commit:** TBD (this session)

**Summary:** Implemented 5 location/reference-data controllers (Territory, ServiceArea, Feeder, District, Rating). Fixed a pre-existing bug in feederValidator. Removed dead-code 501 stub from maintenanceController. Added 24 new tests via TDD.

### Changed

| File | Change |
|---|---|
| `src/controllers/territoryController.js` | Replaced notImpl stubs with asyncHandler CRUD (5 methods) |
| `src/controllers/serviceAreaController.js` | Replaced notImpl stubs with asyncHandler CRUD + getByTerritory (6 methods) |
| `src/controllers/feederController.js` | Replaced notImpl stubs with asyncHandler CRUD + getByServiceArea (6 methods) |
| `src/controllers/districtController.js` | Replaced notImpl stubs with asyncHandler read-only (3 methods) |
| `src/controllers/ratingController.js` | Replaced notImpl stubs with asyncHandler CRUD + getByNetworkVoltage (5 methods) |
| `src/controllers/maintenanceController.js` | Removed dead-code getStats 501 stub (shadowed by class field) |
| `src/validators/feederValidator.js` | Fixed: `territory_id` → `service_area_id`, `voltage_kv` → `network_voltage_kv` |
| `src/tests/referenceData.test.js` | Created — 24 new tests, TDD |

### Delete behavior

All reference-data models lack `is_deleted`. **Hard delete** (`findByIdAndDelete`) is used for all DELETE endpoints. Safe for MVP; reconsider before production if data integrity across foreign refs is required.

### Test result

```
Test Suites: 2 passed, 2 total
Tests:       30 passed, 30 total  (24 new + 6 existing)
```

**Report:** `docs/superpowers/reports/2026-06-23-location-reference-implementation.md`

---

## 2026-06-23 — 501 Stub Priority Audit (Session 3)

**Commit:** N/A (no code changed — audit only)

**Summary:** Full audit of all 501 Not Implemented stubs across controllers and services. Produced implementation priority map with MVP ranking and recommended next 3 modules.

### Findings

| Metric | Count |
|---|---|
| Controllers with all methods stubbed | 12 |
| Controllers with partial stubs | 4 |
| Total stubbed endpoints | 80 |
| Service files fully stubbed | 1 (reportService.js — 16 methods) |
| Swagger coverage | ~5% (3 of 60+ endpoints) |

**Dead-code bug found:** `maintenanceController.js:206` — the `async getStats` prototype method is unreachable because a class field `getStats = asyncHandler(...)` at line 138 shadows it. The 501 stub never executes.

**Test result:** 6/6 passing (unchanged)

**Report:** `docs/superpowers/reports/2026-06-23-stub-priority-audit.md`

### Recommended implementation order

1. **Location Reference Data** (Territory + ServiceArea + Feeder + District + Rating) — LOW difficulty, unblocks transformer creation
2. **Inspection stubs** (getAll, update, delete, getOverdue, getLatest) — LOW difficulty, completes field inspection workflow
3. **Fault stubs** (getAll, getById, getAssignedToMe, close, escalate, delete) — LOW difficulty, completes fault lifecycle

---

## 2026-06-22 — Onboarding Cleanup (Session 2)

**Commit:** TBD (this session)

**Summary:** Replaced generic Proxy wrappers with explicit named stubs or bound methods across all controllers. Fixed Jest test suite. Fixed authController missing import. Made SMTP failure non-fatal on registration.

### Changed

| File | Change |
|---|---|
| `src/app.js` | Guard `app.start()` with `if (require.main === module)` to prevent auto-start when imported by tests |
| `src/tests/auth.test.js` | Full rewrite: DB/Redis lifecycle, `app.getApp()` for supertest, refreshToken from Set-Cookie header |
| `src/controllers/authController.js` | Added missing `User` import; removed Proxy; export with `.bind(_ctrl)` per method (needed for `this.setTokenCookies`) |
| `src/services/authService.js` | Wrapped `sendVerificationEmail` in try/catch in `register()` — SMTP failure is non-fatal |
| `src/controllers/transformerController.js` | Removed Proxy; added 7 explicit 501 stubs inside class |
| `src/controllers/inspectionController.js` | Removed Proxy; added 5 explicit 501 stubs inside class |
| `src/controllers/faultController.js` | Removed Proxy; added 6 explicit 501 stubs inside class |
| `src/controllers/maintenanceController.js` | Removed Proxy; added `getStats` stub inside class (4 others already existed as class fields) |
| `src/controllers/installationController.js` | Removed Proxy only (all methods already present as class fields) |
| `src/controllers/dashboardController.js` | Removed Proxy only |
| `src/controllers/reportController.js` | Removed Proxy only |
| `src/controllers/importController.js` | Removed Proxy only |
| `src/controllers/notificationController.js` | Removed Proxy only |
| `src/controllers/timelineController.js` | Removed Proxy only |
| `src/controllers/syncController.js` | Removed Proxy only |
| 12 new stub controllers | Replaced `new Proxy({}, {...})` with `const notImpl = (name) => ...` explicit exports |
| `src/services/reportService.js` | Replaced Proxy with explicit named `notImpl` function exports (16 methods) |

**Test result:** 6/6 passing

---

## 2026-06-21 — Initial Local Onboarding (Session 1)

**Commit:** 77fabcb

**Summary:** Made the backend start and serve locally. MongoDB 7 + Redis 8 set up via Homebrew. Fixed 56 files to resolve startup crashes.

### Environment

- MongoDB 7 running via `brew services start mongodb-community`
- Redis 8 running via `brew services start redis`
- `.env` present locally (not tracked in git)

### Changed (selected highlights)

| File | Change |
|---|---|
| `package.json` | Fixed test/start script paths |
| `src/config/database.js` | Removed deprecated `useNewUrlParser`, `useUnifiedTopology` |
| `src/routes/index.js` | Fixed Express 5 wildcard route syntax |
| `src/routes/syncRoutes.js` | Added missing `authorize` middleware import |
| `src/middleware/rateLimiter.js` | Removed `keyGenerator` that caused `ERR_ERL_KEY_GEN_IPV6` |
| `src/middleware/fileUpload.js` | Implemented from 0 bytes; added path traversal fix (`crypto.randomBytes` filename) |
| 12 model files | Removed `next` from async pre-save hooks (Kareem 3.3.0 change) |
| 3 script files | Removed deprecated Mongoose options |
| `src/utils/validation.js` | Created bridge to `authValidator` |
| `src/utils/sms.js` | Created stub for missing `notificationService` dependency |
| 5 validator files | Created stubs required by route files |
| 12 new controllers | Created with Proxy stubs (replaced in Session 2) |
| `src/services/reportService.js` | Created with Proxy stubs (replaced in Session 2) |

**Preview URLs verified:**
- `http://localhost:3000/health` — 200
- `http://localhost:3000/api` — 200
- `http://localhost:3000/api-docs/` — 200

---

## Notes

- `.env` is NOT tracked in git. Copy `.env.example` → `.env` for new installs.
- See `docs/LOCAL_ONBOARDING.md` for first-time setup instructions.
- Detailed per-session audit: `docs/superpowers/reports/2026-06-22-onboarding-cleanup-audit.md`
