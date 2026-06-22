# kVAssetTracker — Local Development Onboarding

## What This Repo Is

Backend-only Express.js 5 API for **kVAssetTracker**, a transformer asset management platform for UEDCL (Uganda Electricity Distribution Company Ltd). This repo has no frontend.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 5 |
| Database | MongoDB 7 (installed via Homebrew) |
| Cache | Redis 8 (installed via Homebrew) |
| File Storage | MinIO — optional for dev (file upload features degrade gracefully) |
| Auth | JWT + bcryptjs |
| WebSocket | Socket.io 4 |
| Docs | Swagger UI at `/api-docs` |
| Queue | Bull (Redis-backed) |

## Prerequisites

These must be installed before the setup commands below:

| Tool | Status | Install command |
|------|--------|----------------|
| Node.js 18+ | Already installed (v20.20.0) | — |
| npm 11+ | Already installed (v11.11.0) | — |
| Homebrew | Already installed | — |
| MongoDB 7 | Installed via brew | `brew tap mongodb/brew && brew trust mongodb/brew && brew install mongodb-community@7.0` |
| Redis | Installed via brew | `brew install redis` |
| MinIO | Optional | `brew install minio/stable/minio` (skip for initial dev) |

## First-Time Setup

Run these commands once after cloning:

```bash
# 1. Install npm dependencies
npm install

# 2. Create .env from example
cp .env.example .env
# Then edit .env — critical values needed:
#   MONGODB_URI=mongodb://localhost:27017/kVAssetTracker
#   REDIS_URL=redis://localhost:6379
#   REDIS_PASSWORD=              (leave empty for local Redis)
#   JWT_SECRET=any-long-string-at-least-32-chars

# 3. Start background services
brew services start mongodb/brew/mongodb-community@7.0
brew services start redis

# 4. Set up database (run in order)
npm run migrate:list      # See available migrations
npm run migrate run 1.0.0_to_1.1.0
npm run migrate run 1.1.0_to_1.2.0
npm run migrate run 1.2.0_to_1.3.0
npm run migrate run 1.3.0_to_2.0.0
npm run migrate run 2.0.0_to_2.1.0
npm run create-indexes:repair
npm run seed
```

After seed, note the admin credentials printed:
- **Email:** (check seed output or `admin@kVAssetTracker.com`)
- **Password:** `Admin@1234`

## Running the Server

```bash
# Start (foreground — logs to terminal)
npm start

# The dev script (npm run dev) requires nodemon which is NOT in devDependencies.
# Install it first if you want auto-reload:
#   npm install --save-dev nodemon
# Then: npm run dev
```

## Environment Variables (`.env`)

Key variables — full list in `.env.example`:

| Variable | Dev value |
|----------|-----------|
| `NODE_ENV` | `development` |
| `PORT` | `3000` |
| `MONGODB_URI` | `mongodb://localhost:27017/kVAssetTracker` |
| `REDIS_URL` | `redis://localhost:6379` |
| `REDIS_PASSWORD` | *(empty for local)* |
| `JWT_SECRET` | any string ≥32 chars |
| `MINIO_ENDPOINT` | `localhost` |
| `MINIO_ACCESS_KEY` | `minioadmin` |
| `MINIO_SECRET_KEY` | `minioadmin` |

**`.env` is gitignored.** Never commit it.

## Browser Preview URLs

Once `npm start` is running:

| URL | Description |
|-----|-------------|
| `http://localhost:3000/health` | JSON health check (DB + Redis + WebSocket status) |
| `http://localhost:3000/api` | JSON list of all API endpoints |
| `http://localhost:3000/api-docs/` | Swagger UI (interactive API docs) |
| `http://localhost:3000/api/auth/login` | Auth endpoint (POST) |

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm start` | Start with `node src/app.js` |
| `npm run dev` | Start with `nodemon` (requires nodemon installed) |
| `npm run seed` | Seed dev data (territories, users, transformers) |
| `npm run migrate:status` | Show current DB schema version |
| `npm run migrate:list` | List all available migrations |
| `npm run migrate run <name>` | Apply one migration |
| `npm run create-indexes` | Create all MongoDB indexes |
| `npm run create-indexes:validate` | Validate index state |
| `npm run create-indexes:repair` | Create any missing indexes |
| `npm test` | Run Jest tests (src/tests/) |

## Services Management

```bash
# Check what's running
brew services list | grep -E "mongo|redis"

