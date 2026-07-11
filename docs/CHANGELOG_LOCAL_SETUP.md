# Local Setup Change Log

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
