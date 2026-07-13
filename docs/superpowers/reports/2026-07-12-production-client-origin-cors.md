# Production CORS and Railway Proxy Trust Implementation Report

## Executive summary

Implemented a shared, production-safe `CLIENT_URL` resolver for Express CORS, Socket.IO CORS, and Helmet CSP, then corrected Express reverse-proxy trust for Railway. Development retains localhost CORS fallback and disabled proxy trust. Production requires one valid frontend origin and trusts exactly one app-facing Railway proxy hop. Credentialed CORS and all rate limits remain active.

The Railway TrafoLog `CLIENT_URL` gate was confirmed before delivery. Focused CORS, proxy, and authentication suites pass; the clean complete backend suite passes 229/229 tests; and the frontend production build passes.

## Confirmed root causes

The original backend independently used `process.env.CLIENT_URL || 'http://localhost:5173'` for Express and Socket.IO. Railway therefore returned the localhost origin when `CLIENT_URL` was absent or unsafe, which failed credentialed browser origin matching.

After `CLIENT_URL` was corrected, Railway preflight returned `204` but login returned `500`. Deploy logs identified `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`: Railway forwarded the client address while Express retained its default `trust proxy = false`. The global `/api` limiter validates this mismatch before the auth route runs. Four auth-specific limiters also contained older validation suppressions; extending that suppression would hide the proxy misconfiguration instead of correcting it.

## Current architecture and fix

`src/app.js` creates the sole Express app. It mounts one global `/api` limiter; `authRoutes.js` adds login, registration, password-reset, and verification limiters. Login and refresh persist `req.ip` in session, refresh-token, and audit records. Error logging also uses `req.ip`; API discovery links use `req.protocol`. Cookie security depends directly on `NODE_ENV`, not `req.secure`.

`resolveClientOrigin()` trims and parses `CLIENT_URL`, accepts only origin-only HTTP/HTTPS URLs, normalizes a root trailing slash, and rejects credentials, paths, queries, fragments, malformed URLs, and production loopback hosts including bracketed `[::1]`. The App resolves it once for Express CORS, Helmet CSP, and Socket.IO CORS. Credentials remain enabled.

`configureProxyTrust()` applies `trust proxy = 1` only when `NODE_ENV === 'production'`, immediately after `express()` and before middleware initialization. Development/test explicitly retain `false`. Numeric one-hop trust matches the current client-to-Railway-edge-to-service path and selects the nearest forwarded address, so an attacker-controlled extra leftmost entry is ignored. The implementation does not use permissive `true`, add a proxy environment variable, disable limiter validation, or change limiter policies.

## Files modified or created

- `.env.example`
- `src/app.js`
- `src/config/clientOrigin.js`
- `src/config/proxyTrust.js`
- `src/middleware/authRateLimiter.js`
- `src/websocket/index.js`
- `src/tests/clientOriginCors.test.js`
- `src/tests/proxyTrust.test.js`
- `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/plans/2026-07-12-production-client-origin-cors.md`
- This implementation report

The approved CORS design specification was previously committed separately. No frontend, cookie, credential, authentication controller/service, route, or unrelated production file was modified.

## Investigation scope

Inspected `src/app.js`; the available server entry points; every file under `src/middleware/` and `src/config/`; `src/routes/authRoutes.js`; `src/controllers/authController.js`; `src/services/authService.js`; `src/routes/index.js`; `src/services/userService.js`; error/logging utilities; `package.json`; all backend test filenames; and the authentication, CORS, admin, transformer, reference-data, and user test setup relevant to startup, proxy headers, IPs, cookies, and rate limiting. Repository-wide searches covered `trust proxy`, limiter creation, forwarded headers, `req.ip`, `req.ips`, `req.protocol`, `req.hostname`, `app.set`, `NODE_ENV`, and Railway references.

## Code diff summary

