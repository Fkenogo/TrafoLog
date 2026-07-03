# API Frontend Readiness Map

> Updated: 2026-07-02 (Session 10) | Tests: 88/88 | Backend: kVAssetTracker

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

## Stubs — Return 501 (Do Not Call From Frontend)

### Users (`/api/users`) — 9 stubs

All user management endpoints are stubbed. Frontend cannot manage users via API yet.

| Endpoint | Stub |
|----------|------|
| GET `/api/users` | ⚠️ Stub |
| POST `/api/users` | ⚠️ Stub |
| GET `/api/users/:id` | ⚠️ Stub |
| PUT `/api/users/:id` | ⚠️ Stub |
| DELETE `/api/users/:id` | ⚠️ Stub |
| PUT `/api/users/:id/activate` | ⚠️ Stub |
| PUT `/api/users/:id/deactivate` | ⚠️ Stub |
| PUT `/api/users/:id/role` | ⚠️ Stub |
| GET `/api/users/my-territory` | ⚠️ Stub |

### Audit Logs (`/api/audit`) — 4 stubs

| Endpoint | Stub |
|----------|------|
| GET `/api/audit` | ⚠️ Stub |
| GET `/api/audit/user/:userId` | ⚠️ Stub |
| GET `/api/audit/transformer/:transformerId` | ⚠️ Stub |
| GET `/api/audit/actions` | ⚠️ Stub |

### QR (`/api/qr`) — 4 stubs

> Note: `GET /api/transformers/:id/qr` (on the transformer route) **is** implemented. The `/api/qr/*` routes below are separate and still stubbed.

| Endpoint | Stub |
|----------|------|
| POST `/api/qr/transformer/:id` | ⚠️ Stub |
| POST `/api/qr/bulk` | ⚠️ Stub |
| GET `/api/qr/:id/download` | ⚠️ Stub |
| POST `/api/qr/scan` | ⚠️ Stub |

### Admin (`/api/admin`) — 7 stubs

| Endpoint | Stub |
|----------|------|
| GET `/api/admin/stats` | ⚠️ Stub |
| GET `/api/admin/users` | ⚠️ Stub |
| GET `/api/admin/audit-logs` | ⚠️ Stub |
| POST `/api/admin/backup` | ⚠️ Stub |
| POST `/api/admin/restore` | ⚠️ Stub |
| GET `/api/admin/backups` | ⚠️ Stub |
| POST `/api/admin/maintenance-mode` | ⚠️ Stub |

### Analytics (`/api/analytics`) — 4 stubs

| Endpoint | Stub |
|----------|------|
| GET `/api/analytics/transformers` | ⚠️ Stub |
| GET `/api/analytics/faults` | ⚠️ Stub |
| GET `/api/analytics/maintenance` | ⚠️ Stub |
| GET `/api/analytics/predictive` | ⚠️ Stub |

### Export (`/api/export`) — 4 stubs

| Endpoint | Stub |
|----------|------|
| GET `/api/export/csv` | ⚠️ Stub |
| GET `/api/export/excel` | ⚠️ Stub |
| GET `/api/export/pdf` | ⚠️ Stub |
| GET `/api/export/:id/download` | ⚠️ Stub |

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
| userController | 9 |
| adminController | 7 |
| geoController | 5 |
| auditController | 4 |
| qrController | 4 |
| analyticsController | 4 |
| exportController | 4 |
| **Total** | **37** |

None of these stubs block the frontend MVP. Auth, transformers, inspections, faults, maintenance, and all reference data are fully implemented.
