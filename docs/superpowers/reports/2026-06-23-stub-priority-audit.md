# kVAssetTracker — 501 Stub Priority Audit

**Date:** 2026-06-23  
**Session:** Audit only — no code changed  
**Test result:** 6/6 passing (npm test)

---

## 1. Files Inspected

| File | Role |
|---|---|
| `src/controllers/transformerController.js` | Partial — 7 stubs remain |
| `src/controllers/inspectionController.js` | Partial — 5 stubs remain |
| `src/controllers/faultController.js` | Partial — 6 stubs remain |
| `src/controllers/maintenanceController.js` | Partial — 1 dead-code stub (see note) |
| `src/controllers/territoryController.js` | Full stub — all 5 methods |
| `src/controllers/serviceAreaController.js` | Full stub — all 6 methods |
| `src/controllers/feederController.js` | Full stub — all 6 methods |
| `src/controllers/districtController.js` | Full stub — all 3 methods |
| `src/controllers/ratingController.js` | Full stub — all 5 methods |
| `src/controllers/userController.js` | Full stub — all 9 methods |
| `src/controllers/adminController.js` | Full stub — all 7 methods |
| `src/controllers/analyticsController.js` | Full stub — all 4 methods |
| `src/controllers/exportController.js` | Full stub — all 4 methods |
| `src/controllers/auditController.js` | Full stub — all 4 methods |
| `src/controllers/qrController.js` | Full stub — all 4 methods |
| `src/controllers/geoController.js` | Full stub — all 5 methods |
| `src/services/reportService.js` | Full stub — all 16 service methods |
| `src/routes/*.js` (all 19 route files) | Route mapping verified |
| `swagger.yaml` | Swagger coverage verified |
| `src/services/baseService.js` | Available CRUD base class |
| `src/services/faultService.js` | Service methods cross-referenced |
| `src/services/inspectionService.js` | Service methods cross-referenced |
| `src/services/transformerService.js` | Service methods cross-referenced |

---

## 2. Stub Methods Found — Complete Inventory

### A. Partial controllers (some methods implemented, some stubbed)

#### `src/controllers/transformerController.js`

Implemented: `create`, `getAll`, `getById`, `update`, `delete`, `getStats`, `getByTerritory`, `verify`

| Method | Status | Route | HTTP + Endpoint |
|---|---|---|---|
| `search` | **501** | transformerRoutes.js:73 | GET `/api/transformers/search` |
| `getByServiceArea` | **501** | transformerRoutes.js:51 | GET `/api/transformers/service-area/:serviceAreaId` |
| `getNearby` | **501** | transformerRoutes.js:62 | GET `/api/transformers/nearby` |
| `getTimeline` | **501** | transformerRoutes.js:95 | GET `/api/transformers/:id/timeline` |
| `getQRCode` | **501** | transformerRoutes.js:106 | GET `/api/transformers/:id/qr` |
| `decommission` | **501** | transformerRoutes.js:167 | POST `/api/transformers/:id/decommission` |
| `bulkCreate` | **501** | transformerRoutes.js:179 | POST `/api/transformers/bulk` |

#### `src/controllers/inspectionController.js`

Implemented: `create`, `getByTransformer`, `getById`, `getStats`

| Method | Status | Route | HTTP + Endpoint |
|---|---|---|---|
| `getAll` | **501** | inspectionRoutes.js:17 | GET `/api/inspections` |
| `update` | **501** | inspectionRoutes.js:99 | PUT `/api/inspections/:id` |
| `delete` | **501** | inspectionRoutes.js:113 | DELETE `/api/inspections/:id` |
| `getOverdue` | **501** | inspectionRoutes.js:62 | GET `/api/inspections/overdue` |
| `getLatest` | **501** | inspectionRoutes.js:51 | GET `/api/inspections/latest/:transformerId` |

#### `src/controllers/faultController.js`

Implemented: `create`, `getByTransformer`, `getOpen`, `assign`, `resolve`, `getStats`

| Method | Status | Route | HTTP + Endpoint |
|---|---|---|---|
| `getAll` | **501** | faultRoutes.js:19 | GET `/api/faults` |
| `getById` | **501** | faultRoutes.js:75 | GET `/api/faults/:id` |
| `getAssignedToMe` | **501** | faultRoutes.js:53 | GET `/api/faults/assigned-to-me` |
| `close` | **501** | faultRoutes.js:127 | PUT `/api/faults/:id/close` |
| `escalate` | **501** | faultRoutes.js:139 | PUT `/api/faults/:id/escalate` |
| `delete` | **501** | faultRoutes.js:151 | DELETE `/api/faults/:id` |

