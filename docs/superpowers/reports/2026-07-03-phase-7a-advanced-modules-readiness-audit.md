# Phase 7A Advanced Modules Readiness Audit

**Date:** 2026-07-04  
**Requested report path:** `docs/superpowers/reports/2026-07-03-phase-7a-advanced-modules-readiness-audit.md`  
**Scope:** Readiness audit only for Analytics, Maps/Geo, QR workflows, Exports, Reports, Notifications, Audit, and Admin-related advanced tools.

## Executive Summary

Core MVP workflows are complete, but most advanced modules are not ready for direct frontend implementation. The safest Phase 7 entry point is Notifications because the backend has a real model, controller, and service for core list/read/delete operations. QR display is also partially ready through transformer detail endpoints, but standalone QR scan/bulk/download routes are stubbed. Maps can begin with `GET /api/transformers/nearby` and transformer GPS data, but `/api/geo/*` is fully stubbed.

Reports and exports should wait for backend wiring. A real `reportingService.js` exists, but `reportController.js` imports stubbed `reportService.js`, so `/api/reports/*` will currently fail at runtime. `/api/exports/*`, `/api/analytics/*`, `/api/admin/*`, `/api/audit/*`, and `/api/users/*` are not frontend-ready.

## Files Inspected

Documentation:

- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `swagger.yaml`
- `docs/superpowers/reports/2026-07-03-phase-6a-reference-data-management.md`
- `docs/superpowers/reports/2026-07-03-sprint-5g-incident-fault-management.md`

Frontend:

- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/settings/SettingsPage.tsx`
- `frontend/src/pages/dashboard/DashboardPage.tsx`
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- `frontend/src/api/*`
- `frontend/src/types/api.ts`

Backend:

- `src/routes/*`
- `src/controllers/*`
- `src/services/*`
- `src/models/*`
- `src/validators/reportValidator.js`
- `src/validators/exportValidator.js`
- `package.json`
- `.env.example`

## Mandatory Stub Scans

Commands run:

```bash
grep -R "501" -n src
grep -R "notImpl" -n src
grep -R "TODO" -n src/routes src/controllers src/services
```

Findings:

- `501` and `notImpl` are present in advanced controller stubs:
  - `src/controllers/analyticsController.js`
  - `src/controllers/geoController.js`
  - `src/controllers/qrController.js`
  - `src/controllers/exportController.js`
  - `src/controllers/adminController.js`
  - `src/controllers/auditController.js`
  - `src/controllers/userController.js`
- `notImpl` is present in `src/services/reportService.js`.
- No `TODO` matches were found in `src/routes`, `src/controllers`, or `src/services`.

## Advanced Module Readiness Table

| Module | Routes Available | Controller Status | Service Status | Model Readiness | Frontend Status | Consume Now? | Notes |
|---|---|---|---|---|---|---|---|
| Notifications | Partial: `GET /api/notifications`, `GET /api/notifications/unread/count`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`, `DELETE /api/notifications/:id`, push-token routes | Real methods for listed routes; extra controller methods not mounted | Core list/count/read/delete implemented; preferences/stats/test methods referenced by controller are not implemented in service | `Notification` model is robust | Static bell icon only; no API wrapper/page | Yes, for list/count/read/delete only | Best next sprint candidate |
| QR Display | `GET /api/transformers/:id/qr` | Real through `TransformerController.getQRCode` | `qrService.generateQR` real | `QrCode` model ready | Transformer detail QR tab already consumes it | Yes, display-only | Already partially implemented |
| QR Scan/Bulk/Download | `/api/qr/transformer/:id`, `/api/qr/scan`, `/api/qr/bulk`, `/api/qr/download/:id` | Stubbed `qrController` returns 501 | `qrService` has real methods, but not wired to controller | `QrCode` model ready | No pages/wrappers | No | Backend wiring and tests first |
| Maps / Geo | `/api/geo/*` routes exist | Stubbed `geoController` returns 501 | `geoService` has useful methods but not wired | Transformer GPS fields/indexes exist; transformer nearby route tested | No maps page/wrapper | Partial: use transformer GPS/nearby, not `/api/geo` | Map UI can start with `GET /api/transformers/nearby` |
| Reports | `/api/reports/*` routes exist | Real controller methods | Controller imports stubbed `reportService.js`; real `reportingService.js` exists separately | `ExportJob` model exists | No pages/wrappers | No | Backend service import/wiring blocker |
| Exports | `/api/exports/excel`, `/api/exports/pdf`, `/api/exports/csv`, `/api/exports/:id` | Stubbed `exportController` returns 501 | Reporting service can generate buffers, but export controller is not wired | `ExportJob` model exists | No pages/wrappers | No | Backend first |
| Analytics | `/api/analytics/transformers`, `/faults`, `/maintenance`, `/predictive` | Stubbed controller returns 501 | No analytics service found | No dedicated analytics model | No pages/wrappers | No | Backend first |
| Admin Tools | `/api/admin/*` routes exist | Stubbed controller returns 501 | No admin service found | User, AuditLog, ExportJob models exist | Settings placeholder says admin not exposed | No | Backend first |
| Audit | `/api/audit/*` routes exist | Stubbed controller returns 501 | `auditService.js` exists, but controller is stubbed | `AuditLog` model exists and auth writes audit logs | No pages/wrappers | No | Backend controller wiring first |
| User Management | `/api/users/*` routes exist | Stubbed controller returns 501 | Auth/user model exists, no ready user controller | `User` model ready | No pages/wrappers | No | Not part of Phase 7A implementation recommendation |

## Module Detail

### Notifications

Available mounted routes:

- `GET /api/notifications`
- `GET /api/notifications/unread/count`
- `PUT /api/notifications/:id/read`
- `PUT /api/notifications/read-all`
- `DELETE /api/notifications/:id`
- `POST /api/notifications/push-token`
- `DELETE /api/notifications/push-token`

Readiness:

- The model supports user notifications, type, priority, read status, delivery state, expiry, linked records, and indexes.
- The controller has many methods, but the route file mounts only the basic notification routes and push-token routes.
- The service actually implements core list/count/read/all-read/delete.
- The service does not implement the controller-referenced push preference, test, stats, delivery, resend, and clear-all methods.
- `DELETE /api/notifications/push-token` is declared after `DELETE /api/notifications/:id`, so Express will likely route it to delete-notification with `id = "push-token"` rather than unregistering a token.

Frontend readiness:

- Topbar has a static notification icon/dot.
- No notification API wrapper exists.
- No notifications panel/page exists.

Recommendation:

- Implement a notification drawer/panel using only the core mounted and implemented routes.
- Defer push tokens, preferences, stats, delivery status, resend, and clear-all until backend service/route coverage is corrected.

### QR

Ready subset:

- `GET /api/transformers/:id/qr` is mounted, tested, and already used by transformer detail.

Blocked subset:

- `/api/qr/*` routes use a stubbed controller and return 501.
- `qrService` has real methods for generate, scan, bulk, download, stats, deactivate, and validate, but those methods are not wired to the standalone controller.
- `APP_URL` affects QR embedded URLs. `.env.example` and `.env` both define it.

Frontend readiness:

- Transformer detail already has a QR tab and `transformerApi.qr`.
- No QR scan workflow exists.
- No QR bulk/download workflow exists.

Recommendation:

- Next QR sprint should enhance display/download from transformer detail only if it uses the ready transformer endpoint.
- QR scanning/bulk generation requires backend controller wiring and tests first.

### Maps / Geo

Ready subset:

- `GET /api/transformers/nearby?lat=&lng=&radius=&limit=` is ready and tested.
- Transformer records include GPS fields.

Blocked subset:

- `/api/geo/transformers/nearby`, `/api/geo/route`, `/api/geo/cluster`, `/api/geo/geocode`, and `/api/geo/reverse-geocode` are mounted to stubbed `geoController`.
- `geoService` contains real methods, but geocode/reverse-geocode return mock data and the controller is not wired.
- `MAPBOX_TOKEN` exists in `.env.example` and `.env`, but the current backend service does not use it.

Frontend readiness:

- No maps page exists.
- No map API wrapper exists.
- No map rendering dependency exists in frontend.

Recommendation:

- Implement an asset location map using existing transformer list/GPS and `GET /api/transformers/nearby`.
- Do not call `/api/geo/*` until controller wiring and tests exist.

### Reports

Routes:

- `GET /api/reports/transformers`
- `GET /api/reports/inspections`
- `GET /api/reports/faults`
- `GET /api/reports/maintenance`
- `GET /api/reports/asset-register`
- `POST /api/reports/export/excel`
- `POST /api/reports/export/pdf`
- `GET /api/reports/exports/:exportId`

Readiness:

- `reportController.js` is not a stub, but it imports `../services/reportService`.
- `reportService.js` is entirely `notImpl`.
- `reportingService.js` contains substantial real report/export logic but is not wired to `reportController.js`.
- Validator mismatch exists: controller reads query keys like `startDate`, `endDate`, `service_area_id`, `network_voltage_kv`, `status`, but `reportQuerySchema` accepts only `from`, `to`, `territory_id`, and `format`. The validation middleware may reject or strip expected fields depending on middleware behavior.
- Swagger does not document the reports routes.

Frontend readiness:

- No report page exists.
- No report API wrapper exists.

Recommendation:

- Backend wiring sprint first: import `reportingService`, reconcile validators, add endpoint tests, then build frontend reports.

### Exports

Routes:

- `POST /api/exports/excel`
- `POST /api/exports/pdf`
- `POST /api/exports/csv`
- `GET /api/exports/:exportId`

Readiness:

- `exportController.js` is fully stubbed and returns 501.
- `ExportJob` model exists.
- Backend dependencies exist for Excel/PDF/CSV-style work: `xlsx`, `exceljs`, `pdfkit`, `fast-csv`, `archiver`.
- `.env.example` includes MinIO report bucket config, but current export route code is not wired to storage.

Frontend readiness:

- No export page/wrapper exists.

Recommendation:

- Wait until reports/export backend is wired and tested.

### Analytics

Routes:

- `GET /api/analytics/transformers`
- `GET /api/analytics/faults`
- `GET /api/analytics/maintenance`
- `GET /api/analytics/predictive`

Readiness:

- Controller is fully stubbed and returns 501.
- No analytics service was found.
- Dashboard already provides basic operational widgets using real endpoints, but those are not analytics APIs.

Frontend readiness:

- No analytics page/wrapper exists.

Recommendation:

- Implement after reports/exports, unless analytics is scoped to frontend-only visualizations over existing transformer/fault/inspection endpoints.

### Admin And Audit

Admin:

- `/api/admin/*` routes are mounted but controller is fully stubbed.
- No admin service was found.
- Settings page explicitly states admin workflows are not exposed.

Audit:

- `/api/audit/*` routes are mounted but controller is fully stubbed.
- `AuditLog` model exists.
- `auditService.js` exists.
- Auth tests confirm login creates an audit entry.

Recommendation:

- Audit log viewing could be a backend-wiring sprint after notifications.
- Admin tools should remain hidden until real endpoints and stronger permission tests exist.

## Swagger Coverage

`swagger.yaml` is MVP-focused. It documents transformer QR through `/transformers/{id}/qr`, but searches for analytics, geo, reports, exports, notifications, admin, and audit do not show advanced route documentation. Swagger should be updated after backend route readiness is corrected, not before frontend implementation.

## Frontend Readiness

Existing advanced UI:

- Static notification bell in topbar.
- Settings placeholder notes advanced workflows are intentionally not exposed.
- Transformer detail QR tab exists and uses `GET /api/transformers/:id/qr`.

Missing frontend pieces:

- No notifications API wrapper.
- No notifications drawer or page.
- No maps page.
- No reports page.
- No export API wrapper.
- No analytics page.
- No admin/audit pages.

Safe frontend modules now:

- Notifications panel for list/count/read/delete only.
- QR display polish on transformer detail.
- Map page using transformer GPS and `GET /api/transformers/nearby`, avoiding `/api/geo`.

Should wait:

- QR scan/bulk/download
- Reports
- Exports
- Analytics
- Admin
- Audit
- User management

## Backend Blockers

- Stubbed controllers: analytics, geo, QR, export, admin, audit, users.
- Stubbed `reportService.js` blocks real `reportController.js`.
- Real `reportingService.js` is disconnected from report routes.
- Report validators do not match controller filter names.
- Notification route exposes push-token routes, but service lacks token methods and route order likely breaks `DELETE /push-token`.
- Notification controller contains unmounted methods and references missing service methods.
- Standalone QR controller is not wired to real `qrService`.
- Geo controller is not wired to real `geoService`.
- Geo geocode/reverse-geocode service methods return mock data.
- Swagger is incomplete for all advanced modules except transformer QR.
- Missing tests for advanced modules beyond transformer nearby/QR.
- Existing Mongoose warnings remain for duplicate indexes and reserved `errors` path.

## Security And Permission Risks

- Admin and audit routes are Super Admin-only in route definitions, but controllers are stubs.
- Reports/exports authorize Viewer as well as admin roles; this may be acceptable for read exports but needs field-level and territory-scope review before exposing.
- Notification routes authenticate users, but no role checks are needed because they are user-owned records.
- Maps/GPS data exposes physical asset locations. A map page should respect existing auth and territory scoping before broad display.
- Exports can produce large sensitive datasets; backend should enforce role and territory filtering before frontend exposure.

## Environment And Dependency Notes

Environment variables relevant to advanced modules:

- `APP_URL`: used by QR payload generation.
- `CLIENT_URL`: used by notification email links and CORS/CSP.
- `SMTP_*`: used for email notifications.
- `TWILIO_*`: present in env examples for SMS; SMS utility should be verified before production use.
- `MINIO_*`: present for report/photo storage, but export routes are not wired.
- `MAPBOX_TOKEN`: present but not currently used by `geoService`.

Installed backend dependencies include:

- QR: `qrcode`
- Geo: `haversine`, `@turf/turf`, `geolib`
- Reports/exports: `xlsx`, `exceljs`, `pdfkit`, `pdfmake`, `fast-csv`, `archiver`
- Realtime: `socket.io`
- Notifications/email/SMS: `nodemailer`, `twilio`

## Recommended Phase 7 Implementation Order

1. **Phase 7B: Notifications Panel**
   - Highest readiness.
   - Use only mounted and implemented endpoints: list, unread count, mark one read, mark all read, delete.
   - Add a frontend API wrapper and topbar drawer/page.

2. **Phase 7C: QR Display And Print Support**
   - Build on existing transformer QR tab and `GET /api/transformers/:id/qr`.
   - Avoid `/api/qr/*` until backend is wired.
   - Add print/download-from-data-URL UI if needed without backend changes.

3. **Phase 7D: Asset Location Map**
   - Use transformer list/GPS and `GET /api/transformers/nearby`.
   - Avoid `/api/geo/*`.
   - Decide whether to add a frontend map library or build a simple coordinate table/mini-map first.

4. **Phase 7E: Reports Backend Wiring**
   - Backend-first sprint.
   - Wire `reportController` to `reportingService`.
   - Reconcile validators.
   - Add tests.

5. **Phase 7F: Reports UI**
   - Only after report endpoints return real data.
   - Build report filters and JSON preview first.

6. **Phase 7G: Exports**
   - Backend-first, then UI.
   - Decide storage/download strategy.

7. **Phase 7H: Analytics**
   - Backend-first if using `/api/analytics/*`.
   - Can alternatively begin with frontend-only charts from existing stats endpoints.

8. **Later: Admin/Audit/User Management**
   - Requires backend controller implementation and stricter tests before exposure.

## Next Sprint Recommendation

Recommended next sprint: **Phase 7B — Notifications Panel**.

### Draft Implementation Prompt

```text
# Phase 7B — Notifications Panel

Continue kVAssetTracker frontend implementation.

Objective:
Implement a user-owned Notifications panel using only ready notification endpoints.

Use only:
- GET /api/notifications
- GET /api/notifications/unread/count
- PUT /api/notifications/:id/read
- PUT /api/notifications/read-all
- DELETE /api/notifications/:id

Do not implement:
- Push token registration
- Notification preferences
- Delivery status
- Resend notification
- Clear all
- Admin notifications
- Backend changes unless a tiny blocker is found

Frontend requirements:
- Add notificationApi.ts wrappers.
- Wire the existing topbar bell to live unread count.
- Add a dropdown or drawer panel with:
  - notification list
  - unread filter
  - type/priority badges
  - mark read
  - mark all read
  - delete
  - loading/error/empty states
  - friendly API errors
- Use TanStack Query and existing common components.
- Invalidate notification queries after mutations.
- Do not expose raw backend errors.

Verification:
- cd frontend && npm run build
- cd .. && npm test
- git status --short

Documentation:
- Create docs/superpowers/reports/2026-07-03-phase-7b-notifications-panel.md
- Update docs/CHANGELOG_LOCAL_SETUP.md

Stop after Phase 7B.
```

## Rollback

This phase is documentation-only. To roll back Phase 7A:

```bash
git checkout -- docs/CHANGELOG_LOCAL_SETUP.md
rm docs/superpowers/reports/2026-07-03-phase-7a-advanced-modules-readiness-audit.md
```