# Start services
brew services start mongodb/brew/mongodb-community@7.0
brew services start redis

# Stop services
brew services stop mongodb/brew/mongodb-community@7.0
brew services stop redis

# Check MongoDB directly
mongosh --eval "db.runCommand({ ping: 1 })" --quiet

# Check Redis directly
redis-cli ping
```

## Docker (not used for local dev)

A `docker-compose.yml` exists but Docker is not installed. The Homebrew approach above replaces it.

If you install Docker Desktop later and prefer containers:
```bash
# Start only services (not the API)
docker compose up -d mongodb redis minio
# Then run the API locally: npm start
```

**Known docker-compose bugs:**
- References `./scripts/mongodb/init.js` which doesn't exist (safe to ignore)
- Uses `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` env vars but `.env.example` uses `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` — mismatch, needs fixing if you use Docker

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| `npm run dev` requires `nodemon` not listed in devDependencies | Minor | Run `npm install --save-dev nodemon` to fix |
| MinIO not running locally | Minor | File upload endpoints return errors; server starts fine without it |
| 12 controllers are stub implementations (return 501) | Expected | These need to be implemented: `user`, `admin`, `analytics`, `audit`, `district`, `export`, `feeder`, `geo`, `qr`, `rating`, `serviceArea`, `territory` |
| 5 validators are minimal stubs | Expected | `feederValidator`, `serviceAreaValidator`, `territoryValidator`, `reportValidator`, `exportValidator` |
| `reportService` is a stub | Expected | All report endpoints return errors |
| `npm test` — all 6 tests fail | Known bug in repo | Tests use `request(app)` but `app` exports an `App` class instance, not an Express app. Fix: change `request(app)` to `request(app.getApp())` in `src/tests/auth.test.js` |
| Duplicate Mongoose schema index warnings at startup | Cosmetic | Not errors; caused by models declaring same index twice |
| Mongoose `returnDocument` deprecation warnings | Cosmetic | Scripts use deprecated `{ new: true }` option |

## Incomplete Backend Areas

The following controllers need full implementation before the API is production-ready:

- `userController` — user CRUD, role management
- `adminController` — admin operations
- `territoryController` — territory CRUD
- `serviceAreaController` — service area CRUD
- `feederController` — feeder CRUD
- `districtController` — district CRUD
- `ratingController` — transformer ratings CRUD
- `analyticsController` — analytics endpoints
- `exportController` — data export
- `auditController` — audit log viewing
- `qrController` — QR code generation/scanning
- `geoController` — geospatial queries
- `reportService` — report generation (missing service entirely)

Controllers that exist with partial implementation:
- `transformerController` — create/read/update/delete/stats work; `getByServiceArea`, `getNearby`, `search`, `getTimeline`, `getQRCode`, `decommission`, `bulkCreate` return 501
- `inspectionController` — partial (getAll, getOverdue, getLatest, update return 501)
- `faultController` — partial (getAll, getById, close, escalate, delete return 501)

## What Needs to Be Built (Frontend)

This is API-only. The expected client app:
- **Framework:** React/Vue/Next.js (implied by `CLIENT_URL=http://localhost:5173`, Vite default)
- **Auth:** Call `POST /api/auth/login` with `{ email, password }` to get JWT
- **API base:** `http://localhost:3000/api`
- **Docs:** `http://localhost:3000/api-docs/`

## Recommended Next Steps

1. Open `http://localhost:3000/api-docs/` to explore the full API interactively
2. Use the seeded admin credentials to test auth: `POST /api/auth/login` with `{ "email": "admin@kVAssetTracker.com", "password": "Admin@1234" }`
3. Fix the 12 stub controllers — start with `userController` and `territoryController`
4. Fix the test suite: change `request(app)` → `request(app.getApp())` in `src/tests/auth.test.js`
5. Add `nodemon` to devDependencies: `npm install --save-dev nodemon`
6. Start building the frontend client at a separate repo
