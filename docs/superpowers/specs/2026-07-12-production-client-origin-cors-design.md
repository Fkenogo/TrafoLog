# Production Client Origin and CORS Design

## Objective

Replace duplicated inline `CLIENT_URL` fallback expressions with one shared backend resolver that supplies the same validated origin to Express CORS, Socket.IO CORS, and Helmet CSP. Development retains a localhost default. Production fails startup when `CLIENT_URL` is missing or unsafe instead of silently authorizing localhost.

## Current implementation and failure

`src/app.js` configures Express CORS with `process.env.CLIENT_URL || 'http://localhost:5173'`, enables credentials, and independently places `process.env.CLIENT_URL` in Helmet `connect-src`. `src/websocket/index.js` repeats the same `CLIENT_URL`-or-localhost expression for Socket.IO CORS. No other environment variable controls backend CORS.

The deployed backend returns `Access-Control-Allow-Origin: http://localhost:5173` while the browser sends `Origin: https://imaginative-art-production-53f9.up.railway.app`. Credentialed CORS requires an exact origin match, so the preflight fails. The response proves that Railway's backend `CLIENT_URL` is missing/empty or is explicitly configured as localhost.

## Architecture

Add `src/config/clientOrigin.js` as the single configuration boundary. It exports `resolveClientOrigin(env = process.env)` and the development default. The resolver is pure and independently testable.

`src/app.js` resolves the origin once during application construction and reuses it for:

- Express CORS `origin`;
- Helmet CSP `connect-src`.

`src/websocket/index.js` uses the same resolver for Socket.IO CORS. This preserves the current module architecture while removing divergent origin parsing.

The production security model remains a single exact origin. No wildcard, callback allowlist, comma-separated list, or additional environment variable will be introduced. `credentials: true` remains enabled for Express and Socket.IO.

## Resolution and validation rules

1. Read only `CLIENT_URL`.
2. Trim surrounding whitespace.
3. Outside production, missing or empty input resolves to `http://localhost:5173`.
4. In production, missing or empty input throws a configuration error.
5. Parse the value with the platform URL parser.
6. Accept only absolute `http:` or `https:` URLs.
7. Reject credentials, query strings, fragments, and non-root paths.
8. Normalize a root trailing slash by returning `url.origin`, so `https://example.com/` becomes `https://example.com`.
9. Reject `localhost`, `127.0.0.1`, and loopback IPv6 hosts in production.
10. Return only the normalized origin, never a path-bearing URL.

Development may explicitly supply localhost or another valid HTTP/HTTPS origin. Malformed or path-bearing configured values fail in every environment rather than silently falling back.

The required Railway backend value after deployment is:

```text
CLIENT_URL=https://imaginative-art-production-53f9.up.railway.app
```

No Railway variables will be changed during implementation.

## Error behavior

Configuration errors identify `CLIENT_URL` and the violated rule without printing unrelated secrets. Because the application resolves configuration during startup, unsafe production configuration prevents the backend from serving requests with an incorrect CORS header.

## Testing strategy

Create focused tests before implementation for:

- development localhost fallback;
- whitespace trimming;
- trailing-slash normalization;
- exact Railway production origin;
- origin-only return value;
- missing, empty, malformed, non-HTTP(S), credential-bearing, query-bearing, fragment-bearing, and path-bearing rejection;
- production rejection of localhost, `127.0.0.1`, and IPv6 loopback;
- Express preflight response matching the configured Railway origin;
- credential support in the preflight response;
- rejection/non-authorization of an unrelated origin;
- shared use by Socket.IO and Helmet through source/config integration assertions where direct construction would add unnecessary database or socket dependencies.

After the focused suite passes, run the complete backend test suite and the frontend production build. Existing duplicate-index and bundle-size warnings are out of scope and will only be reported.

## Files in scope

- Create `src/config/clientOrigin.js`.
- Create a focused test under `src/tests/`.
- Modify `src/app.js`.
- Modify `src/websocket/index.js`.
- Modify `.env.example` with production safety guidance.
- Modify `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`.
- Modify `docs/CHANGELOG_LOCAL_SETUP.md`, the repository's running change log; no separate `changes.md` exists.
- Create an implementation report under `docs/superpowers/reports/`.
- Create an implementation plan under `docs/superpowers/plans/`.

Frontend code, authentication behavior, cookies, routes, APIs, and unrelated backend files remain unchanged.

## Risks

- A production backend with missing or localhost `CLIENT_URL` will intentionally stop at startup. Railway must set the exact frontend origin before deploying this change.
- A future frontend domain change requires updating `CLIENT_URL` and redeploying the backend.
- The single-origin model intentionally does not support simultaneous production access from localhost.
- Cross-origin cookie behavior still depends on existing browser cookie attributes and HTTPS; this task changes only origin authorization and preserves current authentication behavior.

## Rollback

Revert the implementation commit and restore the previous inline `CLIENT_URL || localhost` expressions. If the Railway variable is corrected, it can remain set because the previous implementation also reads `CLIENT_URL`.
