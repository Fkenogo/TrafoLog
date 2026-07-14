# Railway Auth Login Failure Implementation Plan

**Goal:** Make Railway demo login succeed by validating the required JWT configuration before startup and preventing token-issuance failures from partially mutating authentication state.

**Confirmed production condition:** The Railway TrafoLog service has no `JWT_SECRET`. The target user lookup and password verification succeed, then `User.generateAuthToken()` throws `Error: secretOrPrivateKey must have a value` from `jsonwebtoken/sign.js`. The failed request writes `last_login` before token issuance but creates no session, refresh token, or audit record.

**Architecture:** Keep the existing Express, model, and service boundaries. Centralize JWT-secret resolution in the existing empty `src/config/auth.js`, validate it during app construction, and have the User token methods use the same resolver. Reorder successful-login mutations so both tokens are issued before `login_attempts` or `last_login` are persisted. Add structured, secret-safe stage metadata to the existing service logger.

## TDD sequence

1. Add configuration tests for valid development/test resolution and clear production rejection of missing, empty, and documented placeholder secrets.
2. Add an integration regression test using the real User, Session, RefreshToken, and AuditLog models. Confirm a valid active user's missing-secret login fails safely without changing `last_login`, login attempts, or creating auth artifacts.
3. Assert the server diagnostic identifies `auth.login.issue_access_token` without containing the supplied password or secret.
4. Run the new tests and observe the expected failures before changing production code.
5. Implement the configuration resolver, app startup validation, model integration, login ordering, and safe stage logging.
6. Re-run the focused regression tests, existing auth tests, CORS tests, and proxy-trust tests.
7. Run the full backend suite, frontend production build, syntax checks, and Git whitespace/status checks.
8. Correct Railway preview seed documentation, update the changelog, and write the implementation report.
9. Set a strong Railway-only `JWT_SECRET` without printing it, then commit and push only the validated relevant files.
10. Verify the deployed health, CORS preflight, login, refresh, inactive-user rejection, rate limiting, auth artifact counts, and absence of the diagnosed exceptions.

## Security boundaries

- No default or localhost JWT secret.
- No secret, password, token, cookie, or connection URL in diagnostics or reports.
- No authentication bypass, rate-limit change, broad seed, or operational-data deletion.
- `JWT_REFRESH_SECRET` remains optional because the established architecture deliberately falls back to the required `JWT_SECRET`.
- Production rejects the repository's documented placeholder value rather than imposing an unproven arbitrary length rule.
