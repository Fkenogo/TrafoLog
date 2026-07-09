# API Frontend Readiness Map

> Updated: 2026-07-06 (Phase 9D) | Tests: 175/175 | Backend: kVAssetTracker

This document maps every backend route to its current implementation status and frontend integration guidance.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Ready | Fully implemented, tested, validated |
| ⚠️ Stub | Returns `501 Not Implemented` — do not call from frontend yet |
| 🔒 Auth Required | All routes require `Authorization: Bearer <token>` unless noted |

---

## Auth (`/api/auth`)

> No auth header required for login/register/refresh

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| POST | `/api/auth/register` | ✅ Ready | `{ data: { user, message } }` |
| POST | `/api/auth/login` | ✅ Ready | `{ data: { user, accessToken, sessionToken } }` + `Set-Cookie: refreshToken` |
| POST | `/api/auth/logout` | ✅ Ready | `{ message: 'Logged out successfully' }` |
| POST | `/api/auth/logout-all` | ✅ Ready | `{ message }` |
| POST | `/api/auth/refresh` | ✅ Ready | `{ data: { accessToken } }` — browser clients send HTTP-only `refreshToken` cookie; non-browser clients may send `refreshToken` in body |
| GET | `/api/auth/me` | ✅ Ready | `{ data: { ...user } }` |
| POST | `/api/auth/verify-email` | ✅ Ready | `{ message }` |
| POST | `/api/auth/resend-verification` | ✅ Ready | `{ message }` |
| POST | `/api/auth/forgot-password` | ✅ Ready | `{ success: true, message }` — always 200 (don't reveal if email exists) |
| POST | `/api/auth/reset-password` | ✅ Ready | `{ message }` — body requires `token`, `password`, `confirmPassword` |
| POST | `/api/auth/change-password` | ✅ Ready | `{ message }` — body requires `currentPassword`, `newPassword`, `confirmPassword` |
| PUT | `/api/auth/me` | ✅ Ready | `{ data: { ...user } }` — allowed fields: `name`, `preferences`, `push_tokens` |
| GET | `/api/auth/sessions` | ✅ Ready | `{ data: [...] }` — list active sessions |
| DELETE | `/api/auth/sessions/:sessionToken` | ✅ Ready | `{ message }` — revoke a session |

**Notes:**
- `refreshToken` is set as an HTTP-only cookie on login; `/refresh` accepts that cookie for browser clients and also accepts a JSON body token for non-browser clients
- Refresh responses intentionally return only `accessToken` in JSON; refresh tokens remain in HTTP-only cookies
- Email sending is non-fatal — registration/forgot-password succeeds even if SMTP is not configured

---

## User Management (`/api/users`)

> Phase 8C implements safe backend User Management APIs for Super Admin users only. No frontend User Management UI, Admin Dashboard, backup, restore, or maintenance mode was added.

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/users` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` |
| POST | `/api/users` | ✅ Ready | `{ data: { ...user } }` — 201 |
| GET | `/api/users/:id` | ✅ Ready | `{ data: { ...user } }` |
| PUT | `/api/users/:id` | ✅ Ready | `{ data: { ...user } }` — safe profile/admin-managed fields only |
| POST | `/api/users/:id/role` | ✅ Ready | `{ data: { ...user } }` |
| POST | `/api/users/:id/activate` | ✅ Ready | `{ data: { ...user, is_active: true } }` |
| POST | `/api/users/:id/deactivate` | ✅ Ready | `{ data: { ...user, is_active: false } }` |

**Access:** Super Admin only.

**List filters:**

| Filter | Notes |
|--------|-------|
| `page`, `limit` | Pagination |
| `search` | Case-insensitive match against name/email |
| `role` | Super Admin, Territory Manager, Engineer, Field Technician, Viewer |
| `territory_id`, `service_area_id` | Location scoping filters |
| `is_active` | Boolean active/deactivated filter |

**Security notes:**

- Responses remove password hashes, refresh tokens, reset tokens, verification tokens, push tokens, and two-factor secrets.
- Create uses the `User` model save path so password hashing middleware runs.
- `PUT /api/users/:id` does not update password, role, or activation status.
- Role changes are handled only through `POST /api/users/:id/role`.
- Self-demotion, self-deactivation, and last-active-Super-Admin lockout are blocked.
- User create/update/role/activate/deactivate actions write `USER_MANAGEMENT` audit logs without password/token values.

**Not ready in Phase 8C:** `DELETE /api/users/:id` and `GET /api/users/me/territory` remain outside the tested frontend-ready contract.

---

## Transformers (`/api/transformers`)

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/transformers` | ✅ Ready | `{ data: [...], pagination: { page, limit, total, pages } }` |
| GET | `/api/transformers/search` | ✅ Ready | Same pagination shape; accepts filter query params |
| GET | `/api/transformers/stats` | ✅ Ready | `{ data: { total, by_status, by_territory, ... } }` |
| GET | `/api/transformers/nearby` | ✅ Ready | Requires `?lat=&lng=`; optional `radius` (km, default 5), `limit` |
| GET | `/api/transformers/service-area/:serviceAreaId` | ✅ Ready | `{ data: { transformers: [...], stats: {...} } }` |
| POST | `/api/transformers` | ✅ Ready | `{ data: { transformer } }` — 201 |
| POST | `/api/transformers/bulk` | ✅ Ready | `{ data: { success: [...], failed: [...] } }` — 207 |
| GET | `/api/transformers/:id` | ✅ Ready | `{ data: { ...transformer } }` |
| PUT | `/api/transformers/:id` | ✅ Ready | `{ data: { ...transformer } }` |
| DELETE | `/api/transformers/:id` | ✅ Ready | `{ message }` — soft delete |
| GET | `/api/transformers/:id/timeline` | ✅ Ready | `{ data: [...], pagination: {...} }` |
| GET | `/api/transformers/:id/qr` | ✅ Ready | `{ data: { qr_code, transformer_id, ... } }` — idempotent |
| POST | `/api/transformers/:id/decommission` | ✅ Ready | `{ data: { ...transformer, operational_status: 'Decommissioned' } }` |
| POST | `/api/transformers/:id/verify` | ✅ Ready | `{ data: { ...transformer } }` |
| GET | `/api/transformers/territory/:territoryId` | ✅ Ready | `{ data: { transformers: [...], stats: {...} } }` |

**Decommission body (validated):**
```json
{
  "reason": "End of Life" // required; enum: End of Life | Damaged | Theft | Vandalism | Replaced | Other
}
```

**Bulk create body:**
```json
[{ ...transformerShape }, ...]
// OR
{ "transformers": [{ ...transformerShape }, ...] }
```

---

## Inspections (`/api/inspections`)

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/inspections` | ✅ Ready | `{ data: [...], pagination: {...} }` |
| POST | `/api/inspections` | ✅ Ready | `{ data: { ...inspection } }` — 201 |
| GET | `/api/inspections/overdue` | ✅ Ready | `{ data: [...] }` — array of Transformer objects needing inspection |
| GET | `/api/inspections/:id` | ✅ Ready | `{ data: { ...inspection } }` |
| PUT | `/api/inspections/:id` | ✅ Ready | `{ data: { ...inspection } }` |
| DELETE | `/api/inspections/:id` | ✅ Ready | `{ message }` — soft delete |
| GET | `/api/inspections/transformer/:transformerId` | ✅ Ready | `{ data: [...] }` |
| GET | `/api/inspections/transformer/:transformerId/latest` | ✅ Ready | `{ data: { ...inspection } }` or 404 |

**Note:** `GET /inspections/overdue` returns **Transformer documents**, not inspection records.

---

## Faults (`/api/faults`)

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/faults` | ✅ Ready | `{ data: [...], pagination: {...} }` |
| POST | `/api/faults` | ✅ Ready | `{ data: { ...fault } }` — 201 |
| GET | `/api/faults/stats` | ✅ Ready | `{ data: { total, by_type, by_status, ... } }` |
| GET | `/api/faults/open` | ✅ Ready | `{ data: [...] }` — active/open faults |
| GET | `/api/faults/assigned-to-me` | ✅ Ready | `{ data: [...] }` — faults assigned to current user |
| GET | `/api/faults/transformer/:transformerId` | ✅ Ready | `{ data: [...] }` — faults for a specific transformer |
| GET | `/api/faults/:id` | ✅ Ready | `{ data: { ...fault } }` |
| DELETE | `/api/faults/:id` | ✅ Ready | `{ message }` — hard delete (Super Admin only) |
| PUT | `/api/faults/:id/assign` | ✅ Ready | `{ data: { ...fault } }` — body: `{ assigned_to: userId }` |
| PUT | `/api/faults/:id/resolve` | ✅ Ready | `{ data: { ...fault } }` — body: `{ resolution_description, downtime_hours }` |
| PUT | `/api/faults/:id/close` | ✅ Ready | `{ data: { ...fault } }` — fault must be `Resolved` first |
| PUT | `/api/faults/:id/escalate` | ✅ Ready | `{ data: { ...fault } }` |

**Note:** The fault lifecycle is: `Reported → Acknowledged → In Progress → Resolved → Closed`

---

## Maintenance (`/api/maintenance`)

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/maintenance` | ✅ Ready | `{ data: [...], pagination: {...} }` |
| POST | `/api/maintenance` | ✅ Ready | `{ data: { ...record } }` — 201 |
| GET | `/api/maintenance/stats` | ✅ Ready | `{ data: { ... } }` |
| GET | `/api/maintenance/upcoming` | ✅ Ready | `{ data: [...] }` — upcoming scheduled maintenance |
| GET | `/api/maintenance/transformer/:transformerId` | ✅ Ready | `{ data: [...] }` |
| GET | `/api/maintenance/:id` | ✅ Ready | `{ data: { ...record } }` |
| PUT | `/api/maintenance/:id` | ✅ Ready | `{ data: { ...record } }` |
| DELETE | `/api/maintenance/:id` | ✅ Ready | `{ message }` — Super Admin only |

---

## Reference Data

### Territory (`/api/territories`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/territories` | ✅ Ready |
| POST | `/api/territories` | ✅ Ready |
| GET | `/api/territories/:id` | ✅ Ready |
| PUT | `/api/territories/:id` | ✅ Ready |
| DELETE | `/api/territories/:id` | ✅ Ready — hard delete |

### Service Area (`/api/service-areas`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/service-areas` | ✅ Ready |
| POST | `/api/service-areas` | ✅ Ready |
| GET | `/api/service-areas/:id` | ✅ Ready |
| PUT | `/api/service-areas/:id` | ✅ Ready |
| DELETE | `/api/service-areas/:id` | ✅ Ready — hard delete |
| GET | `/api/service-areas/territory/:territoryId` | ✅ Ready |

### Feeder (`/api/feeders`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/feeders` | ✅ Ready |
| POST | `/api/feeders` | ✅ Ready |
| GET | `/api/feeders/:id` | ✅ Ready |
| PUT | `/api/feeders/:id` | ✅ Ready |
| DELETE | `/api/feeders/:id` | ✅ Ready — hard delete |
| GET | `/api/feeders/service-area/:serviceAreaId` | ✅ Ready |

### District (`/api/districts`)

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/districts` | ✅ Ready |
| GET | `/api/districts/:id` | ✅ Ready |
| GET | `/api/districts/region/:region` | ✅ Ready |

### Transformer Rating (`/api/ratings`)

> Note: `GET /api/ratings/:id` does NOT exist — there is no getById route for ratings. Use `GET /api/ratings` and filter client-side, or use `GET /api/ratings/network/:networkVoltage`.

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/ratings` | ✅ Ready |
| POST | `/api/ratings` | ✅ Ready |
| GET | `/api/ratings/network/:networkVoltage` | ✅ Ready — filter by `11` or `33` kV |
| PUT | `/api/ratings/:id` | ✅ Ready |
| DELETE | `/api/ratings/:id` | ✅ Ready — hard delete |
| GET | `/api/ratings/voltage/:kv` | ✅ Ready |

---

## Reports (`/api/reports`)

> Phase 7E wired report routes to `reportingService.js` through `reportService.js`. The JSON report endpoints below are authenticated, validated, tested, and frontend-ready. Report-route export helpers exist for backend compatibility, but frontend Reports UI should start with JSON endpoints only until export workflows are explicitly tested.

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/reports/transformers` | ✅ Ready | `{ data: { success, data, summary, filters, generated_at } }` |
| GET | `/api/reports/inspections` | ✅ Ready | `{ data: { success, data, summary, filters, generated_at } }` |
| GET | `/api/reports/faults` | ✅ Ready | `{ data: { success, data, summary, filters, generated_at } }` |
| GET | `/api/reports/maintenance` | ✅ Ready | `{ data: { success, data, summary, filters, generated_at } }` |
| GET | `/api/reports/asset-register` | ✅ Ready | `{ data: { success, data, summary, filters, generated_at } }` |

**Supported query filters:**

| Filter | Applies to |
|--------|------------|
| `startDate`, `endDate` | All five report endpoints |
| `territory_id`, `service_area_id`, `feeder_id`, `district_id` | All five report endpoints |
| `network_voltage_kv`, `kva_rating`, `operational_status` | Transformer and asset-register reports; also filters linked transformer records for inspection/fault/maintenance reports |
| `transformer_id`, `condition` | Inspection report |
| `fault_status`, `severity`, `fault_type` | Fault report |
| `maintenance_type` | Maintenance report |
| `format=json` | Recommended frontend format for all five ready endpoints |

---

## Exports (`/api/exports`)

> Phase 7G wires safe direct exports for CSV and JSON only. These routes are backend-ready and tested. They do not write files, do not expose download jobs, and intentionally exclude raw GPS coordinates from export payloads.

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| POST | `/api/exports/csv` | ✅ Ready | `text/csv` attachment response |
| POST | `/api/exports/json` | ✅ Ready | `{ data: { metadata, rows } }` |

**Request body:**

```json
{
  "report_type": "transformers",
  "filters": {
    "startDate": "2026-01-01",
    "endDate": "2026-12-31"
  }
}
```

**Supported `report_type` values:**

- `transformers`
- `inspections`
- `faults`
- `maintenance`
- `asset-register`

**Supported filters:** same validated filter set as JSON reports. Unsupported formats return `400 Validation failed`.

**Not ready:** Excel, PDF, stored export jobs, and download endpoints remain out of frontend scope.

---

## Analytics (`/api/analytics`)

> Phase 7H wires analytics endpoints to real operational data. Predictive analytics is intentionally a rule-based risk summary, not ML/AI prediction.

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/analytics/transformers` | ✅ Ready | `{ data: { summary, breakdowns, trends, risks, filters, generated_at } }` |
| GET | `/api/analytics/faults` | ✅ Ready | `{ data: { summary, breakdowns, trends, risks, filters, generated_at } }` |
| GET | `/api/analytics/maintenance` | ✅ Ready | `{ data: { summary, breakdowns, trends, risks, filters, generated_at } }` |
| GET | `/api/analytics/predictive` | ✅ Ready | `{ data: { summary, breakdowns, trends, risks, filters, generated_at } }` |

**Supported query filters:**

| Filter | Applies to |
|--------|------------|
| `territory_id`, `service_area_id`, `feeder_id`, `district_id` | All four analytics endpoints through transformer scope |
| `network_voltage_kv`, `kva_rating` | All four analytics endpoints through transformer scope |
| `startDate`, `endDate` | Transformer `created_at`, fault date, maintenance date, and transformer scope for risk analytics |

**Risk model:** `/api/analytics/predictive` uses explainable rules for open critical faults, overdue inspection flags, poor/critical inspection condition, repeated faults, and missing GPS. It does not claim ML prediction.

---

## Audit Logs (`/api/audit`)

> Phase 8B wires the read-only Audit Log API for Super Admin users. Audit writes, deletion, retention workflows, export UI, User Management, and Admin Dashboard remain out of scope.

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/audit` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` |
| GET | `/api/audit/user/:userId` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` |
| GET | `/api/audit/transformers/:transformerId` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` |
| GET | `/api/audit/actions` | ✅ Ready | `{ data: { categories: [...], actions: [...] } }` |

**Access:** Super Admin only.

**Supported query filters:**

| Filter | Applies to |
|--------|------------|
| `page`, `limit` | Audit list, user audit list, transformer audit list |
| `action`, `action_category` | Audit list, user audit list, transformer audit list |
| `user_id` | General audit list |
| `target_type`, `target_id` | General audit list and user audit list |
| `startDate`, `endDate` | Audit list, user audit list, transformer audit list |
| `is_sensitive` | Audit list, user audit list, transformer audit list |

**Security notes:** Controller output is whitelisted. Password, token, refresh, reset-token, verification-token, and secret-like values in `old_values`, `new_values`, and `metadata` are redacted. Excessive request metadata such as raw IP address and user agent is not returned.

**Route note:** The tested transformer audit path is plural: `GET /api/audit/transformers/:transformerId`.

---

## Admin (`/api/admin`)

> Phase 8D implements safe read-only Admin backend endpoints for Super Admin users only. Phase 9B adds tested maintenance mode status/toggle support. Phase 9C adds tested backup creation and backup history metadata. Phase 9D adds the tested restore safety layer. Backup/restore frontend operations UI remains out of scope.

| Method | Path | Status | Response shape |
|--------|------|--------|----------------|
| GET | `/api/admin/system-stats` | ✅ Ready | `{ data: { users, transformers, faults, inspections, maintenance, audit, generated_at } }` |
| GET | `/api/admin/users` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` |
| GET | `/api/admin/audit-logs` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` |
| POST | `/api/admin/backup` | ✅ Ready | `{ data: { backup_id, filename, storage_key, status, checksum, compression, size_bytes, collections, manifest, ... } }` — requires maintenance mode |
| GET | `/api/admin/backups` | ✅ Ready | `{ success, data: [...], pagination: { page, limit, total, pages } }` — metadata only, no download URLs |
| POST | `/api/admin/restore/:backupId` | ✅ Ready | Dry run: `{ data: { dryRun: true, backup_id, verified, collections, plan, warnings } }`; restore: `{ data: { dryRun: false, backup_id, pre_restore_backup_id, restored_collections, restored_counts, completed_at } }` |
| GET | `/api/admin/maintenance` | ✅ Ready | `{ data: { enabled, message, reason, enabled_by, enabled_at, disabled_by, disabled_at, updated_at } }` |
| POST | `/api/admin/maintenance` | ✅ Ready | `{ data: { enabled, message, reason, enabled_by, enabled_at, disabled_by, disabled_at, updated_at } }` |

**Access:** Super Admin only.

**System stats fields:**

| Field | Meaning |
|-------|---------|
| `users.total`, `users.active`, `users.by_role` | User counts |
| `transformers.total`, `transformers.by_status` | Transformer counts |
| `faults.open` | Open/assigned/in-progress faults |
| `inspections.overdue` | Non-decommissioned transformers with overdue or missing inspections |
| `maintenance.upcoming` | Maintenance records with next maintenance date in the next 30 days |
| `audit.recent_activity_count` | Audit records created in the last 24 hours |
| `generated_at` | ISO timestamp |

**Admin users filters:** same as `GET /api/users`: `page`, `limit`, `search`, `role`, `territory_id`, `service_area_id`, `is_active`.

**Admin audit filters:** same as `GET /api/audit`: `page`, `limit`, `action`, `action_category`, `user_id`, `target_type`, `target_id`, `startDate`, `endDate`, `is_sensitive`.

**Security notes:** Admin users responses are sanitized using the tested User Management behavior. Admin audit responses are redacted using the tested Audit read behavior and do not expose raw sensitive metadata.

**Maintenance mode behavior:** `POST /api/admin/maintenance` accepts `{ enabled, message?, reason? }`. When enabled, unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) return `503 Service Unavailable` for normal users. `GET`, `HEAD`, `OPTIONS`, login/refresh/logout, health/version, and the Super Admin maintenance endpoint remain available. MongoDB is the source of truth; Redis is used only as a best-effort cache. Maintenance enable/disable actions write `SYSTEM` audit logs.

