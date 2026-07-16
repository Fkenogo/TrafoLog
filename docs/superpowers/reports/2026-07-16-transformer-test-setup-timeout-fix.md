# Transformer Test Setup Timeout — Investigation and Fix

**Date:** 2026-07-16  
**Scope:** Test infrastructure only  
**Railway changes:** None  
**Commit/push:** Not performed

## Symptom

`src/tests/transformer.test.js` exceeded Jest's default 5,000 ms `beforeAll`
timeout. All 30 transformer assertions were prevented from running when the
hook timed out.

## Investigation

Temporary test-local timing wrappers measured every setup boundary with a
30-second diagnostic hook allowance:

| Operation | Before |
| --- | ---: |
| Application import | 6,981.5 ms |
| `database.connect()` including index creation | 1,524.0 ms |
| `redis.connect()` | 891.2 ms |
| Cleanup operations | 103.4 ms |
| User registration and login | 2,682.1 ms |
| Territory/service-area creation | 21.3 ms |
| Transformer fixture creation | 23.2 ms |
| Total `beforeAll` | 5,261.0 ms |

Application import occurs before Jest starts the hook and therefore was not the
hook timeout source. MongoDB, index creation, Redis, cleanup, and reference
fixtures completed normally. The largest avoidable operation was the
registration/login workflow.

That workflow performed work unrelated to transformer endpoint coverage:

- password hashing during registration;
- password comparison during login;
- refresh-token persistence;
- session persistence;
- audit-log persistence;
- successful-login state updates.

The transformer suite requires only an active persisted Super Admin and a valid
JWT so that the real authentication and authorization middleware can run.
Dedicated authentication suites cover registration and login behavior.

## Fix

The suite now creates its Super Admin fixture directly with `User.create()` and
generates the access token with `user.generateAuthToken()`. No production code,
global Jest timeout, assertion, or test count changed.

Post-change diagnostic timing:

| Operation | After |
| --- | ---: |
| `database.connect()` including index creation | 543.8 ms |
| `redis.connect()` | 399.0 ms |
| Cleanup operations | 161.5 ms |
| User creation and token generation | 1,067.4 ms |
| Territory/service-area creation | 7.8 ms |
| Transformer fixture creation | 19.8 ms |
| Total `beforeAll` | 2,210.8 ms |

The setup hook improved by 3,050.2 ms, or approximately 58%, and now remains
below the default 5-second hook timeout without a custom hook allowance.

## Endpoint-specific timing

Combined-suite validation also exposed two genuine CPU-heavy endpoint tests:

- the QR idempotency test makes two requests that each regenerate and persist a
  300px high-error-correction PNG;
- the bulk-create test serially creates two transformers and generates a QR
  image for each.

Measured QR request durations were 4,359 ms and 4,156 ms, totaling 8,515 ms.
Both tests retain all original assertions and have narrowly scoped 15-second
test timeouts. No suite-wide or global timeout was added.

## Validation

```text
Transformer suite:
1 suite passed
30 tests passed

Operational four-suite gate:
4 suites passed
88 tests passed

Full backend:
18 suites passed
262 tests passed
```

The frontend production build also passed with 1,736 transformed modules and
the existing bundle-size warning.

## Risks

- Test duration depends on local MongoDB, Redis, bcrypt, and QR generation
  performance.
- Existing Mongoose duplicate-index/deprecation warnings and Jest's force-exit
  notice remain outside this test-only fix.
- The transformer test fixture intentionally bypasses registration/login API
  integration; those paths remain covered by dedicated authentication tests.

## Rollback

Before commit, restore only `src/tests/transformer.test.js` and remove this
report plus the corresponding running-changes entry. After a future approved
commit, use a Git revert commit rather than a destructive reset.
