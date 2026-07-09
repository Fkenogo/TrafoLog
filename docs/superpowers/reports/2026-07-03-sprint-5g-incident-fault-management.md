# Sprint 5G Incident & Fault Management

**Date:** 2026-07-03  
**Scope:** Incident and fault management workflow, transformer fault integration, inspection-to-fault integration, and inspection form wizard UX.

## Architecture

Sprint 5G continues the frontend architecture established in Sprints 5A-5F:

- React route pages own view composition.
- API calls stay inside API modules.
- TanStack Query owns server state, mutation invalidation, loading, error, and refresh behavior.
- React Hook Form and Zod own user input validation.
- Shared common components continue to provide loading, empty, error, toast, and table behavior.
- Existing CSS patterns were extended rather than redesigning the application.

The fault module now uses `frontend/src/api/faultApi.ts` for all create, update, assign, resolve, close, detail, list, stats, open, and transformer-specific calls.

## Implementation

### Fault Queue

Replaced the placeholder fault page with an operational queue including:

- Search
- Pagination
- Sorting
- Status filter
- Severity filter
- Territory filter
- Service Area filter
- Assigned Engineer filter
- Date range filters
- Refresh action
- Loading, empty, and error states
- View and edit actions per row

Columns include fault ID, transformer, asset ID, site, territory, fault type, severity, status, reported date, assigned engineer, last updated, view, and edit.

### Fault Detail

Added `/faults/:id` with a professional operational detail page:

- Header summary with fault ID, severity, status, transformer, site, and reported date
- Edit, assign, start work, resolve, and close actions
- Overview tab
- Transformer tab with link back to the transformer detail page
- Incident timeline tab
- Resolution tab
- Related inspection tab with link to inspection detail when available

Backend values are preserved, while the UI presents operator-friendly status labels. `Open` is displayed as `Reported`, and `Resolved` is displayed as `Awaiting Verification` until close.

### Create And Edit Fault

Added:

- `/faults/new`
- `/faults/:id/edit`

Faults can be launched from:

- Fault queue
- Dashboard quick action
- Transformer detail
- Inspection detail

Transformer launches preselect the transformer. Inspection launches prepopulate transformer, inspection, inspection date, inspector context where available, condition, and recommended-action context.

Edit mode supports mutable fault fields and keeps immutable incident fields locked.

### Incident Lifecycle

Implemented the lifecycle:

```text
Reported -> Assigned -> In Progress -> Awaiting Verification -> Closed
```

This maps to existing backend statuses:

```text
Open -> Assigned -> In Progress -> Resolved -> Closed
```

The UI only exposes the next valid action from the current status:

- `Open`: Assign
- `Assigned`: Start Work
- `In Progress`: Resolve
- `Resolved`: Close
- `Closed`: No further transition

Resolution requires a repair note before submission.

### Transformer Integration

Transformer detail now has a richer fault view:

- Header-level Report Fault button
- Fault tab Report Fault action
- Open fault count
- Fault history count
- Latest fault summary
- Severity badges
- Status badges
- Fault history with View/Edit actions

### Inspection Integration

Inspection detail now includes a Create Fault action. The fault form receives transformer and inspection context through route query parameters and prepopulates the available operational context.

### Inspection Wizard Enhancement

The inspection form was converted from a long form into a six-step guided workflow:

1. Inspection Information
2. Transformer Verification
3. Physical Inspection
4. Electrical Inspection
5. Safety & Environment
6. Assessment & Review

The backend payload builder was preserved, and no inspection API or schema changes were made for the wizard UX.

## API Usage

Fault APIs:

- `GET /api/faults`
- `GET /api/faults/:id`
- `POST /api/faults`
- `PUT /api/faults/:id`
- `PUT /api/faults/:id/assign`
- `PUT /api/faults/:id/resolve`
- `PUT /api/faults/:id/close`
- `PUT /api/faults/:id/escalate`
- `GET /api/faults/open`
- `GET /api/faults/transformer/:transformerId`
- `GET /api/faults/stats`

Supporting APIs:

- `GET /api/transformers`
- `GET /api/transformers/:id`
- `GET /api/inspections/:id`
- `GET /api/inspections/transformer/:transformerId`
- `GET /api/inspections/transformer/:transformerId/latest`
- `GET /api/territories`
- `GET /api/service-areas`

## Validation

Fault form validation uses React Hook Form and Zod:

- Transformer is required.
- Fault date is required.
- Fault source must be one of the supported sources.
- Fault type must be one of the supported types.
- Severity must be one of the supported severities.
- Description requires at least 10 characters.
- Customers affected must be 0 or greater.
- Date range filters validate through native date inputs.
- Resolution requires a repair note before resolving.

The inspection wizard continues to use the Sprint 5F Zod schema and backend-compatible payload mapping.

## Query Invalidation

Fault create, update, assignment, lifecycle, resolve, and close actions invalidate:

- Fault queue
- Fault detail
- Open faults
- Fault stats
- Transformer detail
- Transformer lists and stats
- Inspection detail and history
- Overdue inspections
- Dashboard widgets
- Maintenance-related widgets

Invalidation follows existing TanStack Query patterns and preserves local route navigation.

## Verification

Commands run:

```bash
cd frontend
npm run build
npm run dev
cd ..
npm start
npx jest --testPathPatterns=src/tests/fault --forceExit
npm test
git status --short
```

Build result:

- `npm run build` passed.

Backend test result:

- `npm test` passed: 5 suites, 91 tests.

API smoke result:

- Login succeeded.
- Created a fault from seeded transformer and inspection context.
- Loaded fault detail.
- Updated editable fields.
- Assigned the fault.
- Started work.
- Resolved the fault.
- Closed the fault.
- Confirmed list, transformer fault history, and open-fault count responses.

## Known Issues

- The original backend exposed `updateFaultSchema` and `FaultService.update`, but did not route `PUT /api/faults/:id`. Sprint 5G wires that existing backend path to support the required edit workflow.
- Fault-to-inspection traceability required an optional `inspection_id` field on faults. This is a minimal schema addition made to preserve the requested Related Inspection workflow.
- Backend status values differ from the sprint wording. The frontend uses display labels to present the requested workflow without changing persisted backend status enums.
- Backend does not currently persist a dedicated `priority` field. The UI avoids pretending it can save unavailable priority state.
- Backend escalation and close services write some audit fields that are not currently modeled, so those fields are not relied on for UI display.
- Photo upload remains a placeholder only, as requested.

## Future Recommendations

- Add first-class backend `priority`, `outage_duration`, and structured downtime fields if outage reporting becomes part of the production contract.
- Add a backend-supported fault timeline event collection instead of deriving timeline state from current fault fields.
- Normalize backend statuses to match operational workflow labels, or publish a frontend/backend status translation contract.
- Add E2E coverage for inspection-to-fault and transformer-to-fault launch flows.

