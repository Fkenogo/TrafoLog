# Phase 6A Reference Data Management

**Date:** 2026-07-03  
**Scope:** Frontend management screens for Territories, Service Areas, Feeders, Districts, and Transformer Ratings.

## Architecture

Phase 6A keeps the frontend architecture from Phase 5:

- Route-level page composition in `frontend/src/pages/reference-data/ReferenceDataPage.tsx`.
- Reference API access isolated in `frontend/src/api/referenceDataApi.ts`.
- TanStack Query owns server state, refresh, mutation invalidation, and loading/error state.
- React Hook Form and Zod own form state and validation.
- Existing table, loading, empty, error, toast, and CSS patterns are reused.

No new dependencies were added.

## Implementation

The previous reference-data overview was replaced with a tabbed management workspace:

- Territories
- Service Areas
- Feeders
- Districts
- Ratings

Each tab includes search, contextual filters, a table, refresh, loading state, error state, empty state, and friendly labels.

Supported write flows:

- Territories: create, edit, delete
- Service Areas: create, edit, delete
- Feeders: create, edit, delete
- Ratings: create, edit, delete

Districts remain read-only because the backend only exposes read endpoints.

Delete actions use a guarded confirmation panel warning that deleting reference data can affect linked transformers. Backend delete failures are surfaced through the existing friendly API error helper; the UI does not fake success.

## API Usage

Territories:

- `GET /api/territories`
- `GET /api/territories/:id`
- `POST /api/territories`
- `PUT /api/territories/:id`
- `DELETE /api/territories/:id`

Service Areas:

- `GET /api/service-areas`
- `GET /api/service-areas/:id`
- `GET /api/service-areas/territory/:territoryId`
- `POST /api/service-areas`
- `PUT /api/service-areas/:id`
- `DELETE /api/service-areas/:id`

Feeders:

- `GET /api/feeders`
- `GET /api/feeders/:id`
- `GET /api/feeders/service-area/:serviceAreaId`
- `POST /api/feeders`
- `PUT /api/feeders/:id`
- `DELETE /api/feeders/:id`

Districts:

- `GET /api/districts`
- `GET /api/districts/:id`
- `GET /api/districts/region/:region`

Ratings:

- `GET /api/ratings`
- `GET /api/ratings/network/:networkVoltage`
- `POST /api/ratings`
- `PUT /api/ratings/:id`
- `DELETE /api/ratings/:id`

## Validation

Validation uses React Hook Form and Zod:

- Territory name is required.
- Territory code is required and submitted uppercase.
- Service Area name is required.
- Service Area requires a Territory.
- Feeder name is required.
- Feeder requires a Service Area.
- Feeder network voltage must be 11 kV or 33 kV.
- Rating requires a kVA value.
- Rating network voltage must be 11 kV or 33 kV.

The forms intentionally omit unsupported fields such as service-area town, territory description, and rating display label because the current backend validators do not accept them.

## Query Invalidation

After create, update, and delete, the UI invalidates:

- `reference-data`
- `transformers`
- `dashboard`

This refreshes the reference management screen and causes transformer registry/detail/form consumers to pick up changed reference options.

## Verification

Commands run:

```bash
cd frontend
npm run build
npm run dev
cd ..
npm start
node --input-type=module -e '<reference CRUD smoke>'
node --input-type=module -e '<filtered reference endpoint smoke>'
npm test
git status --short
```

Frontend build result:

- `npm run build` passed.

Backend test result:

- `npm test` passed: 5 suites, 91 tests.

Live API smoke result:

- Login succeeded.
- Territory create, update, and delete succeeded.
- Service Area create, update, and delete succeeded.
- Feeder create, update, and delete succeeded.
- District list and district-by-region reads succeeded.
- Rating list and rating-by-network reads succeeded.

Rating create smoke note:

- The local database already contains all allowed kVA/network-voltage combinations. Because `TransformerRating` has a unique compound index on `{ kva, network_voltage_kv }`, the smoke script could not safely create a new non-duplicate rating without deleting seeded data first. The frontend create/edit/delete flow is implemented against the ready endpoints, but safe live rating-create validation is blocked by seed-data saturation.

## Known Issues And Risks

- Backend reference deletes are hard deletes. The UI warns operators, but the backend does not currently enforce linked-transformer protection for every reference type.
- Ratings have a finite enum-backed value space. In a fully seeded environment, creating an additional rating can fail as a duplicate even though the endpoint is available.
- District route writes are intentionally not implemented in the frontend because no backend write endpoints are documented.
- Frontend has no test script or test runner configured. Adding one would require new dev dependencies, so Phase 6A verification uses TypeScript build, backend tests, and live API smoke.

## Future Recommendations

- Add backend referential integrity checks before hard-deleting reference data linked to transformers.
- Consider soft-disable support for reference data before production.
- Add a frontend test runner so management form validation and payload mapping can have automated red/green coverage.
- Add pagination parameters or “load all” conventions to reference endpoints if reference lists grow beyond MVP sizes.