- Added pure origin and proxy-trust configuration modules.
- Replaced duplicated CORS origin expressions with one resolved value.
- Preserved the single-origin model and `credentials: true`.
- Applied production-only one-hop proxy trust before middleware.
- Removed four auth-limiter `X-Forwarded-For` validation suppressions while preserving windows, thresholds, headers, and successful-request behavior.
- Added focused origin, preflight, proxy, IP, spoof-resistance, rate-limit, refresh, and health coverage.
- Documented the exact Railway variable, trust rule, security implications, verification, risks, and rollback.

## TDD and validation evidence

The proxy suite first failed because `src/config/proxyTrust.js` did not exist. After the minimal helper and App wiring were added, it failed specifically because auth limiter validation was still suppressed. Removing only those suppressions produced green.

- Syntax checks: passed for App, both configuration helpers, WebSocket, and auth limiter modules.
- `clientOriginCors.test.js`: 18/18 passed.
- `proxyTrust.test.js`: 9/9 passed.
- `auth.test.js`: 9/9 passed.
- Initial `npm test`: 13/15 suites and 163/229 tests passed. Transformer and admin setup hooks exceeded existing time limits after MongoDB/Redis connected.
- Isolated transformer rerun: 30/30 passed unchanged.
- Isolated admin rerun: 36/36 passed unchanged.
- Clean exact `npm test` rerun: 15/15 suites and 229/229 tests passed.
- Frontend TypeScript/Vite build: passed; the existing >500 kB chunk warning remains.
- `git diff --check`: passed.

No timeout or fixture changes were made. Existing Mongoose reserved-key, duplicate-index, and deprecated-option warnings plus Jest's forced-exit/open-handle notice remain out of scope.

## Commands executed

```bash
node --check src/app.js
node --check src/config/clientOrigin.js
node --check src/config/proxyTrust.js
node --check src/middleware/authRateLimiter.js
node --check src/websocket/index.js
npx jest --runInBand src/tests/clientOriginCors.test.js
npx jest --runInBand src/tests/proxyTrust.test.js
npx jest --runInBand src/tests/auth.test.js
npm test
npx jest --runInBand src/tests/transformer.test.js
npx jest --runInBand src/tests/admin.test.js
npm test
cd frontend && npm run build
cd ..
git diff --check
git status --short
```

The first sandboxed Supertest run could not bind an ephemeral local port (`EPERM`); it was rerun with the approved local test permissions and passed.

## Dependencies and configuration

Dependencies added: none.

No package, frontend, cookie, auth, credential, route, or Railway service configuration was changed. Production Express now uses one trusted proxy hop without a new environment variable.

The confirmed TrafoLog backend value is:

```text
CLIENT_URL=https://imaginative-art-production-53f9.up.railway.app
```

Proxy trust requires no additional Railway variable.

## Risks

- Production intentionally fails startup for missing, malformed, path-bearing, credential-bearing, or loopback `CLIENT_URL`.
- Numeric one-hop trust assumes every public request reaches TrafoLog through the single Railway edge path. Adding another CDN/proxy or exposing a shorter path requires a new trust review.
- The single CORS origin intentionally excludes simultaneous localhost access in production.
- Existing cross-origin cookie behavior remains subject to the unchanged `sameSite: strict` policy.

## Rollback

Run `git revert <combined-implementation-commit>` and redeploy. This restores the previous inline CORS expressions, removes production proxy trust, and restores the auth-limiter validation suppressions. The corrected Railway `CLIENT_URL` may remain. Reverting proxy trust will reintroduce the Railway login failure while the global limiter receives forwarded headers.

## Git and deployment status

- Approved CORS design commit: `7276092` (`Document production client origin CORS design`).
- Combined implementation commit message: `Fix Railway proxy trust and production CORS`.
- Railway service changes during implementation: none.
- Commit hash, push synchronization, live deployment health, login response, and deploy-log verification are recorded in the final completion response because they occur after this report is committed.
