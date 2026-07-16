# Local Setup Change Log

---

## 2026-07-15 — Railway-Safe Phase 9F Operational Demo Seeder

**Summary:** Audited the live Railway preview and confirmed that its dashboard was empty because references and users existed while operational collections were empty. Added a dedicated model-backed operational reconciler with an explicit database target, read-only dry-run, complete dependency preflight, exact canonical keys, duplicate detection, UTC-relative dates, owned-field reconciliation, and preservation of unrelated data.

### Dataset and scope

- 5 districts and 7 feeders required by the existing five Phase 9F service areas.
- 15 transformers with the approved 8 Active / 3 Faulty / 2 Under Maintenance / 1 Decommissioned / 1 Unverified mix.
- 20 performed inspections, 7 faults, and 8 maintenance records.
- No users, territories, service areas, QR codes, notifications, audit logs, sessions, refresh tokens, or persistent report records are created.

### Changed

| File | Change |
|---|---|
| `scripts/seedRailwayPhase9FOperationalData.js` | Added the narrow operational dataset, full preflight, dry-run, sequential idempotent reconciliation, safe output, and CLI exit contract |
| `src/tests/seedRailwayPhase9FOperationalData.test.js` | Added real-Mongoose and authenticated API coverage in a dedicated local test database |
| `src/controllers/inspectionController.js` | Populated linked transformer and nested operational reference data for inspection list/detail responses |
| `src/controllers/faultController.js` | Populated nested transformer territory, service-area, and feeder references for fault list/detail responses |
| `frontend/src/pages/maintenance/MaintenancePage.tsx` | Displayed the populated technician business identity with legacy-name fallback |
| `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md` | Added the operational dry-run/live approval sequence, scope, rerun, and rollback guidance |
| `docs/superpowers/specs/2026-07-15-railway-operational-demo-seed-design.md` | Recorded the approved audit and design |
| `docs/superpowers/plans/2026-07-15-railway-operational-demo-seed.md` | Recorded the test-first execution plan and exact owned fields |
| Quarantine evidence | The wrong concurrent agent removed the untracked rejected implementation and its untracked inspection report before either could be preserved; neither file is present or reconstructed |
| `docs/superpowers/reports/2026-07-15-railway-operational-demo-seed-audit-and-fix.md` | Recorded implementation and validation evidence |
| `docs/superpowers/changes/2026-07-15-railway-operational-demo-seed-changes.md` | Maintained the running task log |

### Safety behavior

- `MONGODB_URI` is required and has no localhost fallback.
- Dry-run uses `autoIndex:false` and `autoCreate:false` and performs no document, timestamp, collection, or index writes.
- All reference/user dependencies, parent mappings, canonical matches, and candidate model validation complete before normal writes begin.
- Existing users are read and validated but never saved. The inactive viewer remains inactive.
- Existing territories and service areas are reused without updates.
- No delete, drop, replacement, or broad update method exists in the production script.
- Partial normal-run failures exit non-zero; exact-key rerun is the recovery path.

### Validation

- Focused operational suite: 24/24 passed, including real authenticated dashboard/module/map/report endpoints.
- Reference suite: 9/9 passed.
- Demo-user suite: 9/9 passed.
- Transformer suite: 30/30 passed.
- Inspection suite: 14/14 passed.
- Fault suite: 20/20 passed with the established `SMTP_HOST=` test override.
- Analytics suite: 7/7 passed.
- Auth suite: 9/9 passed.
- Frontend TypeScript/Vite production build passed with the existing chunk-size warning.
- Railway dry-run later reported `WOULD_CREATE=62 WOULD_UPDATE=0 WOULD_SKIP=0 FAILED=0`. Under a separate live gate, the first run reported `CREATED=62 UPDATED=0 SKIPPED=0 FAILED=0`, the same-day rerun reported `CREATED=0 UPDATED=0 SKIPPED=62 FAILED=0`, all orphan checks were zero, and live dashboard/module/map/report GET validation passed. Authentication state and Railway configuration remained unchanged. No commit or push occurred.
- Final UI binding review confirmed Dashboard, Transformers, and Asset Map already consume seeded business values. Inspection and fault APIs now return the linked transformer/reference values required by their tables, and Maintenance renders populated `technician_id` names instead of ignoring them.

**Report:** `docs/superpowers/reports/2026-07-15-railway-operational-demo-seed-audit-and-fix.md`

---

