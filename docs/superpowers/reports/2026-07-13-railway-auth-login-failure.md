# Railway AuthService Login HTTP 500 — Implementation Report

## Executive summary

The live HTTP 500 was not CORS, proxy trust, rate limiting, user state, or password verification. The Railway TrafoLog service was missing the required `JWT_SECRET`. A secret-safe, read-only diagnostic reproduced the live path against the targeted preview user and captured the exact `jsonwebtoken` exception. The implementation now rejects unusable JWT configuration at startup, keeps the established refresh-secret fallback, prevents token-issuance failures from mutating successful-login state, and logs a sanitized failing stage.

## Confirmed exception, stack, and stage

Failing stage: `auth.login.issue_access_token`.

```text
Error: secretOrPrivateKey must have a value
    at module.exports [as sign] (.../node_modules/jsonwebtoken/sign.js:111:20)
    at userSchema.methods.generateAuthToken (.../src/models/User.js:180:14)
    at main (/private/tmp/diagnose-railway-login.js:75:10)
```

The production service flow fails at `src/services/authService.js` when it calls `user.generateAuthToken()`. The underlying signing operation was at `src/models/User.js:180` in the deployed revision.

## Evidence and database inspection

The diagnostic read only the targeted `super.admin@phase9f.io` user and directly related authentication records. It did not print the password, hash, tokens, secrets, cookies, MongoDB URI, or Redis URL.

- User lookup: succeeded.
- Active status: true.
- Account locked: false.
- Login attempts: zero before the diagnostic.
- Documented password comparison: succeeded.
- Access-token generation: failed because `JWT_SECRET` was absent.
- Session count: zero.
- Refresh-token count: zero.
- Login audit count: zero.
- Partial write: the prior live login had updated `User.last_login` before token generation failed.

Collections read: `users`, `sessions`, `refreshtokens`, and `auditlogs`. The read-only production diagnostic modified no collection.

## Fix strategy and implementation

- `src/config/auth.js` now resolves the required `JWT_SECRET`, preserves the existing optional `JWT_REFRESH_SECRET` fallback, and rejects missing/blank secrets everywhere plus the documented placeholder in production.
- `src/app.js` validates auth configuration during construction, before the server starts accepting requests.
- `src/models/User.js` uses the shared resolved signing secrets.
- `src/services/authService.js` issues access and refresh tokens before changing successful-login fields, saves those fields together, records secret-safe stage diagnostics, and removes only Session/RefreshToken documents created by the current attempt when a later unexpected stage fails.
- The browser still receives the existing generic `Failed to login` response; raw internal exceptions remain server-side.

No authentication check, password hashing behavior, cookie policy, route, proxy trust, CORS rule, rate limit, user credential, or refresh-token policy was weakened.

## Tests and validation

TDD red evidence:

- `authConfig.test.js`: five failures because config resolution/startup validation did not exist.
- `authLoginRegression.test.js`: failed because `login_attempts` changed from 2 to 0 before token issuance threw.

Current focused results:

- Auth config: 5/5 passed.
- Railway login regression: 4/4 passed, including preservation of pre-existing auth artifacts and exact successful-login artifact cardinality.
- Existing authentication: 9/9 passed.
- Production client-origin/CORS: 18/18 passed.
- Proxy trust/rate limiting: 9/9 passed.
- Syntax checks: passed for all modified backend JavaScript files.

Full backend result:

- The first exact `npm test` run timed out only in `fault.test.js`; that suite passed unchanged in isolation, 20/20.
- Subsequent exact runs exposed registration-heavy setup timeouts. A read-only Mongo diagnostic found small collections and no lock contention. The local `.env` had external SMTP configured, and registration awaits Nodemailer before continuing.
- `audit.test.js` reproduced its 30-second timeout alone with external SMTP enabled, then passed 10/10 in 3.3 seconds with only `SMTP_HOST` empty for the process.
- Final `SMTP_HOST= npm test`: 17/17 suites and 238/238 tests passed. No test timeout, fixture, email implementation, or assertion was changed.

