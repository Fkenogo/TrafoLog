# Local Setup Change Log

Tracks changes made to bring the kVAssetTracker backend to a working local state. Not for production deployment; see git history for feature changes.

---

## 2026-06-22 — Onboarding Cleanup (Session 2)

**Commit:** TBD (this session)

**Summary:** Replaced generic Proxy wrappers with explicit named stubs or bound methods across all controllers. Fixed Jest test suite. Fixed authController missing import. Made SMTP failure non-fatal on registration.

### Changed

| File | Change |
|---|---|
| `src/app.js` | Guard `app.start()` with `if (require.main === module)` to prevent auto-start when imported by tests |
| `src/tests/auth.test.js` | Full rewrite: DB/Redis lifecycle, `app.getApp()` for supertest, refreshToken from Set-Cookie header |
| `src/controllers/authController.js` | Added missing `User` import; removed Proxy; export with `.bind(_ctrl)` per method (needed for `this.setTokenCookies`) |
| `src/services/authService.js` | Wrapped `sendVerificationEmail` in try/catch in `register()` — SMTP failure is non-fatal |
| `src/controllers/transformerController.js` | Removed Proxy; added 7 explicit 501 stubs inside class |
| `src/controllers/inspectionController.js` | Removed Proxy; added 5 explicit 501 stubs inside class |
| `src/controllers/faultController.js` | Removed Proxy; added 6 explicit 501 stubs inside class |
| `src/controllers/maintenanceController.js` | Removed Proxy; added `getStats` stub inside class (4 others already existed as class fields) |
| `src/controllers/installationController.js` | Removed Proxy only (all methods already present as class fields) |
| `src/controllers/dashboardController.js` | Removed Proxy only |
| `src/controllers/reportController.js` | Removed Proxy only |
| `src/controllers/importController.js` | Removed Proxy only |
| `src/controllers/notificationController.js` | Removed Proxy only |
| `src/controllers/timelineController.js` | Removed Proxy only |
| `src/controllers/syncController.js` | Removed Proxy only |
| 12 new stub controllers | Replaced `new Proxy({}, {...})` with `const notImpl = (name) => ...` explicit exports |
| `src/services/reportService.js` | Replaced Proxy with explicit named `notImpl` function exports (16 methods) |

**Test result:** 6/6 passing

---

## 2026-06-21 — Initial Local Onboarding (Session 1)

**Commit:** 77fabcb

**Summary:** Made the backend start and serve locally. MongoDB 7 + Redis 8 set up via Homebrew. Fixed 56 files to resolve startup crashes.

### Environment

- MongoDB 7 running via `brew services start mongodb-community`
- Redis 8 running via `brew services start redis`
- `.env` present locally (not tracked in git)

### Changed (selected highlights)

| File | Change |
|---|---|
| `package.json` | Fixed test/start script paths |
| `src/config/database.js` | Removed deprecated `useNewUrlParser`, `useUnifiedTopology` |
| `src/routes/index.js` | Fixed Express 5 wildcard route syntax |
| `src/routes/syncRoutes.js` | Added missing `authorize` middleware import |
| `src/middleware/rateLimiter.js` | Removed `keyGenerator` that caused `ERR_ERL_KEY_GEN_IPV6` |
| `src/middleware/fileUpload.js` | Implemented from 0 bytes; added path traversal fix (`crypto.randomBytes` filename) |
| 12 model files | Removed `next` from async pre-save hooks (Kareem 3.3.0 change) |
| 3 script files | Removed deprecated Mongoose options |
| `src/utils/validation.js` | Created bridge to `authValidator` |
| `src/utils/sms.js` | Created stub for missing `notificationService` dependency |
| 5 validator files | Created stubs required by route files |
| 12 new controllers | Created with Proxy stubs (replaced in Session 2) |
| `src/services/reportService.js` | Created with Proxy stubs (replaced in Session 2) |

**Preview URLs verified:**
- `http://localhost:3000/health` — 200
- `http://localhost:3000/api` — 200
- `http://localhost:3000/api-docs/` — 200

---

## Notes

- `.env` is NOT tracked in git. Copy `.env.example` → `.env` for new installs.
- See `docs/LOCAL_ONBOARDING.md` for first-time setup instructions.
- Detailed per-session audit: `docs/superpowers/reports/2026-06-22-onboarding-cleanup-audit.md`
