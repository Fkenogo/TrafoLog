# Production Client Origin CORS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize and validate the backend `CLIENT_URL` so development safely defaults to localhost and production authorizes exactly the configured Railway frontend origin for Express CORS, Socket.IO CORS, and Helmet CSP.

**Architecture:** Add a pure resolver in `src/config/clientOrigin.js`. Resolve once in the Express application and use the same helper in Socket.IO. Preserve the existing single-origin and credentialed CORS architecture while failing startup for unsafe production configuration.

**Tech Stack:** Node.js, CommonJS, Express, `cors`, Socket.IO, Helmet, Jest, Supertest, Vite.

## Global Constraints

- Read only `CLIENT_URL`; add no alternate CORS environment variable.
- Preserve `credentials: true` for Express and Socket.IO.
- Do not modify frontend code, authentication, cookies, routes, APIs, or unrelated files.
- Do not modify Railway directly.
- Do not push until the user confirms Railway backend `CLIENT_URL=https://imaginative-art-production-53f9.up.railway.app`.
- Do not commit the implementation until that same confirmation, per the approved execution order.

---

### Task 1: Focused resolver and integration tests

**Files:**
- Create: `src/tests/clientOriginCors.test.js`

**Interfaces:**
- Consumes: planned `resolveClientOrigin(env)` and `DEFAULT_DEVELOPMENT_ORIGIN` exports.
- Produces: executable contract for origin validation and Express preflight behavior.

- [ ] **Step 1: Write resolver tests first**

Cover development fallback, whitespace trimming, trailing slash normalization, exact Railway production origin, malformed/non-HTTP/path/query/fragment/credential rejection, production missing/empty rejection, and production loopback rejection for `localhost`, `127.0.0.1`, and parsed `[::1]`.

- [ ] **Step 2: Write Express preflight tests first**

Instantiate the existing app under the configured Railway origin and assert preflight returns that exact `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, and never authorizes an unrelated request origin as itself. Avoid assuming HTTP 403 or header omission.

- [ ] **Step 3: Verify RED**

Run `npx jest --runInBand src/tests/clientOriginCors.test.js` and confirm failure because `src/config/clientOrigin.js` does not exist.

### Task 2: Shared production-safe resolver

**Files:**
- Create: `src/config/clientOrigin.js`
- Modify: `src/app.js`
- Modify: `src/websocket/index.js`
- Test: `src/tests/clientOriginCors.test.js`

**Interfaces:**
- Produces: `resolveClientOrigin(env = process.env): string` and `DEFAULT_DEVELOPMENT_ORIGIN`.
- Consumes: the returned origin in Express CORS, Helmet CSP, and Socket.IO CORS.

- [ ] **Step 1: Implement minimal resolver**

Trim `CLIENT_URL`, apply the development-only fallback, parse with `URL`, validate the protocol and origin-only shape, reject production loopback hosts including URL-parser `[::1]`, and return `url.origin`.

- [ ] **Step 2: Wire Express and Helmet**

Resolve once in the App constructor, use `this.clientOrigin` for Helmet `connect-src` and Express `cors({ origin, credentials: true })`.

- [ ] **Step 3: Wire Socket.IO**

Call the shared resolver for Socket.IO's `cors.origin` and retain `credentials: true`.

- [ ] **Step 4: Verify GREEN**

Run `npx jest --runInBand src/tests/clientOriginCors.test.js`; expected all focused tests pass.

### Task 3: Documentation and report

**Files:**
- Modify: `.env.example`
- Modify: `docs/RAILWAY_TEMP_PREVIEW_DEPLOYMENT.md`
- Modify: `docs/CHANGELOG_LOCAL_SETUP.md`
- Create: `docs/superpowers/reports/2026-07-12-production-client-origin-cors.md`

**Interfaces:**
- Produces: exact Railway variable instructions, implementation evidence, risks, and rollback.

- [ ] **Step 1: Update configuration guidance**

Document development fallback, production validation, exact Railway value, trailing-slash normalization, and redeployment requirement without changing actual Railway state.

- [ ] **Step 2: Update the running changelog and report**

Record root cause, files, diff, tests, build, dependencies/config, Railway gate, risks, rollback, and Git state. Use `docs/CHANGELOG_LOCAL_SETUP.md` because no separate `changes.md` exists.

### Task 4: Full verification and deployment gate

**Files:**
- Verify the complete scoped diff.

**Interfaces:**
- Produces: evidence required before the implementation may be committed or pushed.

- [ ] **Step 1: Run requested validation**

```bash
npx jest --runInBand src/tests/clientOriginCors.test.js
npm test
cd frontend && npm run build
```

Expected: all commands exit 0; record existing warnings.

- [ ] **Step 2: Audit scope and safety**

Run syntax checks, `git diff --check`, inspect the full diff, and confirm frontend/auth/cookies/routes are unchanged.

- [ ] **Step 3: Pause for Railway confirmation**

If the user has not explicitly confirmed the backend Railway variable is corrected, stop with all implementation changes uncommitted and unpushed. Request confirmation of:

```text
CLIENT_URL=https://imaginative-art-production-53f9.up.railway.app
```

### Task 5: Commit, push, and verify

**Files:**
- Stage only the scoped implementation, test, plan, configuration example, deployment guide, changelog, and report.

**Interfaces:**
- Produces: synchronized `main` and `origin/main` after the deployment gate is satisfied.

- [ ] **Step 1: Commit after confirmation**

Commit with `Add production-safe client origin CORS configuration`.

- [ ] **Step 2: Push and verify**

Push `main`, fetch `origin/main`, compare hashes, and verify a clean synchronized worktree.

- [ ] **Step 3: Deliver the required report**

Report files, diff, commands, focused/full/build results, dependencies, config, Railway variable, risks, rollback, commit, push, implementation report, and changelog update.