#### `src/controllers/maintenanceController.js` — DEAD CODE BUG

The `getStats` at line 206 (501 stub) is **unreachable**. A class field `getStats = asyncHandler(...)` is defined at line 138. In JavaScript, class fields take precedence over same-name prototype methods. The real `getStats` implementation works correctly. The 501 line is dead code and should be removed.

---

### B. Full-stub controllers (every method returns 501)

#### `src/controllers/territoryController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getAll` | GET `/api/territories` |
| `getById` | GET `/api/territories/:id` |
| `create` | POST `/api/territories` |
| `update` | PUT `/api/territories/:id` |
| `delete` | DELETE `/api/territories/:id` |

#### `src/controllers/serviceAreaController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getAll` | GET `/api/service-areas` |
| `getById` | GET `/api/service-areas/:id` |
| `getByTerritory` | GET `/api/service-areas/territory/:territoryId` |
| `create` | POST `/api/service-areas` |
| `update` | PUT `/api/service-areas/:id` |
| `delete` | DELETE `/api/service-areas/:id` |

#### `src/controllers/feederController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getAll` | GET `/api/feeders` |
| `getById` | GET `/api/feeders/:id` |
| `getByServiceArea` | GET `/api/feeders/service-area/:serviceAreaId` |
| `create` | POST `/api/feeders` |
| `update` | PUT `/api/feeders/:id` |
| `delete` | DELETE `/api/feeders/:id` |

#### `src/controllers/districtController.js` — Read-only (no routes for CUD)

| Method | HTTP + Endpoint |
|---|---|
| `getAll` | GET `/api/districts` |
| `getById` | GET `/api/districts/:id` |
| `getByRegion` | GET `/api/districts/region/:region` |

#### `src/controllers/ratingController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getAll` | GET `/api/ratings` |
| `getByNetworkVoltage` | GET `/api/ratings/network/:networkVoltage` |
| `create` | POST `/api/ratings` |
| `update` | PUT `/api/ratings/:id` |
| `delete` | DELETE `/api/ratings/:id` |

#### `src/controllers/userController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getAllUsers` | GET `/api/users` |
| `getUserById` | GET `/api/users/:id` |
| `createUser` | POST `/api/users` |
| `updateUser` | PUT `/api/users/:id` |
| `deleteUser` | DELETE `/api/users/:id` |
| `activateUser` | POST `/api/users/:id/activate` |
| `deactivateUser` | POST `/api/users/:id/deactivate` |
| `changeUserRole` | POST `/api/users/:id/role` |
| `getUsersInMyTerritory` | GET `/api/users/me/territory` |

#### `src/controllers/adminController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getSystemStats` | GET `/api/admin/system-stats` |
| `getAllUsers` | GET `/api/admin/users` |
| `getAuditLogs` | GET `/api/admin/audit-logs` |
| `triggerBackup` | POST `/api/admin/backup` |
| `restoreFromBackup` | POST `/api/admin/restore/:backupId` |
| `getBackupHistory` | GET `/api/admin/backups` |
| `toggleMaintenanceMode` | POST `/api/admin/maintenance` |

#### `src/controllers/analyticsController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getTransformerAnalytics` | GET `/api/analytics/transformers` |
| `getFaultAnalytics` | GET `/api/analytics/faults` |
| `getMaintenanceAnalytics` | GET `/api/analytics/maintenance` |
| `getPredictiveAnalytics` | GET `/api/analytics/predictive` |

#### `src/controllers/exportController.js`

| Method | HTTP + Endpoint |
|---|---|
| `exportToExcel` | POST `/api/exports/excel` |
| `exportToPDF` | POST `/api/exports/pdf` |
| `exportToCSV` | POST `/api/exports/csv` |
| `downloadExport` | GET `/api/exports/:exportId` |

#### `src/controllers/auditController.js`

| Method | HTTP + Endpoint |
|---|---|
| `getAuditLogs` | GET `/api/audit` |
| `getUserAuditLogs` | GET `/api/audit/user/:userId` |
| `getTransformerAuditLogs` | GET `/api/audit/transformers/:transformerId` |
| `getAuditActions` | GET `/api/audit/actions` |

#### `src/controllers/qrController.js`

| Method | HTTP + Endpoint |
|---|---|
| `generateTransformerQR` | GET `/api/qr/transformer/:transformerId` |
| `generateBulkQR` | GET `/api/qr/bulk` |
| `downloadQR` | GET `/api/qr/download/:transformerId` |
| `processQRScan` | POST `/api/qr/scan` |

