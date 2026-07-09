# Phase 7F — Reports UI

Date: 2026-07-04

## Objective

Build a frontend Reports workspace using only the five tested JSON report endpoints from Phase 7E. PDF, Excel, CSV, downloads, async jobs, email delivery, and standalone export workflows remain out of scope.

## Architecture

The Reports UI follows the existing frontend architecture:

- API calls are isolated in `frontend/src/api/reportApi.ts`.
- Server state is handled by TanStack Query.
- Report calls are user-triggered and do not run automatically on page load.
- Reference-data APIs populate available filter selects.
- Existing common states are reused for loading, error, and empty results.

`reportApi.ts` always sends `format=json`, strips empty filters, and normalizes the backend envelope into:

```ts
{
  rows,
  summary,
  filters,
  generatedAt
}
```

## UI Implemented

Created protected route:

- `/reports`

Added sidebar navigation:

- Reports

Created report tabs:

- Transformer Report
- Inspection Report
- Fault Report
- Maintenance Report
- Asset Register

Each tab includes:

- Report description
- Filter panel
- Generate report button
- Refresh action after generation
- Summary cards
- Applied filter ledger
- Results table
- Loading state
- Error state
- Empty state

## APIs Consumed

Reports:

- `GET /api/reports/transformers?format=json`
- `GET /api/reports/inspections?format=json`
- `GET /api/reports/faults?format=json`
- `GET /api/reports/maintenance?format=json`
- `GET /api/reports/asset-register?format=json`

Reference data for filter select options:

- `GET /api/territories`
- `GET /api/service-areas`
- `GET /api/feeders`
- `GET /api/districts`
- `GET /api/ratings`

No `/api/export/*` calls are made.

## Filters

Common filters:

- `startDate`
- `endDate`
- `territory_id`
- `service_area_id`
- `feeder_id`
- `district_id`
- `network_voltage_kv`
- `kva_rating`
- `operational_status`

Inspection-specific:

- `transformer_id`
- `condition`

Fault-specific:

- `fault_status`
- `severity`
- `fault_type`

Maintenance-specific:

- `maintenance_type`

## Validation

The UI validates date range locally before calling the API. If `endDate` is earlier than `startDate`, the page shows a clean inline validation message and does not submit the report request.

API failures are displayed through the existing friendly `ErrorState`, which uses sanitized API error messages.

## Manual Validation

Validated in the browser at `http://127.0.0.1:5176/reports`:

- Login/session was active.
- Sidebar shows Reports.
- `/reports` loads.
- All five tabs render.
- Transformer report generated and displayed rows.
- Inspection report generated.
- Fault report generated.
- Maintenance report generated and showed a friendly empty state for the local DB.
- Asset Register generated.
- Invalid date range displayed `End date must be after the start date.`
- Performance entries showed only `/api/reports/*?format=json` calls.
- No `/api/export/*` calls were made.

## Verification

Frontend:

```bash
cd frontend
npm run build
npm run dev
```

Build passed. Dev server started on `http://127.0.0.1:5176/` because ports 5173-5175 were already in use.

Backend verification is recorded in the final Phase 7F response.

## Risks

- Reports return full result sets; large production datasets may need pagination or async report jobs later.
- Maintenance report can legitimately show empty results depending on local data.
- Transformer-specific inspection filtering uses a raw transformer ID field to avoid calling unsupported lookup endpoints from this sprint.
- Export/download/report delivery UI remains intentionally absent until backend export workflows are tested.

## Rollback

Remove the Reports UI files and route/nav wiring:

- `frontend/src/api/reportApi.ts`
- `frontend/src/api/reportApi.contract.ts`
- `frontend/src/pages/reports/ReportsPage.tsx`
- Reports route in `frontend/src/routes/AppRoutes.tsx`
- Reports nav/title in `frontend/src/layouts/AppLayout.tsx`
- Report CSS in `frontend/src/styles/app.css`
- DataTable callback typing change in `frontend/src/components/tables/DataTable.tsx`

Then remove this report and the Phase 7F changelog entry.
