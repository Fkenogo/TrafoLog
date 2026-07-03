# Fault Endpoints — Implementation Report

**Date:** 2026-06-23  
**Session:** 6 — Implementation  
**Approach:** TDD (tests written first, watched fail, then implemented)  
**Test result:** 57/57 passing (16 new + 41 existing)

---

## 1. Files Modified

| File | Change |
|---|---|
| `src/controllers/faultController.js` | Implemented 6 stubbed methods: `getAll`, `getById`, `getAssignedToMe`, `close`, `escalate`, `delete` |
| `src/services/faultService.js` | Made 4 notification calls non-fatal (wrapped in try/catch) |
| `src/tests/fault.test.js` | CREATED — 16 new tests covering all fault endpoints |

---

## 2. Code Diff Summary

### faultController.js — 6 methods implemented

Consistent with existing class + async + try/catch/next pattern.

**`getAll`** — Builds filters from `req.query`. Maps `status` query param to `fault_status` model field (field name differs). Supports `transformer_id`, `status`, `severity`, `fault_type`, `assigned_to`, `startDate`/`endDate` date range. Delegates to `FaultService.getAll()` (inherited BaseService).

**`getById`** — Delegates to `FaultService.getById(id, populate)` (inherited BaseService). Throws ApiError(404) if not found. Populates `transformer_id`, `reported_by`, `assigned_to`, `resolved_by`.

**`getAssignedToMe`** — Delegates to `FaultService.getFaultsAssignedToUser(req.user.id)`. Service returns faults with `fault_status in ['Open', 'Assigned', 'In Progress']` assigned to the user.

**`close`** — Delegates to `FaultService.closeFault(id, userId)`. Service validates fault must be `'Resolved'` first — throws ApiError(400) if not. Sets `fault_status: 'Closed'`.

**`escalate`** — Delegates to `FaultService.escalateFault(id, req.body.reason, userId)`. Sets `fault_status: 'In Progress'`. Route has no `validate` middleware, so `reason` is optional.

**`delete`** — Delegates to `FaultService.hardDelete(id)`. Fault model has **NO `is_deleted`** field — hard delete is correct. Route is `Super Admin` only. Returns ApiError(404) if not found.

### faultService.js — notification calls made non-fatal

Four notification calls were wrapped with non-fatal try/catch:
- `reportFault` → `sendFaultAlert` (for Critical/Complete Outage)
- `assignFault` → `sendAssignmentNotification`
- `resolveFault` → `sendResolutionNotification`
- `escalateFault` → `sendEscalationNotification`

**Why:** SMTP is not configured in the test/dev environment. `sendEmail()` throws when SMTP is unavailable. Notification failures are not business-critical — the fault operation (report, assign, resolve, escalate) succeeds regardless. This matches the pattern from:
- Session 2: `authService.register` was fixed to make SMTP failure non-fatal
- Existing `createTimelineEntry` in faultService/inspectionService which already swallows errors

Without this fix, `assign` always fails (email is always sent), and `reportFault` with Critical/Complete Outage severity fails.

---

## 3. Key Design Decisions

### Hard delete (Fault model has no `is_deleted`)

The `Fault` schema does not have `is_deleted`, `deleted_at`, or `deleted_by` fields. Hard delete via `FaultService.hardDelete(id)` (inherited `BaseService.hardDelete`) is the correct approach. Route is `Super Admin` only, limiting risk.

### `status` query param maps to `fault_status` model field

The `faultQuerySchema` uses `status` as the query param name, but the Fault model uses `fault_status`. The controller maps `if (status) filters.fault_status = status`.

### `close` requires `Resolved` status first

`FaultService.closeFault` validates `fault.fault_status !== 'Resolved'` → throws ApiError(400). This is the correct fault lifecycle: Open → Assigned → In Progress → Resolved → Closed.

### Missing schema fields (Mongoose strict mode drops them)

`escalateFault` sets `escalation_reason`, `escalated_at`, `escalated_by` but these are NOT in the Fault schema. Mongoose strict mode silently drops them. Only `fault_status: 'In Progress'` is persisted.

`closeFault` sets `reviewed_by`, `reviewed_at` which are also NOT in the schema — only `fault_status: 'Closed'` is persisted. This is a pre-existing design gap in the Fault schema.

### Pre-existing bug (not fixed, documented)

`faultController.getStats` calls `FaultService.getFaultStats(req.query)` but the service method is named `getFaultStatistics`. `GET /api/faults/stats` therefore returns 500. This is not in scope for this session.

---

## 4. TDD Steps Executed

```bash
# TDD RED phase
npx jest --testPathPatterns=src/tests/fault --forceExit
# Result: 11 failed (501 responses), 5 passed (setup + existing endpoints) — correct RED

# After faultService.js notification fix (non-fatal) only:
# Still RED for the new endpoints

# TDD GREEN phase (after controller implementation)
npx jest --testPathPatterns=src/tests/fault --forceExit
# Result: 16 passed

# Full suite
npm test
# Result: 57 passed (4 suites)
```

