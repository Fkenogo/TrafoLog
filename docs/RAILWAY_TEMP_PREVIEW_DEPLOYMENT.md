# Railway Temporary Preview Deployment

This guide deploys kVAssetTracker as a temporary online preview on Railway only. It is intended for demo validation with seeded Phase 9F data, not for real production data or production restore testing.

## Deployment Structure

Create one Railway project with four services:

| Service | Railway source | Purpose |
|---|---|---|
| `kvassettracker-backend` | GitHub repo root | Express API, WebSocket server, scheduled jobs |
| `kvassettracker-frontend` | GitHub repo `/frontend` directory | Vite/React app served by Vite preview |
| `kvassettracker-mongodb` | Railway MongoDB service | Preview database |
| `kvassettracker-redis` | Railway Redis service | Cache/session-adjacent runtime dependency |

Do not attach local `.env` files. Set preview variables in Railway service settings.

## 1. Railway Account Setup

1. Sign in to Railway.
2. Create a new project for the temporary preview.
3. Connect the GitHub account that has access to the kVAssetTracker repository.
4. Keep all services in the same Railway project so internal service variables can be referenced from the backend.

## 2. GitHub Repo Connection

1. In the Railway project, choose `New Service` then `GitHub Repo`.
2. Select the kVAssetTracker repository.
3. Create the backend service first from the repository root.
4. Create a second GitHub service for the frontend and set its root directory to `/frontend`.

Use the same branch for both services.

## 3. MongoDB Service Setup

1. Add a Railway MongoDB service.
2. Copy or reference its connection URL into the backend service as:

```text
MONGODB_URI=<Railway MongoDB connection URL>
```

The backend reads exactly `MONGODB_URI` in `src/config/database.js`. The Phase 9F seed and password reset scripts also use `MONGODB_URI`.

## 4. Redis Service Setup

1. Add a Railway Redis service.
2. Copy or reference its connection URL into the backend service as:

```text
REDIS_URL=<Railway Redis connection URL>
```

The backend reads exactly `REDIS_URL` in `src/config/redis.js`.

## 5. Backend Service Setup

Service root: repository root.

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

`npm start` runs:

```bash
node src/app.js
```

The Express app listens on `process.env.PORT`, which Railway supplies.

### Required Backend Env Vars

Set these on the backend Railway service:

```text
NODE_ENV=production
PORT=<provided by Railway>
APP_URL=https://<backend-service>.up.railway.app
API_URL=https://<backend-service>.up.railway.app
CLIENT_URL=https://<frontend-service>.up.railway.app
MONGODB_URI=<Railway MongoDB connection URL>
REDIS_URL=<Railway Redis connection URL>
JWT_SECRET=<generate a strong preview-only secret>
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d
BACKUP_STORAGE_PROVIDER=local
BACKUP_LOCAL_DIR=/tmp/kvassettracker-backups
BACKUP_RETENTION_DAYS=7
BACKUP_ENCRYPTION_ENABLED=false
```

Optional preview variables from `.env.example` can remain unset unless the preview explicitly tests those integrations:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
MAPBOX_TOKEN
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
MAX_FILE_SIZE
ALLOWED_FILE_TYPES
```

Do not set real SMTP, Twilio, MinIO, or production backup credentials for a temporary preview unless that integration is intentionally being validated with preview-only accounts.

## 6. Frontend Service Setup

Service root: `/frontend`.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm run preview -- --host 0.0.0.0 --port $PORT
```

`frontend/package.json` already includes:

```json
"preview": "vite preview --host 127.0.0.1"
```

Railway needs the start command override above so Vite preview binds to Railway's interface and port.

### Required Frontend Env Vars

Set these on the frontend Railway service:

```text
VITE_API_BASE_URL=https://<backend-service>.up.railway.app/api
```

The frontend reads exactly `VITE_API_BASE_URL` in `frontend/src/api/http.ts`. If it is unset, the app defaults to `/api`, which only works when frontend and backend are served behind the same origin or a proxy.

## 7. CORS Setup

The backend CORS origin is controlled by:

```text
CLIENT_URL=https://<frontend-service>.up.railway.app
```

Set `CLIENT_URL` to the exact frontend origin, including `https://` and no trailing slash. This variable is also used by:

- Express CORS credentials configuration.
- Socket.IO CORS configuration.
- Helmet CSP `connect-src`.
- Email/reset URL generation.

If the frontend Railway URL changes, update backend `CLIENT_URL` and redeploy the backend.

## 8. Cookie/Auth Notes

The backend currently sets auth cookies with:

