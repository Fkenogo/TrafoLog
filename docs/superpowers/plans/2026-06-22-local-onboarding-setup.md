# kVAssetTracker Local Onboarding & Setup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the kVAssetTracker backend running locally so it can be previewed at `http://localhost:3000` with `/health`, `/api`, and `/api-docs` endpoints live.

**Architecture:** Express.js 5 backend (Node 20) backed by MongoDB + Redis + MinIO. Services will run locally via Homebrew (no Docker installed). `.env` is created from `.env.example` with safe dev placeholders. Two `package.json` script path bugs are fixed before any commands are run.

**Tech Stack:** Node.js 20, Express 5, MongoDB 6 (via Homebrew), Redis 7 (via Homebrew), MinIO (via Homebrew or skipped), Mongoose, Socket.io, Swagger UI.

## Global Constraints

- Node.js v20.20.0 is installed — use it (no upgrade needed)
- npm v11.11.0 is installed
- Docker is NOT installed — do not use Docker; use Homebrew instead
- MongoDB is NOT installed — install via `brew install mongodb-community@6.0`
- Redis is NOT installed — install via `brew install redis`
- MinIO is NOT installed — install via `brew install minio/stable/minio` OR skip for initial setup (file upload features won't work but server will start)
- Homebrew 5.0.15 is installed at `/opt/homebrew/bin/brew`
- nodemon is NOT installed globally — `npm install` will provide it via `node_modules/.bin/nodemon`; use `npx nodemon` or fix `npm run dev`
- `.env` is MISSING — must be created before `npm start` or `npm run dev`
- `package.json` scripts reference wrong paths (`scripts/seed.js` instead of `src/scripts/seed.js`) — must be fixed

---

## Audit Findings (read before executing)

**Project type:** Backend-only. No frontend folder. No client/ or frontend/ directory.

**Framework:** Express.js 5.2.1

**Database:** MongoDB 6.0 (Mongoose 9.x)

**Cache:** Redis 7.2 (redis npm package v6)

**File storage:** MinIO (S3-compatible, self-hosted)

**App port:** 3000

**Available npm scripts (in package.json):**
- `npm start` → `node src/app.js`
- `npm run dev` → `nodemon src/app.js`
- `npm run seed` → `node scripts/seed.js` ⚠️ **BUG: should be `src/scripts/seed.js`**
- `npm run migrate` → `node scripts/migration.js` ⚠️ **BUG: should be `src/scripts/migration.js`**
- `npm run create-indexes` → `node scripts/createIndexes.js` ⚠️ **BUG: should be `src/scripts/createIndexes.js`**

**Test file:** `src/tests/auth.test.js` exists (Jest + supertest)

**Browser-viewable endpoints (already coded in app.js):**
- `GET /health` → JSON health status (DB + Redis + WebSocket status)
- `GET /api` → JSON with all endpoint list
- `GET /api-docs` → Swagger UI (swagger.yaml is already loaded)

**Key bugs found:**
1. `package.json` script paths are wrong — all scripts use `scripts/` instead of `src/scripts/`
2. `docker-compose.yml` references `./scripts/mongodb/init.js` (doesn't exist) — not relevant since we're using Homebrew
3. `docker-compose.yml` uses `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` env vars but `.env.example` uses `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` — not relevant since we're not using Docker compose

---

## Task 1: Fix package.json script paths

**Files:**
- Modify: `package.json` (lines 8-16, the `scripts` block)

**Why:** `npm run seed`, `npm run migrate`, and `npm run create-indexes` all point to `scripts/` but the actual files live under `src/scripts/`. These will fail with "Cannot find module" until fixed.

- [ ] **Step 1: Open `package.json` and fix the scripts section**

Change the `scripts` block from:
```json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js",
  "seed": "node scripts/seed.js",
  "migrate": "node scripts/migration.js",
  "migrate:list": "node scripts/migration.js list",
  "migrate:status": "node scripts/migration.js status",
  "migrate:run": "node scripts/migration.js run",
  "create-indexes": "node scripts/createIndexes.js",
  "create-indexes:list": "node scripts/createIndexes.js list",
  "create-indexes:validate": "node scripts/createIndexes.js validate",
  "create-indexes:repair": "node scripts/createIndexes.js repair"
}
```

To:
```json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js",
  "seed": "node src/scripts/seed.js",
  "migrate": "node src/scripts/migration.js",
  "migrate:list": "node src/scripts/migration.js list",
  "migrate:status": "node src/scripts/migration.js status",
  "migrate:run": "node src/scripts/migration.js run",
  "create-indexes": "node src/scripts/createIndexes.js",
  "create-indexes:list": "node src/scripts/createIndexes.js list",
  "create-indexes:validate": "node src/scripts/createIndexes.js validate",
  "create-indexes:repair": "node src/scripts/createIndexes.js repair"
}
```

- [ ] **Step 2: Verify the fix**

Run:
```bash
cat package.json | grep '"seed"'
```
Expected output: `"seed": "node src/scripts/seed.js",`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "fix: correct script paths from scripts/ to src/scripts/"
```

---

## Task 2: Create the `.env` file

**Files:**
- Create: `.env` (at repo root, from `.env.example`)

**Why:** The app reads `process.env.*` via dotenv at startup. Without `.env`, MongoDB URI, Redis URL, JWT secret, and all other config will be undefined, causing startup failure.

- [ ] **Step 1: Create `.env` with safe dev values**

Create `/Users/theo/kvassetTracker_zoe/.env` with this content:
```env
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb://localhost:27017/kVAssetTracker
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=devpassword123

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=dev-jwt-secret-change-in-production-minimum-32-chars
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d

# MinIO (File Storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_PHOTOS=kVAssetTracker-photos
MINIO_BUCKET_REPORTS=kVAssetTracker-reports

# Email (SMTP) - disabled for dev
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=dev@example.com
SMTP_PASS=placeholder
SMTP_FROM=noreply@kVAssetTracker.com

# SMS (Twilio) - disabled for dev
TWILIO_ACCOUNT_SID=ACplaceholder
TWILIO_AUTH_TOKEN=placeholder
TWILIO_PHONE_NUMBER=+1234567890

# Mapbox
MAPBOX_TOKEN=pk.placeholder

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
```

- [ ] **Step 2: Verify `.env` was created**

Run:
```bash
head -5 .env
```
Expected:
```
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
```

- [ ] **Step 3: Verify `.env` is gitignored**

Run:
```bash
cat .gitignore | grep .env
```
Expected: `.env` (or similar pattern). If not in gitignore, add `.env` to `.gitignore` immediately.

---

## Task 3: Install npm dependencies

**Files:**
- Creates: `node_modules/` (no source files changed)

**Why:** `node_modules` is not installed. Running `npm start` or `npm run dev` will fail with "Cannot find module 'express'" without this step.

- [ ] **Step 1: Install dependencies**

Run (from repo root):
```bash
cd /Users/theo/kvassetTracker_zoe && npm install
```
Expected: output ending in `added N packages` with no WARN or ERR lines (some optional dep warnings about `puppeteer` are acceptable).

- [ ] **Step 2: Verify key packages installed**

Run:
```bash
ls node_modules | grep -E "^(express|mongoose|redis|socket.io|swagger-ui-express)$"
```
Expected:
```
express
mongoose
redis
socket.io
swagger-ui-express
```

- [ ] **Step 3: Verify nodemon is available via npx**

Run:
```bash
npx nodemon --version
```
Expected: a version number like `3.x.x`

---

## Task 4: Install MongoDB via Homebrew and start it

**Files:** No source files changed. System-level install.

**Why:** The app requires MongoDB at `mongodb://localhost:27017/kVAssetTracker`. Without it, `database.connect()` will throw and the server will exit immediately.

- [ ] **Step 1: Add the MongoDB Homebrew tap**

Run:
```bash
brew tap mongodb/brew
```
Expected: output ending in `Tapped N formulae.`

- [ ] **Step 2: Install MongoDB Community Edition 6.0**

Run:
```bash
brew install mongodb-community@6.0
```
Expected: output ending in `mongodb-community@6.0 installed successfully` (takes 1-3 minutes).

- [ ] **Step 3: Start MongoDB as a background service**

Run:
```bash
brew services start mongodb-community@6.0
```
Expected: `==> Successfully started mongodb-community@6.0 (label: homebrew.mxcl.mongodb-community@6.0)`

- [ ] **Step 4: Verify MongoDB is accepting connections**

Run:
```bash
mongosh --eval "db.runCommand({ ping: 1 })" --quiet
```
Expected: `{ ok: 1 }`

If `mongosh` is not found, run `brew install mongosh` first.

---

## Task 5: Install Redis via Homebrew and start it

**Files:** No source files changed. System-level install.

**Why:** The app requires Redis at `redis://localhost:6379`. Without it, `redis.connect()` will throw and the server will exit.

**Note:** The `.env` has `REDIS_PASSWORD=` (empty). The local Redis instance should run without a password to match.

- [ ] **Step 1: Install Redis**

Run:
```bash
brew install redis
```
Expected: `redis installed successfully`

- [ ] **Step 2: Start Redis as a background service**

Run:
```bash
brew services start redis
```
Expected: `==> Successfully started redis (label: homebrew.mxcl.redis)`

- [ ] **Step 3: Verify Redis is running**

Run:
```bash
redis-cli ping
```
Expected: `PONG`

---

## Task 6: Start the backend server

**Files:** No source files changed.

**Why:** With MongoDB and Redis running and `.env` in place, `npm start` should now work. `npm run dev` will also work since nodemon is available via node_modules.

- [ ] **Step 1: Start the server**

Run:
```bash
cd /Users/theo/kvassetTracker_zoe && npm start
```

Expected output (last few lines):
```
============================================================
🚀 kVAssetTracker Server
============================================================
📍 Environment: development
🌐 Server URL: http://localhost:3000
📚 API Docs: http://localhost:3000/api-docs
💚 Health Check: http://localhost:3000/health
🔌 WebSocket: ws://localhost:3000
============================================================
✅ Server is ready to accept connections
✅ Swagger documentation available at /api-docs
✅ WebSocket server initialized
✅ Overdue inspection checker started
✅ Overload detector started
```

**If startup fails because of MinIO:**
MinIO is optional for initial dev. If the storage config throws on startup, see Task 7 (make storage non-fatal).

**If startup fails because Redis requires a password:**
The redis client is configured with `REDIS_URL=redis://localhost:6379`. Homebrew Redis by default has no password. If it still fails, check `src/config/redis.js` — the error will be logged.

- [ ] **Step 2: In a new terminal, verify the health endpoint**

Run:
```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```
Expected JSON:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": ...,
  "services": {
    "database": "connected",
    "redis": "connected",
    "websocket": "running"
  }
}
```

- [ ] **Step 3: Verify the API root endpoint**

Run:
```bash
curl -s http://localhost:3000/api | python3 -m json.tool
```
Expected: JSON with `"message": "kVAssetTracker API v2.0"` and the full endpoints list.

- [ ] **Step 4: Verify Swagger UI is accessible**

Open in browser: `http://localhost:3000/api-docs`

Expected: Swagger UI page titled "kVAssetTracker API Documentation" with Auth, Transformers, Inspections, Faults tag groups.

---

## Task 7: Make MinIO optional (if server fails on MinIO)

**Files:**
- Read: `src/config/storage.js`
- Modify if needed: `src/config/storage.js`

**Why:** MinIO is not installed. If `src/config/storage.js` connects eagerly at startup and throws, the server will crash. Making storage optional (warn and continue) allows the server to start without MinIO while file upload features degrade gracefully.

- [ ] **Step 1: Check if storage.js connects at startup**

Run:
```bash
head -40 src/config/storage.js
```

If it contains `minioClient.connect()` or similar eager connection at module load time, wrap it in a try-catch and log a warning instead of throwing.

- [ ] **Step 2: Patch if needed**

If `src/config/storage.js` throws on startup, wrap the MinIO client initialization:

```javascript
let minioClient = null;
try {
  minioClient = new Minio.Client({ /* config */ });
  console.log('✅ MinIO client initialized');
} catch (err) {
  console.warn('⚠️  MinIO unavailable — file uploads disabled:', err.message);
}
module.exports = { minioClient };
```

- [ ] **Step 3: Restart server and verify it starts**

Stop the server (Ctrl+C) and re-run `npm start`. Confirm no crash.

---

## Task 8: Run database setup scripts

**Files:** No source files changed. Data setup only.

**Why:** The database is empty. Seed data provides test users, territories, and transformer records so the API returns real data during testing.

- [ ] **Step 1: Check migration status**

Run:
```bash
cd /Users/theo/kvassetTracker_zoe && npm run migrate:status
```
Expected: list of migrations and their status (pending / applied).

If this fails with "Cannot connect to MongoDB", ensure MongoDB is running: `brew services list | grep mongo`

- [ ] **Step 2: Run migrations**

Run:
```bash
npm run migrate:run
```
Expected: `✅ All migrations applied`

- [ ] **Step 3: Create database indexes**

Run:
```bash
npm run create-indexes:validate
```
Expected: `✅ All indexes valid` or similar.

- [ ] **Step 4: Run seed**

Run:
```bash
npm run seed
```
Expected: output listing created records (admin user, territories, sample transformers).

Note the admin credentials printed by the seed script — you will need them to log into the API.

---

## Task 9: Run tests

**Files:** No changes. Read-only verification.

**Why:** There is one test file at `src/tests/auth.test.js`. Running it confirms the auth flow works end-to-end.

- [ ] **Step 1: Run tests**

Run:
```bash
cd /Users/theo/kvassetTracker_zoe && npm test
```
Expected: Jest output with PASS/FAIL per test.

If tests fail because no test script is in package.json, note the error and skip this step (add `"test": "jest"` to package.json `scripts` first).

- [ ] **Step 2: Note test results**

Record which tests pass and which fail. Do not fix failing tests in this onboarding task — just document them.

---

## Task 10: Write local onboarding documentation

**Files:**
- Create: `docs/LOCAL_ONBOARDING.md`

**Why:** Future developers (and you in future sessions) need a single file that tells them exactly what to do to get this running locally.

- [ ] **Step 1: Create `docs/LOCAL_ONBOARDING.md`**

Create the file with the following content (filling in any results from earlier tasks):

```markdown
# kVAssetTracker — Local Development Onboarding

## What This Repo Is

Backend-only Express.js API for kVAssetTracker, a transformer asset management platform for UEDCL (Uganda Electricity Distribution Company Ltd). No frontend is included in this repo.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 5 |
| Database | MongoDB 6.0 |
| Cache | Redis 7.2 |
| File Storage | MinIO (optional for dev) |
| Auth | JWT + bcryptjs |
| WebSocket | Socket.io 4 |
| Docs | Swagger UI at /api-docs |

## Prerequisites

Install these before proceeding:

- Node.js 18+ (v20 confirmed working) — already installed
- npm 11+ — already installed
- Homebrew — already installed

Install via Homebrew:
\`\`\`bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew install redis
# MinIO (optional — needed only for file upload features)
brew install minio/stable/minio
\`\`\`

## Setup Commands (run once)

\`\`\`bash
# 1. Clone the repo (already done)
cd /path/to/kvassetTracker_zoe

# 2. Install npm dependencies
npm install

# 3. Copy and configure environment
cp .env.example .env
# Edit .env — safe dev defaults are already in .env.example

# 4. Start background services
brew services start mongodb-community@6.0
brew services start redis

# 5. Set up database
npm run migrate:run
npm run create-indexes
npm run seed
\`\`\`

## Running Locally

\`\`\`bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
\`\`\`

## Environment Variables (`.env`)

Key variables (see `.env.example` for full list):

| Variable | Dev value |
|----------|-----------|
| `NODE_ENV` | `development` |
| `PORT` | `3000` |
| `MONGODB_URI` | `mongodb://localhost:27017/kVAssetTracker` |
| `REDIS_URL` | `redis://localhost:6379` |
| `REDIS_PASSWORD` | *(empty for local)* |
| `JWT_SECRET` | any long string |
| `MINIO_ENDPOINT` | `localhost` |
| `MINIO_ACCESS_KEY` | `minioadmin` |
| `MINIO_SECRET_KEY` | `minioadmin` |

## Browser URLs

| URL | What You See |
|-----|-------------|
| `http://localhost:3000/health` | JSON health status |
| `http://localhost:3000/api` | JSON endpoint list |
| `http://localhost:3000/api-docs` | Swagger UI documentation |

## Docker (not recommended for dev)

A `docker-compose.yml` exists but Docker is not required. Use the Homebrew approach above. If you install Docker Desktop later:

\`\`\`bash
# Start only services (not the API — run API with npm start)
docker compose up -d mongodb redis minio
\`\`\`

Note: The compose file has a bug — it references `./scripts/mongodb/init.js` which doesn't exist. Remove that line or create the file if using Docker.

## Database Scripts

\`\`\`bash
npm run migrate:status          # Show migration state
npm run migrate:run             # Apply pending migrations
npm run migrate:list            # List all migrations
npm run create-indexes          # Create MongoDB indexes
npm run create-indexes:validate # Validate indexes
npm run seed                    # Seed dev data (users, territories, transformers)
\`\`\`

## Tests

\`\`\`bash
npm test   # Runs Jest (src/tests/auth.test.js)
\`\`\`

## Known Issues

1. **MinIO not running**: File upload endpoints will fail. The server still starts. Install MinIO via `brew install minio/stable/minio` to fix.
2. **No frontend**: This is API-only. Use Swagger UI at `/api-docs` or Postman to interact with the API.
3. **docker-compose MongoDB init**: `./scripts/mongodb/init.js` is referenced but missing. Not needed for Homebrew approach.
4. **SMTP/Twilio**: Email and SMS are disabled by default. Placeholder values in `.env` are sufficient to start the server; email/SMS calls will fail silently.

## What Needs to Be Built

- A frontend (React/Vue/Next.js) — the API is fully functional but has no browser UI
- The client app is expected to run at `http://localhost:5173` (Vite default)

## Recommended Next Steps

1. Open `http://localhost:3000/api-docs` to explore the full API
2. Use the seeded admin credentials to authenticate at `POST /api/auth/login`
3. Start building the frontend at a separate repo, pointing `VITE_API_URL=http://localhost:3000`
```

- [ ] **Step 2: Verify the file was created**

Run:
```bash
ls -la docs/LOCAL_ONBOARDING.md
```
Expected: file exists with non-zero size.

- [ ] **Step 3: Commit**

```bash
git add package.json .env docs/LOCAL_ONBOARDING.md
git commit -m "chore: onboarding setup — fix script paths, add .env, add LOCAL_ONBOARDING.md"
```

---

## Self-Review

**Spec coverage check:**

| Spec Step | Covered by Task |
|-----------|----------------|
| Inspect repo structure | Audit Findings section + Task audit |
| Confirm stack | Audit Findings |
| Install local tooling (node, npm, docker) | Task 3 (npm), Tasks 4+5 (MongoDB/Redis via brew) |
| Prepare `.env` | Task 2 |
| Prepare database services | Tasks 4+5 |
| Run `npm run dev` | Task 6 |
| Fix Docker Compose if broken | N/A (using Homebrew instead) |
| Run seeds/migrations | Task 8 |
| Verify browser URLs | Task 6 Steps 2-4 |
| Swagger/health page | Already in app.js — verified in Task 6 |
| Run `npm test` | Task 9 |
| Write `docs/LOCAL_ONBOARDING.md` | Task 10 |
| Final report | Provided after plan execution |

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency:** No shared types across tasks — each task is independent setup/config work.