**Backup behavior:** `POST /api/admin/backup` requires maintenance mode and returns `409` with `Enable Maintenance Mode before creating a backup.` if maintenance is disabled. Backup artifacts include manifest metadata, collection inventory, document counts, SHA-256 checksum, gzip compression, storage metadata, app/schema version, and creator metadata. `GET /api/admin/backups` returns metadata only; no download URL is exposed. Backup actions write `SYSTEM_BACKUP_STARTED`, `SYSTEM_BACKUP_COMPLETED`, and `SYSTEM_BACKUP_FAILED` audit logs.

**Restore behavior:** `POST /api/admin/restore/:backupId` requires maintenance mode, exact typed confirmation (`RESTORE BACKUP <backupId>`), a completed backup job, final artifact checksum verification, gzip decompression, manifest/payload validation, server-side collection allowlist, and no other running backup/restore operation. `dryRun: true` validates only and writes `SYSTEM_RESTORE_DRY_RUN`. `dryRun: false` creates a pre-restore backup before mutating data, restores only allowlisted requested collections, and writes `SYSTEM_RESTORE_STARTED`, `SYSTEM_RESTORE_COMPLETED`, or `SYSTEM_RESTORE_FAILED`. No raw file paths or download URLs are accepted from clients.

---

## Stubs — Return 501 (Do Not Call From Frontend)

