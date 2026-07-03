# Auth Contract Alignment Report

Date: 2026-07-03

## Summary

Aligned the backend authentication contract with browser-based authentication for the kVAssetTracker MVP. Browser clients can now refresh access tokens using the HTTP-only `refreshToken` cookie set at login, while non-browser clients may still send `refreshToken` in the request body.

## Root Cause

The controller already used the intended fallback:

```js
const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
```

However, `POST /api/auth/refresh` used `validate(refreshTokenSchema)` before the controller. The schema required `refreshToken` in `req.body`, so cookie-only browser requests failed with a 400 validation error before the controller could read `req.cookies.refreshToken`.

## Fix

- Made `refreshToken` optional in the refresh body validator.
- Kept the controller-level requirement that either `req.cookies.refreshToken` or `req.body.refreshToken` must exist.
- Kept HTTP-only cookie storage for refresh tokens.
- Removed `refreshToken` from `/api/auth/refresh` JSON responses.
- Left login JSON unchanged: it returns `user`, `accessToken`, and `sessionToken`, with `refreshToken` only in an HTTP-only cookie.

## Auth Contract Review

| Endpoint | Result |
|---|---|
| `POST /api/auth/login` | JSON response does not expose `refreshToken`; HTTP-only refresh cookie is set |
| `POST /api/auth/refresh` | Accepts HTTP-only cookie or optional JSON body token; returns `accessToken` only |
| `POST /api/auth/logout` | Authenticated route; can revoke refresh/session tokens from cookies or request body |
| `GET /api/auth/me` | Authenticated route; returns current user |
| `PUT /api/auth/me` | Docs corrected to allowed fields: `name`, `preferences`, `push_tokens` |
| `POST /api/auth/forgot-password` | Docs remain aligned with non-enumerating success response |
| `POST /api/auth/reset-password` | Swagger corrected to require `confirmPassword` |
| `POST /api/auth/verify-email` | Route validation, controller behavior, and docs agree |
| `POST /api/auth/resend-verification` | Route validation, controller behavior, and docs agree |
| `POST /api/auth/change-password` | Swagger corrected to require `confirmPassword` |
| `POST /api/auth/register` | Docs corrected: registration returns user data and does not issue login tokens |

## Tests Added

- Refresh succeeds using only the HTTP-only cookie.
- Refresh succeeds using a request body token for non-browser clients.
- Refresh rejects requests missing both cookie and body token with 401.
- Login and refresh responses do not expose `refreshToken` in JSON.

## Verification

Focused auth verification:

```text
npx jest src/tests/auth.test.js --runInBand --forceExit
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

Full-suite verification should be run after this report is committed:

```text
npm test
```

## Frontend Impact

The frontend can implement browser session refresh with Axios `withCredentials: true`, relying on the backend-managed HTTP-only `refreshToken` cookie. It should persist only the access token client-side and should never read or store a refresh token.

## Risks

- Non-browser clients that expected `refreshToken` in the refresh JSON response must instead keep their existing body token or read `Set-Cookie`.
- Token rotation remains controlled by `ROTATE_REFRESH_TOKENS`; when enabled, rotated refresh tokens are still delivered through HTTP-only cookies.

## Rollback

Revert these files:

- `src/validators/authValidator.js`
- `src/controllers/authController.js`
- `src/tests/auth.test.js`
- `swagger.yaml`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-03-auth-contract-alignment.md`