## 2026-07-13 — Railway JWT Login Configuration and Failure Safety

**Summary:** Confirmed that Railway demo login reached `AuthService.login` but failed while issuing the access token because the TrafoLog service had no `JWT_SECRET`. Added centralized JWT configuration validation, production placeholder rejection, secret-safe stage diagnostics, and mutation-safe login ordering. Token issuance now happens before successful-login state changes, and only auth artifacts created by the current failed attempt are compensated if a later stage fails.

### Root cause and fix

The Railway target user existed, was active, and passed password comparison. `User.generateAuthToken()` then called `jsonwebtoken.sign()` without a signing key and threw `Error: secretOrPrivateKey must have a value`. Because the old service reset login attempts and saved `last_login` first, the HTTP 500 partially changed the user even though no session, refresh token, or login audit was created.

The App now validates JWT configuration during startup, User token methods share that resolver, and the login orchestration issues both tokens before persisting success state. Unexpected login failures record a sanitized stage and stack frames in server logs without passwords, tokens, secrets, cookies, or connection URLs.

### Changed

| File | Change |
|---|---|
| `src/config/auth.js` | Added required-secret resolution, refresh-secret fallback, and production placeholder rejection |
| `src/app.js` | Added fail-fast auth configuration validation during app construction |
| `src/models/User.js` | Reused the centralized secrets for access and refresh token signing |
| `src/services/authService.js` | Added staged diagnostics, token-first ordering, one-save success state, and attempt-scoped artifact compensation |
| `src/tests/authConfig.test.js` | Added resolver and real production-startup failure coverage |
| `src/tests/authLoginRegression.test.js` | Added the real-model missing-secret/no-partial-state regression |
| `.env.example` | Documented the mandatory, non-placeholder production JWT secret |
| `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md` | Corrected preview seed commands and documented JWT startup validation |

### Railway requirement

The TrafoLog backend requires a strong preview-only `JWT_SECRET`. `JWT_REFRESH_SECRET` is not newly required because the current architecture intentionally falls back to the required JWT secret.

### Validation

- New auth configuration suite: 5/5 passed.
- New login regression suite: 4/4 passed.
- Existing authentication suite: 9/9 passed.
- Existing CORS suite: 18/18 passed.
- Existing proxy/rate-limit suite: 9/9 passed.
- Full backend with external SMTP disabled for the test process: 17/17 suites and 238/238 tests passed.
- The unmodified local `.env` run timed out in registration-heavy fixtures because configured external SMTP was awaited; the audit suite changed from a deterministic 30-second timeout to 10/10 passing in 3.3 seconds when using the application's existing no-SMTP path. No email code, fixture, or timeout was changed.
- Frontend TypeScript/Vite production build passed with the existing chunk-size warning.

**Report:** `docs/superpowers/reports/2026-07-13-railway-auth-login-failure.md`

---

## 2026-07-13 — Railway Reverse-Proxy Trust and Rate-Limit Fix

**Summary:** Configured Express to trust exactly one proxy hop in production so Railway-forwarded client addresses are accepted by `express-rate-limit`. Development and tests retain the default untrusted-proxy behavior. Removed four auth-limiter validation suppressions now that proxy trust is configured correctly; rate limits, thresholds, credentials, cookies, and authentication behavior remain unchanged.

### Root cause and fix

Railway terminates HTTPS at its edge and forwards `X-Forwarded-For` to TrafoLog. Express still used its default `trust proxy = false`, so the global `/api` limiter rejected the forwarded header with `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` before the login controller ran. The App now applies production-only `trust proxy = 1` immediately after `express()` and before middleware registration. Numeric one-hop trust selects the nearest Railway-provided address rather than an attacker-controlled extra leftmost value; `trust proxy = true` is not used.

### Changed

| File | Change |
|---|---|
| `src/config/proxyTrust.js` | Added the production-one-hop/development-disabled Express trust rule |
| `src/app.js` | Applied proxy trust immediately after Express app creation |
| `src/middleware/authRateLimiter.js` | Removed `X-Forwarded-For` validation suppressions while preserving all limiter policies |
| `src/tests/proxyTrust.test.js` | Added production proxy, spoof resistance, local safety, CORS, login, IP, limiter, refresh, and health coverage |
| `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md` | Documented Railway proxy architecture, security implications, and post-deploy checks |
| `docs/superpowers/reports/2026-07-12-production-client-origin-cors.md` | Expanded the combined CORS/proxy implementation evidence and rollback report |

