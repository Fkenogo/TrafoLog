# Phase 9G-Final — Demo Accounts & Local Environment Audit

## Summary

Phase 9G-Final made the local demo environment more reproducible without adding product features. The seed script now prints a complete demo-account credential block, demo users are documented, passwords can be reset to the known default, and a local environment checker verifies the services and folders required for a developer handoff.

## Strategy

1. Treat Phase 9F seed data as the source of truth for demo accounts.
2. Preserve normal `User` model password hashing instead of writing hashes manually.
3. Keep environment validation lightweight and dependency-free beyond installed project packages.
4. Document exact accounts, roles, and operational checks in local docs.

## Files Modified

- `scripts/phase9fSeedData.js`
- `scripts/resetDemoPasswords.js`
- `scripts/checkLocalEnvironment.js`
- `docs/LOCAL_DEMO_USERS.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-08-phase-9g-final-demo-accounts-local-environment-audit.md`

## Demo Users

All demo accounts use password `Phase9F@1234`.

| Email | Role | Status |
|---|---|---|
| `super.admin@phase9f.io` | Super Admin | Active |
| `operations.manager@phase9f.io` | Territory Manager | Active |
| `supervisor.north@phase9f.io` | Engineer | Active |
| `supervisor.south@phase9f.io` | Engineer | Active |
| `technician1@phase9f.io` | Field Technician | Active |
| `technician2@phase9f.io` | Field Technician | Active |
| `technician3@phase9f.io` | Field Technician | Active |
| `technician4@phase9f.io` | Field Technician | Active |
| `technician5@phase9f.io` | Field Technician | Active |
| `viewer1@phase9f.io` | Viewer | Active |
| `viewer2@phase9f.io` | Viewer | Inactive |

## Password Reset Strategy

`node scripts/resetDemoPasswords.js` resets all Phase 9F demo users to `Phase9F@1234`, clears login lockout state, clears reset tokens, and clears refresh tokens. The script uses `User.save()` so the existing bcrypt pre-save middleware hashes the password consistently with normal account creation.

## Local Environment Check

`node scripts/checkLocalEnvironment.js` verifies:

- MongoDB connection and ping
- Redis connection and ping
- Backend health endpoint
- Frontend URL
- Upload temp folder write access
- Backup folder write access

The script prints `PASS` / `FAIL` rows and exits with a non-zero code if any required check fails.

## Validation

| Command | Result |
|---|---|
| `node scripts/checkLocalEnvironment.js` | Passed after starting the local backend: Mongo, Redis, Backend, Frontend, Uploads, and Backup folder all reported `PASS`. A sandboxed first run failed on localhost access, and the pre-backend run correctly reported Backend `FAIL`. |
| `node scripts/phase9fSeedData.js` | Passed. Seed output now includes JSON summary and the complete Demo Accounts block. |
| `node scripts/resetDemoPasswords.js` | Passed with local Mongo access. All 11 demo users reset to `Phase9F@1234`; inactive Viewer Two remained inactive. |
| `npm test` | Passed on rerun: 11 suites, 184 tests. The first post-seed run hit transient Jest hook timeouts in `export.test.js` and `auth.test.js` before the clean rerun. |

## Risks

- The environment checker expects backend and frontend servers to be running. This is intentional for handoff verification, but developers should start both before running it.
- `viewer2@phase9f.io` is intentionally inactive for deactivated-account validation.
- Local `.env` values can still override the default backend, frontend, upload, backup, Mongo, and Redis locations.

## Rollback

1. Remove `scripts/resetDemoPasswords.js`.
2. Remove `scripts/checkLocalEnvironment.js`.
3. Revert `scripts/phase9fSeedData.js`.
4. Remove `docs/LOCAL_DEMO_USERS.md`.
5. Revert the changelog/report updates.
6. Rerun `node scripts/phase9fSeedData.js` and `npm test`.