#### `src/controllers/geoController.js`

| Method | HTTP + Endpoint |
|---|---|
| `findNearbyTransformers` | POST `/api/geo/transformers/nearby` |
| `getClusterData` | GET `/api/geo/cluster` |
| `geocode` | POST `/api/geo/geocode` |
| `reverseGeocode` | POST `/api/geo/reverse-geocode` |
| `getRoute` | POST `/api/geo/route` |

### C. Stubbed service

#### `src/services/reportService.js` — 16 methods, all stubs

`generateTransformerReport`, `generateInspectionReport`, `generateFaultReport`, `generateMaintenanceReport`, `generateAssetRegister`, `generateCustomReport`, `exportToExcel`, `exportToPDF`, `getExportStatus`, `downloadExport`, `scheduleReport`, `getScheduledReports`, `cancelSchedule`, `saveTemplate`, `getReportTemplates`, `deleteTemplate`

---

## 3. Routes Affected (Summary Count)

| Module | Route prefix | Stubbed endpoints |
|---|---|---|
| Transformers | `/api/transformers` | 7 |
| Inspections | `/api/inspections` | 5 |
| Faults | `/api/faults` | 6 |
| Territories | `/api/territories` | 5 |
| Service Areas | `/api/service-areas` | 6 |
| Feeders | `/api/feeders` | 6 |
| Districts | `/api/districts` | 3 |
| Ratings | `/api/ratings` | 5 |
| Users | `/api/users` | 9 |
| Admin | `/api/admin` | 7 |
| Analytics | `/api/analytics` | 4 |
| Exports | `/api/exports` | 4 |
| Audit | `/api/audit` | 4 |
| QR | `/api/qr` | 4 |
| Geo | `/api/geo` | 5 |
| **Total** | | **80 endpoints** |

---

## 4. Swagger Coverage

**File:** `swagger.yaml` (168 lines)

Swagger coverage is ~5%. Only 3 endpoint operations are documented:
- `POST /auth/login`
- `GET /transformers`
- `POST /transformers` (note: yaml has duplicate `/transformers` key — invalid YAML; likely only one is served)

**All other ~60+ routes have zero Swagger documentation.**

Swagger is served via `swagger-ui-express` + `yamljs` in `src/app.js`. The YAML file needs a full rewrite to cover even the MVP endpoints. This is a separate task from controller implementation.

---

## 5. MVP Priority Ranking

### Priority logic used
- **Critical:** blocks the basic asset registry workflow (create/list/manage transformers with proper location refs, log inspections, report faults)
- **Important:** needed to make the product usable by a real team (user management, audit, QR field access)
- **Later:** reporting, exports, analytics, geospatial, admin operations

### Service availability — key decision factor

| Module | Dedicated service? | BaseService usable? |
|---|---|---|
| Territory | No | Yes — model is simple CRUD |
| ServiceArea | No | Yes |
| Feeder | No | Yes |
| District | No | Yes |
| Rating | No | Yes |
| Transformer | `transformerService.js` (583 lines) | N/A — service has most needed methods |
| Inspection | `inspectionService.js` (315 lines) | N/A — service has all needed methods |
| Fault | `faultService.js` (465 lines) | N/A — service has most needed methods |
| Maintenance | `maintenanceService.js` (8327 bytes) | N/A |
| User | No userService.js | User model exists; authService handles auth |
| Audit | `auditService.js` (444 lines) | N/A |
| QR | `qrService.js` (383 lines) | N/A |
| Geo | `geoService.js` (353 lines) | N/A |
| Export | Stubbed only (reportService) | No |
| Analytics | None | Needs aggregation pipelines |

---

## 6. Prioritized Implementation Map

### CRITICAL

#### C1 — Location Reference Data (Territory + ServiceArea + Feeder + District + Rating)
**Difficulty:** LOW  
**Stubs:** 25 endpoints across 5 controllers  
**Why critical:** Transformers require `territory_id` and `district_id` in their schema. Without working reference data endpoints, you cannot create well-linked transformers or filter by location. These are prerequisite lookup tables for the asset registry.  
**Service approach:** `BaseService` provides getAll/getById/create/update/delete — just instantiate per model. Add one custom method per controller for the relationship query (e.g. `getByTerritory` on serviceArea, `getByServiceArea` on feeder).  
**Models ready:** Territory.js, ServiceArea.js, Feeder.js, District.js, TransformerRating.js — all fully defined.  
**Note:** District controller is read-only (no POST/PUT/DELETE routes) — likely pre-seeded data.