### Validation

- Syntax checks passed for App, both configuration helpers, and auth limiters.
- Focused CORS suite: 18/18 passed.
- Focused proxy suite: 9/9 passed.
- Authentication suite: 9/9 passed.
- Initial full run: 13/15 suites passed; transformer/admin setup hooks timed out after service connection. Both passed unchanged in isolation (30/30 and 36/36), confirming nondeterministic fixture contention.
- Clean full backend rerun: 15/15 suites and 229/229 tests passed.
- Frontend TypeScript/Vite production build passed with the existing chunk-size warning.
- No dependency, frontend, cookie, auth route, credential, or Railway service change was made.

**Report:** `docs/superpowers/reports/2026-07-12-production-client-origin-cors.md`

---

## 2026-07-12 — Production-Safe Client Origin CORS Configuration

**Summary:** Centralized backend `CLIENT_URL` resolution so Express CORS, Socket.IO CORS, and Helmet CSP share one normalized origin. Development retains the localhost default. Production now rejects missing, malformed, path-bearing, credential-bearing, or loopback values instead of silently authorizing localhost. Credentialed CORS and the single-origin security model are preserved.

### Changed

| File | Change |
|---|---|
| `src/config/clientOrigin.js` | Added the shared origin parser, normalizer, development fallback, and production safety validation |
| `src/app.js` | Reused one resolved origin for Express CORS, Helmet CSP, and WebSocket construction |
| `src/websocket/index.js` | Accepted the resolved application origin for credentialed Socket.IO CORS |
| `src/tests/clientOriginCors.test.js` | Added focused resolver, loopback, preflight, credentials, CSP, and shared-wiring coverage |
| `.env.example` | Documented development and production `CLIENT_URL` rules |
| `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md` | Added the exact Railway frontend origin and fail-fast deployment guidance |
| `docs/superpowers/reports/2026-07-12-production-client-origin-cors.md` | Added implementation, validation, risk, rollback, and deployment-gate evidence |

### Required Railway backend variable

```text
CLIENT_URL=https://imaginative-art-production-53f9.up.railway.app
```

The value was confirmed on the Railway TrafoLog backend service before the combined CORS/proxy delivery. The implementation intentionally fails production startup for a missing or loopback `CLIENT_URL`.

### Validation status

- Focused CORS suite: 18 tests passed.
- Syntax checks: passed for the resolver, App, and WebSocket modules.
- Frontend production build: passed with the existing Vite chunk-size warning.
- Exact full backend `npm test`: 15 suites and 229 tests passed after the requested isolation of two nondeterministic fixture setup timeouts.
- Railway backend `CLIENT_URL` confirmation and the clean-suite delivery gates are satisfied.

**Report:** `docs/superpowers/reports/2026-07-12-production-client-origin-cors.md`

---

## 2026-07-11 — Railway-Safe Phase 9F Reference Seeder

**Summary:** Added a narrow, idempotent Railway preview seeder for only the three Phase 9F territories (`P9FC`, `P9FE`, `P9FW`) and five service areas (`P9FSA1`–`P9FSA5`) required by the Railway demo-user seeder. It requires an explicit `MONGODB_URI`, reconciles by canonical code, preserves document identity and unrelated metadata, performs no deletes, and exits non-zero if any required reference fails.

### Changed

| File | Change |
|---|---|
| `scripts/seedRailwayPhase9FReferences.js` | Added model-backed, code-keyed reconciliation limited to eight canonical Phase 9F references |
| `src/tests/seedRailwayPhase9FReferences.test.js` | Added focused coverage for database targeting, exact records, relationships, idempotency, isolation, preservation, and dependency failure |
| `docs/superpowers/specs/2026-07-11-railway-phase9f-reference-seeder-design.md` | Recorded the approved safety design and schema investigation |
| `docs/superpowers/plans/2026-07-11-railway-phase9f-reference-seeder.md` | Recorded the TDD implementation and delivery plan |
| `docs/superpowers/reports/2026-07-11-railway-phase9f-reference-seeder.md` | Recorded implementation scope, verification evidence, risks, rollback, and later Railway procedure |

### Later Railway execution order

Run the reference seeder first and require `FAILED=0` before running the user seeder:

```bash
railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FReferences.js'

railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayDemoUsers.js'
```

Expected first execution against a database missing all eight references:

```text
CREATED P9FC
CREATED P9FE
CREATED P9FW
CREATED P9FSA1
CREATED P9FSA2
CREATED P9FSA3
CREATED P9FSA4
CREATED P9FSA5
Summary: CREATED=8 UPDATED=0 SKIPPED=0 FAILED=0
```

Existing canonical records may instead report `UPDATED` or `SKIPPED`. Stop if `FAILED` is non-zero.

> **Warning:** Do not run `node scripts/phase9fSeedData.js` against the Railway preview database. It is a broad validation seed that modifies operational and demo collections outside this narrow reference-data scope.

### Validation

- `node --check scripts/seedRailwayPhase9FReferences.js`: passed.
- Focused reference-seeder suite: 9 tests passed.
- Existing Railway demo-user suite: 9 tests passed.
- Full backend suite: 13 suites and 202 tests passed.
- Frontend production build: passed with the existing Vite chunk-size warning.
- Neither Railway seeder was executed during implementation.

**Report:** `docs/superpowers/reports/2026-07-11-railway-phase9f-reference-seeder.md`

---

## 2026-07-11 — QRCode Model Import Casing Fix

**Summary:** Fixed the `OverwriteModelError: Cannot overwrite QRCode model once compiled` failure exposed by the full Jest run. All local imports now use the physical Linux-safe filename `QrCode.js`; the Mongoose model name remains `QRCode` and production QR behavior is unchanged.

### Changed

| File | Change |
|---|---|
| `src/models/index.js` | Corrected the QR model barrel import from `./QRCode` to `./QrCode` |
| `src/tests/transformer.test.js` | Corrected both QR cleanup imports to `../models/QrCode` |
| `src/tests/seedRailwayDemoUsers.test.js` | Restored the captured test database URI between tests instead of substituting a different URI while Mongoose is connected |
| `docs/superpowers/reports/2026-07-11-qrcode-overwrite-model-fix.md` | Added the implementation and validation report |
| `docs/CHANGELOG_LOCAL_SETUP.md` | Added this changelog entry |

### Root cause

`transformer.test.js` first loaded the application, which reached `src/models/QrCode.js` through `routes -> transformerController -> qrService`. Its setup then required the same physical file as `../models/QRCode`. On the local case-insensitive filesystem, Jest executed the differently cased module identity again, while Mongoose already had the `QRCode` model registered. The new seeder also reached the remaining stale `./QRCode` barrel import through `src/models/index.js`. No `jest.resetModules()`, manual module-cache clearing, Mongoose model deletion, or Jest module isolation was involved.

### Validation

- `node --check scripts/seedRailwayDemoUsers.js`: passed.
- `npx jest --runInBand src/tests/seedRailwayDemoUsers.test.js`: 1 suite passed; 9 tests passed.
- `npx jest --runInBand src/tests/transformer.test.js`: 1 suite passed; 30 tests passed.
- `npm test`: 12 suites passed; 193 tests passed.
- `cd frontend && npm run build`: passed; existing Vite chunk-size warning remains.
- Repository search for local `models/QRCode` imports: no matches.
- Confirmed npm package imports `require('qrcode')` remain unchanged.

**Report:** `docs/superpowers/reports/2026-07-11-qrcode-overwrite-model-fix.md`

---

## 2026-07-11 — Railway-Safe Demo User Seeder

**Summary:** Added a narrow Railway-safe demo-user seeder that only creates or updates the 11 documented Phase 9F users, requires an explicit `MONGODB_URI`, avoids localhost fallback, preserves the intended inactive viewer account, and clears demo-user login/reset/session state without touching operational asset data.

### Changed

| File | Change |
|---|---|
| `scripts/seedRailwayDemoUsers.js` | Added Railway-safe Phase 9F demo-user create/update script with strict `MONGODB_URI` requirement and targeted session cleanup |
| `src/tests/seedRailwayDemoUsers.test.js` | Added focused regression coverage for explicit DB targeting, idempotent create/update behavior, hashing, lockout reset, inactive viewer preservation, and unrelated-user safety |
| `docs/CHANGELOG_LOCAL_SETUP.md` | Added this changelog entry and Railway execution guidance |

### Railway execution guidance

1. Open the Railway project for TrafoLog.
2. Select **only** the backend service for `https://trafolog-production.up.railway.app`.
3. In the backend service Variables tab, confirm that `MONGODB_URI` exists **without opening, copying, or pasting the value**.
4. Run this exact command from the backend service shell / one-off command environment:

```bash
node scripts/seedRailwayDemoUsers.js
```

5. Expected output shape:
   - one line per documented demo user
   - statuses limited to `CREATED`, `UPDATED`, `SKIPPED`, or `FAILED`
   - a final summary line such as `Summary: CREATED=... UPDATED=... SKIPPED=... FAILED=...`
6. Validate login with `super.admin@phase9f.io` using the documented demo password after the command completes.
7. Rollback limitation: this script does **not** delete users automatically. Removing preview demo users later must be a deliberate manual admin/database action.
8. Warning: **do not run `node scripts/phase9fSeedData.js` on an existing Railway preview database**. That broader script modifies multiple collections beyond the demo-user accounts.

### Validation

- `node --check scripts/seedRailwayDemoUsers.js`
- `npm test`
- Reviewed `src/models/User.js` schema validators and password hashing hooks.
- Reviewed `scripts/resetDemoPasswords.js` for reset-field parity.
- Reviewed `scripts/phase9fSeedData.js` and `docs/LOCAL_DEMO_USERS.md` for the canonical 11 demo users and intended activation states.

---

## 2026-07-10 — Railway Temporary Preview Deployment Guide

**Summary:** Added Railway-only temporary preview deployment documentation covering the backend, frontend, MongoDB, Redis, environment variables, CORS, cookie/auth caveats, seeded demo data, validation, troubleshooting, and shutdown steps.

### Changed

| File | Change |
|---|---|
| `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md` | Created Railway temporary preview deployment guide |
| `docs/CHANGELOG_LOCAL_SETUP.md` | Added this changelog entry |

### Validation

- Reviewed `package.json`, `frontend/package.json`, backend Mongo/Redis config, `src/app.js`, frontend env usage, `.env.example`, Phase 9F seed/reset/check scripts, and demo-user docs.
- Confirmed backend start command: `npm start`.
- Confirmed frontend build command: `npm run build`.
- Confirmed frontend preview script already exists: `npm run preview`.
- Confirmed backend env names: `MONGODB_URI`, `REDIS_URL`, and `CLIENT_URL`.
- `node scripts/checkLocalEnvironment.js`: first run failed backend health because the backend was not running; rerun after `npm start` passed Mongo, Redis, Backend, Frontend, Uploads, and Backup folder.
- `node scripts/phase9fSeedData.js`: passed and printed the full demo-account block.
- `node scripts/resetDemoPasswords.js`: passed; all 11 demo passwords reset to `Phase9F@1234`.
- `node scripts/phase9fValidateApiWorkflows.js`: passed with 64 passed, 0 failed, and 4 skipped/gap.
- `cd frontend && npm run build`: passed with the existing Vite chunk-size warning.
- `npm test`: passed with 11 suites and 184 tests.

**Guide:** `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`

---

## 2026-07-08 — Phase 9G-Final Demo Accounts & Local Environment Audit

**Summary:** Made local demo handoff more reproducible. Phase 9F seeding now prints a full demo-account credential block, demo users are documented, passwords can be reset to a known default, and a local environment checker verifies MongoDB, Redis, backend, frontend, uploads, and backup storage readiness.

### Changed

| File | Change |
|---|---|
| `scripts/phase9fSeedData.js` | Centralized demo-user specs and prints all demo credentials after seeding |
| `scripts/resetDemoPasswords.js` | Added password reset utility for Phase 9F demo users |
| `scripts/checkLocalEnvironment.js` | Added PASS/FAIL local environment checker |
| `docs/LOCAL_DEMO_USERS.md` | Added complete demo-user credential and permission reference |
| `docs/superpowers/reports/2026-07-08-phase-9g-final-demo-accounts-local-environment-audit.md` | Created operational sprint report |

### Validation

- `node scripts/checkLocalEnvironment.js`: passed after starting the local backend; Mongo, Redis, Backend, Frontend, Uploads, and Backup folder all reported `PASS`.
- `node scripts/phase9fSeedData.js`: passed and printed the full demo-account block.
- `node scripts/resetDemoPasswords.js`: passed; all 11 demo passwords reset to `Phase9F@1234`.
- `npm test`: first post-seed run hit transient Jest hook timeouts in `export.test.js` and `auth.test.js`; rerun passed with 11 suites and 184 tests.

**Report:** `docs/superpowers/reports/2026-07-08-phase-9g-final-demo-accounts-local-environment-audit.md`
