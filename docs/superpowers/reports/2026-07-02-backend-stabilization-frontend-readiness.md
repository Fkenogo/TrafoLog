# Backend Stabilization & Frontend Readiness Report

**Date:** 2026-07-02
**Session:** 9
**Tests:** 88/88 (3 new + 85 existing)

---

## 1. Files Modified

| File | Type | Change |
|---|---|---|
| `src/routes/transformerRoutes.js` | Modified | Added `decommissionTransformerSchema` import + `validate()` middleware to decommission route |
| `src/services/authService.js` | Modified | Added `action_category: 'AUTH'` to `logAction`; changed `logger.error` → `logger.warn`; wrapped `requestPasswordReset` email send non-fatally |
| `src/utils/email.js` | Modified | Early-exit with `logger.warn` when `SMTP_HOST` is not configured |
| `src/tests/transformer.test.js` | Modified | Added 2 decommission validation tests |
| `src/tests/auth.test.js` | Modified | Added AuditLog audit trail verification test |
| `docs/API_FRONTEND_READINESS_MAP.md` | Created | Full API readiness map for frontend team |
| `docs/superpowers/plans/2026-07-02-backend-stabilization.md` | Created | Implementation plan |

---

## 2. Bug Fixes

### Fix 1: Decommission route was missing body validation

**Root cause:** `decommissionTransformerSchema` exists in `src/validators/transformerValidator.js` and is exported, but the import line in `transformerRoutes.js` didn't include it and no `validate()` middleware was applied to `POST /:id/decommission`. Sending a request without a `reason` field silently passed through to the service, which stored `undefined` as the decommission reason in the timeline metadata.

**Fix:**
- Added `decommissionTransformerSchema` to the import in `transformerRoutes.js`
- Added `validate(decommissionTransformerSchema)` before `TransformerController.decommission`

**Tests added:** 2 — missing reason → 400 with "Validation failed"; invalid enum value → 400

---

### Fix 2: AuditLog validation failed for all auth operations

**Root cause:** `AuditLog` model has `action_category: { required: true }` (enum: AUTH, USER_MANAGEMENT, …). `authService.logAction()` created `new AuditLog({…})` without `action_category`. Every call to `logAction` in authService (login, logout, register, password reset, etc.) silently failed with `ValidationError: AuditLog validation failed: action_category: Path 'action_category' is required`. The error was caught and logged — so auth operations didn't crash — but no audit records were ever written for any auth action.

`auditService.logAction()` handles this correctly (via `getActionCategory(action)` lookup), but `authService` has its own parallel `logAction` implementation that bypasses `auditService` entirely.

**Fix:** Added `action_category: data.action_category || 'AUTH'` to the `new AuditLog({…})` constructor in `authService.logAction`. All actions logged through `authService` are auth-domain actions (LOGIN, LOGOUT, USER_REGISTERED, etc.), so `'AUTH'` is the correct default.

Also changed `logger.error('Error logging action:', error)` → `logger.warn('AuditLog write failed (non-fatal):', error.message)` — audit log failures are non-fatal operational noise, not system errors; they should not appear at error severity.

**Tests added:** 1 — verifies that a login creates an AuditLog entry with `action_category === 'AUTH'`

---

### Fix 3: Dev SMTP noise — email failures flooded logs as hard errors

**Root cause:** `email.js` attempts a nodemailer connection on every email send, even when `SMTP_HOST` is empty (dev/test). The connection fails with a network error, which was logged at `logger.error` level before being re-thrown to callers.

Additionally, `authService.requestPasswordReset` did not wrap the `sendPasswordResetEmail` call in a try/catch. If SMTP failed (which it always does in dev), the error propagated to the outer catch, which re-threw it as `ApiError(500, 'Failed to request password reset')`, making the password reset endpoint always return 500 in dev.

**Fix:**
1. **`email.js`:** Added SMTP_HOST guard at the top of `sendEmail`. If `SMTP_HOST` is not set, log a single `logger.warn` and return `null`. No connection attempt, no error. In production (where SMTP_HOST is set), behavior is unchanged — real failures still log at `error` level and re-throw.
2. **`authService.requestPasswordReset`:** Wrapped `sendPasswordResetEmail` in a non-fatal try/catch (matching the pattern already used in `authService.register`).

---

## 3. Commands Executed

```bash
npm test   # 88/88 all passing
```

---

## 4. Remaining Stubs

37 stubs across 7 controllers (none block MVP):

| Controller | Count | Priority |
|---|---|---|
| userController | 9 | High — no userService.js exists yet |
| auditController | 4 | Medium — auditService.js exists |
| qrController | 4 | Medium — qrService.js exists |
| adminController | 7 | Low |
| analyticsController | 4 | Low |
| exportController | 4 | Low |
| geoController | 5 | Low |

---

## 5. Test Results

```
Test Suites: 5 passed, 5 total
Tests:       88 passed, 88 total  (3 new + 85 existing)
Time:        ~13s
```

---

## 6. Known Pre-existing Issues (Not Fixed This Session)

| Issue | Location | Impact |
|---|---|---|
| Fault schema missing escalation fields | `src/models/Fault.js` | `escalation_reason`, `reviewed_by`, etc. silently dropped by Mongoose strict mode |
| `getFaultStatistics` territory filter no-op | `src/services/faultService.js` | Stats always cover all faults regardless of territory filter |
| `findByIdAndUpdate` deprecation warning | Multiple services | Use `{ returnDocument: 'after' }` instead of `{ new: true }` |
| Duplicate schema index warnings | Multiple models | Cosmetic Mongoose startup warnings; no runtime impact |

---

## 7. Documentation

- `docs/API_FRONTEND_READINESS_MAP.md` — created this session; full endpoint listing, response shapes, stub inventory