Frontend result: `npm run build` passed. Vite retained the existing advisory for a JavaScript chunk larger than 500 kB.

The Railway TrafoLog `JWT_SECRET` was set to a generated strong preview-only value through CLI stdin with deploy triggering skipped. Secret-safe verification confirmed it is present and is not the documented placeholder; `CLIENT_URL` remains the approved frontend origin.

## Dependencies and configuration

Dependencies added: none.

Repository config change: JWT configuration is now validated centrally and at app startup. `.env.example` documents that production cannot use its placeholder.

Railway variable required on TrafoLog:

```text
JWT_SECRET=<strong preview-only secret>
```

No new variable name was introduced. `JWT_REFRESH_SECRET` remains optional.

No Railway database, user, seeder, service topology, or frontend variable was changed.

## Documentation correction

`docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md` now requires this Railway preview order:

```bash
railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FReferences.js'

railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayDemoUsers.js'
```

The reference seeder must report `FAILED=0` before the user seeder runs. The guide warns not to run `phase9fSeedData.js` or `resetDemoPasswords.js` against the existing Railway preview database.

## Risks and rollback

- A production deployment with missing, blank, or placeholder `JWT_SECRET` now fails startup intentionally instead of serving an authentication path guaranteed to return HTTP 500.
- Changing `JWT_SECRET` invalidates previously issued access and refresh tokens. The current preview had no related artifacts for the demo administrator at diagnosis time.
- Attempt-scoped cleanup is best-effort; any cleanup failure is logged by operation count without tokens or secrets.
- Existing duplicate Mongoose index and reserved-path warnings remain out of scope.
- The local full suite depends on SMTP being unset or promptly reachable because registration sends verification email synchronously. That pre-existing fixture/environment coupling remains out of scope and was not hidden; the green full-suite evidence explicitly disabled external SMTP for the test process.

Rollback: revert the delivery commit and redeploy. Keep the Railway `JWT_SECRET`; removing it would restore the original HTTP 500. If an emergency rollback requires rotating the preview secret, expect existing preview tokens to become invalid and users to sign in again.

## Secret-handling confirmation

No live supplied password, password hash, access token, refresh token, JWT secret, cookie, MongoDB URI, or Redis URL was written to repository files, command output, logs captured for this report, or client responses. The regression suite uses only its own synthetic test credential.

## Git and post-deployment verification

Implementation commit:

```text
aa0d439fa28dd7d3f42ef5563d9164433db6ecf7 Fix Railway demo login failure
```

GitHub `origin/main` was independently verified at that commit before deployment checks. Railway deployment `461a72c6-644e-4824-acaa-10c9f1f35517` reported `SUCCESS` for the exact implementation commit.

Live results:

- `GET /health`: 200; status healthy; MongoDB connected; Redis connected; WebSocket running.
- Approved-frontend `OPTIONS /api/auth/login`: 204 with the exact Railway frontend origin and credentials enabled.
- `POST /api/auth/login` for `super.admin@phase9f.io`: 200; success true; access token returned; refresh and session cookies returned. Token/cookie values were held only in process memory and not printed.
- Cookie-backed `POST /api/auth/refresh`: 200; a new access token was returned.
- Inactive `viewer2@phase9f.io` login: 401 with `Account is deactivated`.
- Rate limit: five failed credential requests to a nonexistent valid-format email returned 401 with remaining counts 4, 3, 2, 1, 0; the sixth returned 429. No real user was locked or modified.
- Current deployment log matches: zero for `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`, zero for `secretOrPrivateKey must have a value`, and zero for the sanitized `auth.login.failure` event.

A final read-only live Session/RefreshToken/AuditLog count was attempted twice through Railway's public MongoDB endpoint, but both attempts returned `MongooseServerSelectionError`. No database result is inferred from that failure. Exact single-login cardinality and preservation of pre-existing auth artifacts are covered by the green real-model regression suite; live artifact counts remain unverified due solely to public endpoint connectivity.
