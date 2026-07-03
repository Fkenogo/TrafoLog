# Backend Stabilization & Frontend Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 backend bugs (decommission validation, AuditLog validation failure, SMTP dev noise), document remaining stubs, and produce a frontend API readiness map.

**Architecture:** Each fix is surgical — one file per root cause. No service rewrites. Tests added for each behavior change. All existing 85 tests must remain green.

**Tech Stack:** Node.js/Express, Mongoose 9, Joi, Nodemailer, Jest/Supertest

## Global Constraints

- Do not start frontend work
- Do not rewrite services or expand Swagger
- Maintain current controller/service/route architecture
- All 85 existing tests must remain green after each task
- No new npm dependencies

---

### Task 1: Wire decommission body validation

**Files:**
- Modify: `src/routes/transformerRoutes.js` (import + middleware addition)
- Modify: `src/tests/transformer.test.js` (2 new tests)

**Root cause:** `decommissionTransformerSchema` is defined and exported from `src/validators/transformerValidator.js` but is not imported in the routes file and not applied to `POST /:id/decommission`.

**Interfaces:**
- Uses: `decommissionTransformerSchema` from `../validators/transformerValidator`
- Uses: `validate` from `../middleware/validation` (already imported)
- `validate(schema)` returns a middleware that calls `errorResponse(res, 400, 'Validation failed', errors)` on failure

- [ ] **Step 1: Add the schema to the import in transformerRoutes.js**

Change line 6-10 of `src/routes/transformerRoutes.js` from:
```js
const {
  createTransformerSchema,
  updateTransformerSchema,
  searchTransformerSchema
} = require('../validators/transformerValidator');
```
To:
```js
const {
  createTransformerSchema,
  updateTransformerSchema,
  searchTransformerSchema,
  decommissionTransformerSchema
} = require('../validators/transformerValidator');
```

- [ ] **Step 2: Add validate middleware to the decommission route**

Change the decommission route block (lines ~163-172) from:
```js
router.post(
  '/:id/decommission',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  TransformerController.decommission
);
```
To:
```js
router.post(
  '/:id/decommission',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  validate(decommissionTransformerSchema),
  TransformerController.decommission
);
```

- [ ] **Step 3: Write two new failing tests in transformer.test.js**

Add inside `describe('POST /api/transformers/:id/decommission', ...)` block, BEFORE the decommission success test:

```js
it('returns 400 when reason is missing', async () => {
  const res = await request(app.getApp())
    .post(`/api/transformers/${decommissionTransformerId}/decommission`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({});

  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toBe('Validation failed');
});

it('returns 400 when reason is not in the allowed enum', async () => {
  const res = await request(app.getApp())
    .post(`/api/transformers/${decommissionTransformerId}/decommission`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({ reason: 'NotAValidReason' });

  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});
```

- [ ] **Step 4: Run transformer tests and verify new tests pass**

```bash
npx jest --testPathPatterns=src/tests/transformer --forceExit
```
Expected: 27 passed (25 + 2 new)

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: 87 passed, 0 failed

---

### Task 2: Fix AuditLog `action_category` validation failure

**Files:**
- Modify: `src/services/authService.js` — `logAction` method (add `action_category` field)
- Modify: `src/tests/auth.test.js` — add 1 test verifying login doesn't produce AuditLog validation errors

**Root cause:** `authService.logAction` creates `new AuditLog({user_id, action, ...})` without `action_category`. The `AuditLog` schema has `action_category: { required: true }`. Every auth operation silently fails to write audit logs and logs a Mongoose `ValidationError`. `auditService.getActionCategory(action)` has the correct mapping but `authService` never calls it.

All actions logged by `authService` are auth-domain: LOGIN, LOGOUT, LOGOUT_ALL, USER_REGISTERED, REFRESH_TOKEN, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, EMAIL_VERIFIED, PASSWORD_CHANGED, SESSION_REVOKED. All map to `'AUTH'`.

- [ ] **Step 1: Fix authService.logAction to include action_category**

In `src/services/authService.js`, find the `logAction` method (~line 550) and change:

```js
async logAction(data) {
  try {
    const auditLog = new AuditLog({
      user_id: data.user_id,
      action: data.action,
      target_user_id: data.target_user_id,
      details: data.details,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      metadata: data.metadata
    });
    await auditLog.save();
  } catch (error) {
    logger.error('Error logging action:', error);
    // Don't throw, just log
  }
}
```

To:

```js
async logAction(data) {
  try {
    const auditLog = new AuditLog({
      user_id: data.user_id,
      action: data.action,
      action_category: data.action_category || 'AUTH',
      target_user_id: data.target_user_id,
      details: data.details,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      metadata: data.metadata
    });
    await auditLog.save();
  } catch (error) {
    logger.warn('AuditLog write failed (non-fatal):', error.message);
  }
}
```

Note: Also changed `logger.error` → `logger.warn` because audit log failures are non-fatal operational noise, not system errors.

- [ ] **Step 2: Add an auth test that confirms AuditLog is written (no validation error)**