### Users (`/api/users`) — 2 stubs

Most Super Admin User Management endpoints are ready. The two routes below are not part of the Phase 8C tested frontend contract.

| Endpoint | Stub |
|----------|------|
| DELETE `/api/users/:id` | ⚠️ Stub |
| GET `/api/users/me/territory` | ⚠️ Stub |

### QR (`/api/qr`) — 4 stubs

> Note: `GET /api/transformers/:id/qr` (on the transformer route) **is** implemented. The `/api/qr/*` routes below are separate and still stubbed.

| Endpoint | Stub |
|----------|------|
| POST `/api/qr/transformer/:id` | ⚠️ Stub |
| POST `/api/qr/bulk` | ⚠️ Stub |
| GET `/api/qr/:id/download` | ⚠️ Stub |
| POST `/api/qr/scan` | ⚠️ Stub |

### Export Workflows Not Ready (`/api/exports`)

| Endpoint | Stub |
|----------|------|
| POST `/api/exports/excel` | ⚠️ Not ready |
| POST `/api/exports/pdf` | ⚠️ Not ready |
| GET `/api/exports/:exportId` | ⚠️ Not ready |

### Geo (`/api/geo`) — 5 stubs

| Endpoint | Stub |
|----------|------|
| GET `/api/geo/nearby` | ⚠️ Stub (use `GET /api/transformers/nearby` instead) |
| GET `/api/geo/cluster` | ⚠️ Stub |
| GET `/api/geo/geocode` | ⚠️ Stub |
| GET `/api/geo/reverse-geocode` | ⚠️ Stub |
| GET `/api/geo/route` | ⚠️ Stub |

---

## Common Response Shapes

### Success (paginated list)
```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 }
}
```

### Success (single object)
```json
{
  "success": true,
  "message": "...",
  "data": { ...object }
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "reason", "message": "Decommission reason is required" }]
}
```

### Auth Error (401)
```json
{
  "success": false,
  "message": "No token provided"
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Transformer not found"
}
```

### Stub (501)
```json
{
  "success": false,
  "message": "UserController.getAllUsers not yet implemented"
}
```

---

## Stub Count Summary

| Controller | Stubs |
|-----------|-------|
| userController | 2 |
| adminController | 0 |
| geoController | 5 |
| qrController | 4 |
| exportController | 3 |
| **Total** | **14** |

None of these stubs block the frontend MVP. Auth, Super Admin user management, Admin read-only endpoints, backup/restore safety endpoints, transformers, inspections, faults, maintenance, reference data, notifications, transformer QR display, asset map data, JSON reports, tested CSV/JSON exports, backend analytics, and audit log read APIs are implemented.