---

## 5. Dependencies Added

None.

---

## 6. Config Changes

None.

---

## 7. Tests Added

**File:** `src/tests/fault.test.js` — 16 tests

Test setup:
- Creates `admin.fault@example.com` (Super Admin)
- Creates test Transformer with `gps.coordinates` (2dsphere index) and `location_administrative.site_name` (required by notification email templates to avoid TypeError)
- Creates 3 test faults via API: `faultId` (Minor), `faultToCloseId` (Major), `faultToDeleteId` (Critical — tests non-fatal notification path)
- Cleans up all test data in `afterAll`

Test lifecycle state:
1. `faultId`: Open → Assigned → In Progress (escalated) → [close-400 test target]
2. `faultToCloseId`: Open → Resolved → Closed
3. `faultToDeleteId`: Open → hard-deleted

| Suite | Tests |
|---|---|
| POST /api/faults | setup: 3 faults created (1) |
| GET /api/faults | paginated list, transformer_id filter, status filter, 401 guard (4) |
| GET /api/faults/open | existing endpoint works (1) |
| GET /api/faults/:id | by id, 404 (2) |
| PUT /api/faults/:id/assign | assigns fault (existing endpoint) (1) |
| GET /api/faults/assigned-to-me | returns assigned faults (1) |
| PUT /api/faults/:id/escalate | sets In Progress (1) |
| PUT /api/faults/:id/resolve | resolves fault (existing endpoint) (1) |
| PUT /api/faults/:id/close | 400 non-resolved, 200 resolved (2) |
| DELETE /api/faults/:id | hard-deletes, 404 (2) |

---

## 8. Test Results

```
Test Suites: 4 passed, 4 total
Tests:       57 passed, 57 total  (16 new + 41 existing)
Time:        5.7s
```

All pre-existing tests continue to pass.

---

## 9. Manual Endpoint Verification

```
curl -s http://localhost:3000/health
→ {"status":"healthy","services":{"database":"connected","redis":"connected",...}}

curl -s http://localhost:3000/api
→ {"success":true,"message":"kVAssetTracker API v2.0",...}
```

Full endpoint verification via API requires a running fresh server process. All endpoints are verified via Jest/Supertest.

---

## 10. Risks

| Risk | Severity | Detail |
|---|---|---|
| **Hard delete on Fault** | Medium | `Fault` model uses hard delete (no `is_deleted`). Deleted faults are permanently gone. Acceptable for Super Admin only, but reconsider if audit trail is needed before production. |
| **Missing Fault schema fields** | Low | `escalation_reason`, `escalated_at`, `escalated_by`, `reviewed_by`, `reviewed_at` are set by service methods but not in the Fault schema. Mongoose strict mode silently drops them. Escalation/close metadata is lost. Schema needs updating before production. |
| **`GET /api/faults/stats` returns 500** | Low | Pre-existing bug: controller calls `FaultService.getFaultStats` but service has `getFaultStatistics`. Fix is trivial (rename the call) but not in scope. |
| **Notification service: `assignedTo` type mismatch** | Low | `assignFault` passes user ID string as `assignedTo` to `sendAssignmentNotification`, which treats it as a User object. Notification details (email, name) are undefined. Non-fatal wrapper prevents this from breaking the assign. Should fix by looking up the User object before passing to notification service. |
| **`sendEmail` in test environment** | Low | SMTP not configured locally. All email sending fails silently (non-fatal wrapper). Tests pass but emails are never sent during development. |

---

## 11. Rollback Instructions

```bash
# Restore controller stubs
git checkout HEAD -- src/controllers/faultController.js

# Restore service (notification calls were non-fatal)
git checkout HEAD -- src/services/faultService.js

# Remove new test file
rm src/tests/fault.test.js
```

---

## 12. Endpoints Now Operational

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/faults` | any authenticated |
| GET | `/api/faults/:id` | any authenticated |
| GET | `/api/faults/assigned-to-me` | any authenticated |
| PUT | `/api/faults/:id/close` | Super Admin / Territory Manager |
| PUT | `/api/faults/:id/escalate` | Super Admin / Territory Manager / Engineer |
| DELETE | `/api/faults/:id` | Super Admin |

Previously operational (not changed in this session):

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/faults` | SA / TM / Engineer / Field Tech |
| GET | `/api/faults/open` | any authenticated |
| GET | `/api/faults/transformer/:id` | any authenticated |
| PUT | `/api/faults/:id/assign` | SA / TM / Engineer |
| PUT | `/api/faults/:id/resolve` | SA / TM / Engineer / Field Tech |