In `src/tests/auth.test.js`, find the test file structure and add one test that verifies audit log is created without error after login. Add at the end of the login describe block:

```js
it('login writes an AuditLog entry with AUTH category', async () => {
  const AuditLog = require('../models/AuditLog');
  // Count before
  const before = await AuditLog.countDocuments({ action: 'LOGIN' });

  await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

  const after = await AuditLog.countDocuments({ action: 'LOGIN' });
  expect(after).toBeGreaterThan(before);

  const entry = await AuditLog.findOne({ action: 'LOGIN' }).sort({ created_at: -1 });
  expect(entry.action_category).toBe('AUTH');
});
```

- [ ] **Step 3: Run auth tests and verify new test passes**

```bash
npx jest --testPathPatterns=src/tests/auth --forceExit
```
Expected: All auth tests pass including the new AuditLog test

- [ ] **Step 4: Run full suite**

```bash
npm test
```
Expected: 88 passed, 0 failed

---

### Task 3: Fix dev SMTP noise

**Files:**
- Modify: `src/utils/email.js` — early exit when SMTP_HOST not configured
- Modify: `src/services/authService.js` — wrap `requestPasswordReset` email send non-fatally

**Root cause:** `email.js` tries to connect to SMTP even when `SMTP_HOST` is empty/unset, producing connection errors that get logged at `error` level. `requestPasswordReset` doesn't wrap the email call non-fatally, so SMTP failures make password reset return 500 in dev.

- [ ] **Step 1: Add SMTP configuration guard to email.js**

Change `src/utils/email.js` from:
```js
const sendEmail = async ({ to, subject, html, text = null }) => {
  try {
    const transporter = initializeTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@kVAssetTracker.com',
      to,
      subject,
      ...(html && { html }),
      ...(text && { text })
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email sending failed: ${error.message}`);
    throw error;
  }
};
```

To:
```js
const sendEmail = async ({ to, subject, html, text = null }) => {
  if (!process.env.SMTP_HOST) {
    logger.warn(`Email skipped (SMTP_HOST not configured): to="${to}", subject="${subject}"`);
    return null;
  }

  try {
    const transporter = initializeTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@kVAssetTracker.com',
      to,
      subject,
      ...(html && { html }),
      ...(text && { text })
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email sending failed: ${error.message}`);
    throw error;
  }
};
```

- [ ] **Step 2: Wrap requestPasswordReset email send non-fatally**

In `src/services/authService.js`, find `requestPasswordReset` and change the email send from:
```js
// Send reset email
await this.sendPasswordResetEmail(user, resetToken);
```
To:
```js
// Send reset email — non-fatal; SMTP may not be configured in dev/test
try {
  await this.sendPasswordResetEmail(user, resetToken);
} catch (emailError) {
  logger.warn('Password reset email could not be sent:', emailError.message);
}
```

- [ ] **Step 3: Run full suite — confirm still green**

```bash
npm test
```
Expected: 88 passed, 0 failed

No new tests needed for this task since the fix is a guard condition and the auth tests already exercise the register/login paths.

---

### Task 4: Document remaining stubs

**Files:**
- Create: `docs/API_FRONTEND_READINESS_MAP.md`

No code changes. Document the stub inventory and frontend-ready endpoints.

**Stub inventory (from grep):**
- `userController`: 9 stubs — getAllUsers, getUserById, createUser, updateUser, deleteUser, activateUser, deactivateUser, changeUserRole, getUsersInMyTerritory
- `auditController`: 4 stubs — getAuditLogs, getUserAuditLogs, getTransformerAuditLogs, getAuditActions
- `qrController`: 4 stubs — generateTransformerQR, generateBulkQR, downloadQR, processQRScan
- `adminController`: 7 stubs — getSystemStats, getAllUsers, getAuditLogs, triggerBackup, restoreFromBackup, getBackupHistory, toggleMaintenanceMode
- `analyticsController`: 4 stubs — getTransformerAnalytics, getFaultAnalytics, getMaintenanceAnalytics, getPredictiveAnalytics
- `exportController`: 4 stubs — exportToCSV, exportToExcel, exportToPDF, downloadExport
- `geoController`: 5 stubs — findNearbyTransformers, getClusterData, geocode, reverseGeocode, getRoute

Total: 37 stubs. None block frontend MVP (auth, transformers, inspections, faults are all implemented).

- [ ] **Step 1: Create API_FRONTEND_READINESS_MAP.md** — see full content in execution step (it's documentation)

- [ ] **Step 2: Verify grep confirms stub count**

```bash
grep -R "501" src --include="*.js" | grep -v node_modules | grep -v test | wc -l
grep -R "notImpl" src --include="*.js" | grep -v node_modules | wc -l
```

---

### Task 5: Write stabilization report + update changelog

**Files:**
- Create: `docs/superpowers/reports/2026-07-01-backend-stabilization-frontend-readiness.md`
- Modify: `docs/CHANGELOG_LOCAL_SETUP.md`

- [ ] **Step 1: Run full test suite one final time**
```bash
npm test
```
Expected: 88 passed (or however many after all task tests)

- [ ] **Step 2: Write report and update changelog**