#### C2 — Transformer remaining stubs
**Difficulty:** MEDIUM  
**Stubs:** 7 endpoints  
**Why critical:** Core transformer management is 70% done but `search`, `getByServiceArea`, `getNearby`, `decommission`, and `bulkCreate` are key operational methods for field teams. `getTimeline` and `getQRCode` complete the per-asset view.  
**Service availability:**
- `search` → `TransformerService.searchTransformers()` already handles query filters
- `getByServiceArea` → `searchTransformers` with `service_area_id` filter (no new service method needed)
- `getNearby` → `TransformerService.getNearbyTransformers()` exists
- `decommission` → `TransformerService.decommissionTransformer()` exists
- `bulkCreate` → `TransformerService.bulkCreate()` exists
- `getTimeline` → `timelineService.js` exists
- `getQRCode` → `qrService.js` exists

#### C3 — Inspection remaining stubs
**Difficulty:** LOW  
**Stubs:** 5 endpoints  
**Why critical:** Field technicians log inspections continuously. Without `getAll`, `update`, `getOverdue`, and `getLatest`, inspection review and scheduling are broken.  
**Service availability:**
- `getAll` — add to `InspectionService` using model query (not currently in service)
- `update` → `InspectionService.updateInspection()` exists
- `delete` → `InspectionService.deleteInspection()` exists
- `getOverdue` → `InspectionService.getOverdueInspections()` exists
- `getLatest` → `InspectionService.getLatestInspection()` exists

#### C4 — Fault remaining stubs
**Difficulty:** LOW  
**Stubs:** 6 endpoints  
**Why critical:** Faults are the central operational concern. Without `getAll`, `getById`, `getAssignedToMe`, `close`, and `escalate`, the entire fault lifecycle is incomplete.  
**Service availability:**
- `getAll` — not in faultService; needs to be added (straightforward model query)
- `getById` — `FaultService.getById()` called internally but not public; expose it
- `getAssignedToMe` → `FaultService.getFaultsAssignedToUser(userId)` exists
- `close` → `FaultService.closeFault()` exists
- `escalate` → `FaultService.escalateFault()` exists
- `delete` → use `Fault.findByIdAndDelete()` directly (fault deletion is admin-only)

---

### IMPORTANT

#### I1 — UserController (User Management)
**Difficulty:** MEDIUM  
**Stubs:** 9 endpoints  
**Why important:** Territory Managers need to manage their team. Role changes, activation/deactivation, and territory-scoped user lists are needed to run a real deployment.  
**Service approach:** No `userService.js` exists. Options: (a) create a thin `userService.js` wrapping the User model + BaseService, or (b) implement directly using `User` model in the controller. Option (a) is preferred to match architecture.  
**Risk:** RBAC boundary — ensure `getUsersInMyTerritory` filters by `req.user.territory_id` to prevent cross-territory data exposure.

#### I2 — AuditController
**Difficulty:** LOW  
**Stubs:** 4 endpoints  
**Why important:** Compliance and accountability require audit trails. `auditService.js` is 444 lines and likely complete — just needs controller wiring.

#### I3 — QRController
**Difficulty:** MEDIUM  
**Stubs:** 4 endpoints  
**Why important:** Field technicians identify transformers by QR scan. `qrService.js` (383 lines) exists. Needs QR generation library (e.g. `qrcode` npm package) to produce image output.

#### I4 — Maintenance dead-code cleanup
**Difficulty:** LOW (3 lines)  
**What:** Delete the unreachable `async getStats(req, res) { return res.status(501)... }` prototype method at `maintenanceController.js:206-208`. The working `getStats = asyncHandler(...)` class field at line 138 already handles the route correctly.

---

### LATER

#### L1 — AdminController
**Difficulty:** HIGH  
**Why later:** Backup/restore requires MongoDB tooling and file storage. `toggleMaintenanceMode` needs global state. `getSystemStats` needs aggregation across all collections. None of this is blocking MVP operations.

#### L2 — AnalyticsController
**Difficulty:** HIGH  
**Why later:** Trend analysis and predictive analytics require multi-collection aggregation pipelines. Predictive analytics may require ML models. Not needed for basic asset tracking.

#### L3 — ExportController + reportService
**Difficulty:** HIGH  
**Why later:** Requires `xlsx`, `pdfkit` or equivalent libraries, async export job queue, and file storage (S3/local). The `ExportJob` model exists but the full pipeline needs building. Export is a reporting feature, not a registry feature.

