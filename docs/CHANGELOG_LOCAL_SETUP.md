# Local Setup Change Log

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
