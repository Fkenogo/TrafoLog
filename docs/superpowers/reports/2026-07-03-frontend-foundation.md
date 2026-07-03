# Frontend Foundation Report

Date: 2026-07-03

## Architecture Overview

Phase 4 adds a standalone Vite + React TypeScript frontend under `frontend/`. The backend remains the source of truth and is not duplicated in frontend logic. API access is centralized in reusable modules under `frontend/src/api`, session state is centralized in `AuthContext`, and routes are protected through React Router.

The app uses the browser-oriented auth contract: login returns an access token and sets HTTP-only cookies; refresh uses the HTTP-only refresh cookie through Axios `withCredentials`.

## Folder Structure

```text
frontend/src/
  api/
  components/
    common/
    layout/
    forms/
    tables/
  contexts/
  hooks/
  layouts/
  pages/
    auth/
    dashboard/
    transformers/
    inspections/
    faults/
    maintenance/
    reference-data/
    settings/
  routes/
  services/
  styles/
  types/
  utils/
```

## Routing Map

| Route | Status |
|---|---|
| `/login` | Login page |
| `/dashboard` | Protected live dashboard |
| `/transformers` | Protected read-only transformer list |
| `/transformers/:id` | Protected read-only transformer detail |
| `/inspections` | Protected read-only inspections list |
| `/faults` | Protected read-only faults list |
| `/maintenance` | Protected read-only maintenance list |
| `/reference-data` | Protected read-only reference data overview |
| `/settings` | Protected placeholder |

Stubbed backend modules are not exposed: users, admin, analytics, export, audit, geo, and `/api/qr`.

## Authentication Flow

1. On app boot, `AuthProvider` checks for a stored access token.
2. If absent, it calls `POST /api/auth/refresh` with credentials so the backend can use the HTTP-only `refreshToken` cookie.
3. After an access token is available, it loads the current user with `GET /api/auth/me`.
4. Axios adds `Authorization: Bearer <accessToken>` to authenticated requests.
5. A 401 response from non-auth endpoints attempts one refresh and retries the original request.
6. Refresh failure clears local session state and redirects to `/login`.
7. Logout calls `POST /api/auth/logout`, clears local access token state, and returns to `/login`.

## API Layer Design

API calls live only in `frontend/src/api`:

- `authApi.ts`
- `transformerApi.ts`
- `inspectionApi.ts`
- `faultApi.ts`
- `maintenanceApi.ts`
- `referenceDataApi.ts`
- `http.ts`

Pages consume these modules through TanStack Query. Pages do not import Axios.

## State Management Approach

- Auth/session state: React Context API.
- Server cache and loading/error states: TanStack Query.
- Login form state and validation: React Hook Form + Zod.
- Access token storage: localStorage for access token only.
- Refresh token handling: HTTP-only cookie only for browser flows.

## Backend Endpoints Consumed

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/transformers`
- `GET /api/transformers/stats`
- `GET /api/transformers/:id`
- `GET /api/inspections`
- `GET /api/inspections/overdue`
- `GET /api/faults`
- `GET /api/faults/open`
- `GET /api/faults/stats`
- `GET /api/maintenance`
- `GET /api/maintenance/stats`
- `GET /api/maintenance/upcoming`
- `GET /api/territories`
- `GET /api/service-areas`
- `GET /api/feeders`
- `GET /api/districts`
- `GET /api/ratings`

## Known Gaps

- No CRUD forms yet.
- No role-aware action gating beyond protected routes.
- No field-level filtering UI yet.
- No pagination controls yet; list pages request the first page only.
- No browser automation screenshot pass was added in this phase.

## Verification

Backend auth contract:

```text
npm test
Test Suites: 5 passed, 5 total
Tests:       90 passed, 90 total
```

Frontend:

```text
cd frontend
npm install
npm run build
```

Build output:

```text
vite v6.4.3 building for production...
✓ 1722 modules transformed.
✓ built in 3.21s
```

Dev server:

```text
npm run dev
Local: http://127.0.0.1:5173/
```

Proxy smoke check:

```text
curl http://127.0.0.1:5173/api
```

Returned the backend API root response.

## Recommendations for Phase 5

- Add pagination, filtering, and search controls for transformer, fault, inspection, and maintenance lists.
- Add role-aware route metadata and UI affordances before CRUD actions.
- Add dashboard-specific aggregate endpoints only if existing list/stats endpoints become too expensive.
- Add Playwright smoke tests for login, protected redirect, dashboard load, and API error states.
- Decide whether access tokens should remain in localStorage or move to memory-only storage with cookie-backed reload.
