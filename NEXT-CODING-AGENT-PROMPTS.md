# Next Coding Agent Prompts

Use these prompts sequentially. Each prompt is intentionally small and focused.

## Prompt 1 — Lock Down Public Registration

### Context

kVAssetTracker is a custom Express/MongoDB + React/Vite implementation. The audit found a critical security issue: public `POST /api/auth/register` accepts privileged roles, including `Super Admin`.

### Exact Task

Fix public registration so unauthenticated users cannot create privileged or active operational accounts. Do not remove Super Admin user-management APIs. Super Admin-created users must still work through `/api/users`.

### Files to Inspect

- `src/routes/authRoutes.js`
- `src/validators/authValidator.js`
- `src/controllers/authController.js`
- `src/services/authService.js`
- `src/routes/userRoutes.js`
- `src/services/userService.js`
- `src/tests/auth.test.js`
- `src/tests/user.test.js`
- `swagger.yaml`
- `docs/API_FRONTEND_READINESS_MAP.md`

### Files Likely to Modify

- `src/validators/authValidator.js`
- `src/services/authService.js`
- `src/tests/auth.test.js`
- `src/tests/user.test.js`
- `swagger.yaml`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Backend security fix only.
- Do not add frontend features.
- Do not weaken existing login/session behavior.
- Do not expose password/token fields.
- Do not use public registration to seed Super Admin test users.

### Required Verification Commands

```bash
npx jest --testPathPatterns=src/tests/auth --forceExit
npx jest --testPathPatterns=src/tests/user --forceExit
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Exact security behavior before and after
3. Tests added/updated
4. Verification results
5. Swagger/readiness-map changes
6. Risks
7. Rollback instructions

## Prompt 2 — Centralize Role and Territory Data Scoping

### Context

The audit found that many authenticated read endpoints do not consistently enforce territory/service-area scoping. The original PRD requires RBAC everywhere and Territory Managers must see only their own territory.

### Exact Task

Create and apply centralized backend data-scope helpers so transformer-related reads are limited by role and assigned territory/service area.

### Files to Inspect

- `src/middleware/auth.js`
- `src/middleware/rbac.js`
- `src/routes/transformerRoutes.js`
- `src/controllers/transformerController.js`
- `src/services/transformerService.js`
- `src/routes/inspectionRoutes.js`
- `src/services/inspectionService.js`
- `src/routes/faultRoutes.js`
- `src/services/faultService.js`
- `src/routes/maintenanceRoutes.js`
- `src/services/maintenanceService.js`
- `src/controllers/dashboardController.js`
- `src/services/dashboardService.js`
- `src/services/reportingService.js`
- `src/services/exportService.js`
- `src/services/syncService.js`
- `src/tests`

### Files Likely to Modify

- A new helper such as `src/utils/accessScope.js` or existing RBAC middleware
- Relevant services/controllers listed above
- Backend tests
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Do not redesign roles without founder approval.
- Keep backend authorization authoritative.
- Do not rely only on frontend hiding.
- Preserve Super Admin global access.
- Preserve Viewer access only as explicitly intended.

### Required Verification Commands

```bash
npx jest --testPathPatterns=src/tests/transformer --forceExit
npx jest --testPathPatterns=src/tests/inspection --forceExit
npx jest --testPathPatterns=src/tests/fault --forceExit
npx jest --testPathPatterns=src/tests/report --forceExit
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Scope rules implemented per role
3. Endpoints covered
4. Tests added/updated
5. Remaining unscoped endpoints, if any
6. Verification results
7. Risks
8. Rollback instructions

## Prompt 3 — Add Frontend Role-Aware Route Guards

### Context

The frontend `ProtectedRoute` currently checks authentication only. The original product guide requires role-aware route access and access-denied handling.

### Exact Task

Add role-aware frontend route protection for `/admin` and other role-specific routes. Keep backend RBAC as the source of truth.

### Files to Inspect

- `frontend/src/routes/ProtectedRoute.tsx`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/types/api.ts`
- `frontend/src/components/common`

### Files Likely to Modify

- `frontend/src/routes/ProtectedRoute.tsx`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- New `frontend/src/components/common/AccessDenied.tsx` if needed
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Frontend only.
- Do not change backend APIs.
- Do not expose not-ready admin routes.
- Do not add dependencies.

### Required Verification Commands

```bash
cd frontend
npm run build
cd ..
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Routes protected
3. Role behavior
4. Build result
5. Backend test result
6. Risks
7. Rollback instructions

## Prompt 4 — Enforce Feeder and Transformer Network Voltage Consistency

### Context

The PRD says 11kV and 33kV assets must never be mixed, and feeder voltage must match transformer voltage.

### Exact Task

Validate that selected feeder `network_voltage_kv` matches transformer `network_voltage_kv` on create and update. Add user-friendly frontend validation or warning.

### Files to Inspect

- `src/models/Feeder.js`
- `src/models/Transformer.js`
- `src/validators/transformerValidator.js`
- `src/services/transformerService.js`
- `src/tests/transformer.test.js`
- `frontend/src/pages/transformers/TransformerFormPage.tsx`
- `frontend/src/api/referenceDataApi.ts`

### Files Likely to Modify