```text
httpOnly=true
secure=true when NODE_ENV=production
sameSite=strict
```

For Railway preview on separate frontend/backend `*.up.railway.app` hostnames:

- Login returns the access token in the JSON response, and the frontend sends it as an `Authorization: Bearer ...` header for API calls.
- Cookie-backed refresh/session/logout flows may be sensitive to the frontend and backend being on different hostnames because cookies are `sameSite=strict`.
- Best preview setup: use aligned custom subdomains under the same registrable site if refresh-cookie behavior must be tested.
- Do not loosen cookie policy for this temporary preview unless a separate product/security decision is made.

## 9. Seed Data Commands

Run these against the Railway backend environment after MongoDB is connected and before demo testing:

```bash
node scripts/phase9fSeedData.js
node scripts/resetDemoPasswords.js
```

Run them from a Railway shell/job or from a trusted local terminal with the Railway preview `MONGODB_URI` exported. Do not point them at production data.

The seed script refreshes records with Phase 9F prefixes and demo-user emails. The password reset script resets all demo accounts to the documented default.

## 10. Demo Users

Reference:

```text
docs/LOCAL_DEMO_USERS.md
```

Default demo password:

```text
Phase9F@1234
```

Primary active demo accounts:

| Email | Role |
|---|---|
| `super.admin@phase9f.io` | Super Admin |
| `operations.manager@phase9f.io` | Territory Manager |
| `supervisor.north@phase9f.io` | Engineer |
| `supervisor.south@phase9f.io` | Engineer |
| `technician1@phase9f.io` | Field Technician |
| `viewer1@phase9f.io` | Viewer |

`viewer2@phase9f.io` is intentionally inactive and should be rejected until reactivated by a Super Admin.

## 11. Preview URL Testing Checklist

After both services deploy:

1. Open backend health:

```text
https://<backend-service>.up.railway.app/health
```

Expected: `status` is `healthy`, and database/redis are connected.

2. Open API root:

```text
https://<backend-service>.up.railway.app/api
```

Expected: kVAssetTracker API metadata and endpoint list.

3. Open frontend:

```text
https://<frontend-service>.up.railway.app
```

4. Log in with `super.admin@phase9f.io` and `Phase9F@1234`.
5. Confirm dashboard loads.
6. Confirm Transformers, Faults, Inspections, Maintenance, Reports, and Admin pages load for the Super Admin.
7. Confirm a Viewer account cannot access Admin.
8. Confirm `viewer2@phase9f.io` is rejected while inactive.
9. Avoid real restore execution. If restore UI is inspected, use dry-run only with seeded preview data.

## 12. Local Validation Before Deployment

Run locally before pushing/deploying:

```bash
node scripts/checkLocalEnvironment.js
node scripts/phase9fSeedData.js
node scripts/resetDemoPasswords.js
node scripts/phase9fValidateApiWorkflows.js
cd frontend && npm run build
cd .. && npm test
```

These commands require local MongoDB, Redis, backend, and frontend availability where applicable.

## 13. Troubleshooting

| Symptom | Check |
|---|---|
| Backend health returns `503` | Confirm `MONGODB_URI` and `REDIS_URL` are set on the backend service and point to Railway services. |
| Browser CORS error | Confirm backend `CLIENT_URL` exactly matches the frontend Railway origin with no trailing slash. Redeploy backend after changing it. |
| Frontend calls its own `/api` path | Confirm frontend `VITE_API_BASE_URL` is set to `https://<backend-service>.up.railway.app/api`, then rebuild/redeploy frontend. |
| Login works but refresh/logout behaves inconsistently | Review the cookie/auth notes. Separate Railway hostnames plus `sameSite=strict` can affect cookie-backed flows. |
| Seed scripts affect the wrong database | Stop immediately and verify exported `MONGODB_URI`. Use preview-only Railway MongoDB. |
| Vite preview is unreachable | Confirm frontend start command uses `--host 0.0.0.0 --port $PORT`. |
| API docs show a default production URL | Confirm backend `API_URL` is set to the Railway backend URL. |

## 14. Shutdown/Delete Instructions

To avoid ongoing Railway charges after the temporary preview:

1. Export any non-sensitive screenshots or notes needed for the demo record.
2. Do not export or reuse preview database contents as production data.
3. In Railway, stop or delete the frontend service.
4. Stop or delete the backend service.
5. Delete the Redis service.
6. Delete the MongoDB service.
7. Delete the Railway project if the preview is no longer needed.
8. Confirm the project no longer shows active services or usage.

If keeping the project for later, remove public domains from backend/frontend services and stop the services.