#### L4 — GeoController
**Difficulty:** HIGH  
**Why later:** `geoService.js` exists but likely depends on external geocoding APIs (Google Maps, OpenStreetMap Nominatim). `findNearbyTransformers` uses MongoDB `$near` geospatial query — needs a `2dsphere` index on Transformer. `getRoute` needs a routing API. These are map-view features, not core registry.

#### L5 — reportService (16 methods)
**Difficulty:** HIGH  
**Why later:** Full report generation, scheduling, templates. Entirely post-MVP.

---

## 7. Recommended Next 3 Implementation Modules

### Module 1 (Implement first): Location Reference Data Bundle
**Files:** `territoryController.js`, `serviceAreaController.js`, `feederController.js`, `districtController.js`, `ratingController.js`  
**Pattern:** Each controller needs a service (or inline BaseService). BaseService provides getAll/getById/create/update/delete. One relationship-filtered query per controller.  
**Test:** Unit tests against model methods; integration tests via supertest hitting each CRUD endpoint.  
**Why first:** Transformer creation requires `territory_id` and `district_id`. Without these, the core MVP workflow is broken at the data entry level.

### Module 2 (Implement second): Inspection stubs completion
**Files:** `inspectionController.js`, `inspectionService.js` (add `getAll`)  
**Changes:** Wire 5 stubbed methods to already-implemented service methods. Add `getAll` to `InspectionService`.  
**Test:** Extend existing inspection tests with getAll, update, delete, overdue, latest cases.  
**Why second:** Inspection is the highest-frequency field operation. Completing it finishes the inspect-and-review loop.

### Module 3 (Implement third): Fault stubs completion
**Files:** `faultController.js`, `faultService.js` (add `getAll`, expose `getById`)  
**Changes:** Wire 6 stubbed methods. Add `getAllFaults(filters)` to FaultService. Make internal `getById` public.  
**Test:** Fault lifecycle test: report → assign → resolve → close. Add getAll, getById, getAssignedToMe, escalate, delete cases.  
**Why third:** Fault management is the other high-frequency field operation. After Module 2, both core field workflows are complete.

---

## 8. Commands Executed

```bash
grep -Rn "501" src/
grep -Rn "notImpl" src/
grep -Rn "router\." src/routes/
npm test
```

Plus secondary inspection:
```bash
ls src/models/ src/services/
cat src/services/baseService.js
grep -n methods src/services/faultService.js src/services/inspectionService.js src/services/transformerService.js
```

---

## 9. Test Result

```
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        4.017 s
```

Warnings present (non-blocking):
- Mongoose duplicate index on `Notification.expires_at` and `Transformer.asset_id` / `serial_number`

---

## 10. Risks

| Risk | Severity | Detail |
|---|---|---|
| **maintenanceController.js dead code** | Low | 501 stub at line 206 is unreachable (shadowed by class field). Should be removed to avoid confusion. |
| **swagger.yaml duplicate key** | Low | Both GET and POST `/transformers` defined under the same YAML key. YAMLJS likely only parses one. Swagger docs will show missing operations. |
| **No userService.js** | Medium | UserController has 9 stubs and no service backing them. Need to create `userService.js` before wiring the controller. |
| **Territory model missing `created_by`/`is_deleted`** | Low | BaseService.create() sets `created_by` and BaseService.delete() sets `is_deleted` — these fields don't exist in Territory/ServiceArea/Feeder/District models. Either add fields or bypass BaseService for delete (use `findByIdAndDelete`). |
| **District routes are read-only** | Note | No POST/PUT/DELETE routes for districts — district data is intended to be pre-seeded (matches the region enum: Central/Eastern/Northern/Western). Controller getAll/getById/getByRegion are enough. |
| **geoService external API dependency** | High | Geocoding and routing likely require external API keys not in `.env.example`. Confirm before implementing GeoController. |
| **Swagger coverage** | Medium | 95% of API endpoints have zero Swagger documentation. This should be addressed in parallel with or just after MVP implementation. |
| **Inspection getAll missing from service** | Low | `InspectionService` has no `getAll` method. The controller's `getAll` stub needs this added to the service before implementation. |
| **FaultService.getById is private** | Low | `getById` is called internally but not publicly exported. Needs to be made public for `FaultController.getById`. |

---

## Markdown Report Path

`docs/superpowers/reports/2026-06-23-stub-priority-audit.md`