- `src/validators/transformerValidator.js`
- `src/services/transformerService.js`
- `src/tests/transformer.test.js`
- `frontend/src/pages/transformers/TransformerFormPage.tsx`
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Do not change transformer data model unless required.
- Do not add backend endpoints.
- Preserve current reference data APIs.

### Required Verification Commands

```bash
npx jest --testPathPatterns=src/tests/transformer --forceExit
cd frontend
npm run build
cd ..
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Validation behavior
3. Tests added/updated
4. Build/test results
5. Risks
6. Rollback instructions

## Prompt 5 — Complete Maintenance Frontend Workflow

### Context

Maintenance backend routes exist, but the frontend Maintenance page is a read-only table. The original PRD requires maintenance logging as a core field workflow.

### Exact Task

Build maintenance create, detail, and edit UI using existing backend endpoints and current frontend architecture.

### Files to Inspect

- `frontend/src/pages/maintenance/MaintenancePage.tsx`
- `frontend/src/api/maintenanceApi.ts`
- `frontend/src/types/api.ts`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- `src/routes/maintenanceRoutes.js`
- `src/validators/maintenanceValidator.js`

### Files Likely to Modify

- `frontend/src/pages/maintenance/*`
- `frontend/src/api/maintenanceApi.ts`
- `frontend/src/types/api.ts`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Frontend-focused.
- Do not change backend unless a tiny blocker is found.
- Use React Hook Form, Zod, TanStack Query, existing Loading/Error/Empty components.
- Do not implement offline behavior in this prompt.

### Required Verification Commands

```bash
cd frontend
npm run build
cd ..
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Maintenance features implemented
3. APIs consumed
4. Validation behavior
5. Query invalidation behavior
6. Manual validation notes
7. Build/test results
8. Risks
9. Rollback instructions

## Prompt 6 — Add Installation and Replacement Frontend Workflow

### Context

Installation backend exists and can decommission a previous transformer during replacement, but the frontend does not expose installation records.

### Exact Task

Add installation list/detail/create/edit UI and transformer-detail installation history tab.

### Files to Inspect

- `src/routes/installationRoutes.js`
- `src/controllers/installationController.js`
- `src/services/installationService.js`
- `src/validators/installationValidator.js`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- `frontend/src/types/api.ts`

### Files Likely to Modify

- New `frontend/src/api/installationApi.ts`
- New `frontend/src/pages/installations/*`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- `frontend/src/types/api.ts`
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Do not implement backend redesign.
- Use existing endpoints only.
- Replacement must clearly warn that the previous transformer will be decommissioned.
- Do not add offline behavior in this prompt.

### Required Verification Commands

```bash
cd frontend
npm run build
cd ..
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Installation/replacement UI behavior
3. APIs consumed
4. Query invalidation behavior
5. Manual validation notes
6. Build/test results
7. Risks
8. Rollback instructions

## Prompt 7 — QR Scan Contract and Landing Flow

### Context

QR display works through `GET /api/transformers/:id/qr`, but standalone QR routes are stubbed and QR target URL appears mismatched with frontend routes.

### Exact Task

Define and implement a safe QR scan/open contract so QR codes open the correct transformer profile after authentication.

### Files to Inspect

- `src/services/qrService.js`
- `src/controllers/qrController.js`
- `src/routes/qrRoutes.js`
- `src/services/transformerService.js`
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/api/transformerApi.ts`

### Files Likely to Modify

- QR backend service/controller/routes if needed
- `frontend/src/routes/AppRoutes.tsx`
- QR landing/lookup frontend page if needed
- `frontend/src/pages/transformers/TransformerDetailPage.tsx`
- tests
- docs readiness map/changelog

### Constraints

- Do not expose unauthenticated asset details.
- Do not use stubbed QR routes unless they are implemented and tested.
- Do not add QR bulk/admin workflows.

### Required Verification Commands

```bash
npx jest --testPathPatterns=src/tests/transformer --forceExit
cd frontend
npm run build
cd ..
npm test
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. QR payload/URL contract
3. Scan/open behavior
4. Tests added/updated
5. Build/test results
6. Risks
7. Rollback instructions

## Prompt 8 — Architecture and Onboarding Documentation Cleanup

### Context

The original guides describe Supabase/Mapbox/Dexie/Tailwind, but the current implementation is Express/MongoDB/Redis/Vite/custom CSS. Some local docs still say the repo is backend-only.

### Exact Task

Update documentation so a new developer and non-technical founder can understand the current architecture, what changed from the original guides, and which PRD gaps remain.

### Files to Inspect

- `docs/guides/*`
- `docs/LOCAL_ONBOARDING.md`
- `docs/LOCAL_DEMO_USERS.md`
- `docs/API_FRONTEND_READINESS_MAP.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `README.md`
- `package.json`
- `frontend/package.json`

### Files Likely to Modify

- `docs/LOCAL_ONBOARDING.md`
- `docs/API_FRONTEND_READINESS_MAP.md`
- New architecture decision document if approved
- `README.md`
- `docs/CHANGELOG_LOCAL_SETUP.md`

### Constraints

- Documentation only.
- Do not modify runtime code.
- Do not erase historical phase reports.
- Be explicit about remaining PRD gaps.

### Required Verification Commands

```bash
git diff -- docs README.md
git status --short
```

### Required Completion Report

Return:

1. Files modified
2. Documentation changes
3. Current architecture summary
4. PRD gaps documented
5. Remaining questions
6. Rollback instructions
