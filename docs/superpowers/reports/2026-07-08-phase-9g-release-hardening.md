# Phase 9G — Release Hardening

## Summary

Phase 9G prepared the MVP for pilot candidate handoff without adding major product features. The sprint focused on browser guidance, mobile dashboard scanability, transformer status presentation, quiet pre-login auth refresh behavior, SMTP pilot verification, and a concise handoff checklist.

## Release-Hardening Strategy

1. Keep the scope narrow and avoid redesigning completed modules.
2. Improve dashboard readability where existing data already supports it.
3. Quiet only expected unauthenticated refresh noise on the login page while preserving cookie-based refresh for protected routes.
4. Extend existing validation evidence instead of adding a new heavyweight browser dependency.
5. Document pilot handoff expectations clearly enough for an operator to run them.

## Files Modified

- `frontend/src/pages/dashboard/DashboardPage.tsx`
- `frontend/src/styles/app.css`
- `frontend/src/contexts/AuthContext.tsx`
- `scripts/phase9fCaptureScreenshots.js`
- `.env.example`
- `docs/CHANGELOG_LOCAL_SETUP.md`
- `docs/superpowers/reports/2026-07-07-phase-9f-bug-register.md`
- `docs/superpowers/reports/2026-07-07-phase-9f-release-readiness-assessment.md`
- `docs/superpowers/reports/2026-07-08-phase-9g-release-hardening.md`
- `docs/superpowers/reports/phase9f-validation-artifacts/browser-preflight.json`
- `docs/superpowers/reports/phase9f-validation-artifacts/browser-console-logs.json`
- `docs/superpowers/reports/phase9f-validation-artifacts/screenshots/*.png`

## Code Diff Summary

- Dashboard transformer status widget now accepts `by_status` plus common fallback stat shapes and normalizes raw keys into user-friendly labels.
- Mobile dashboard now keeps primary KPI and status sections prominent while compacting lower-priority operational widgets into collapsible sections.
- Login-page bootstrap no longer calls `/api/auth/refresh` when no access token exists, removing expected pre-login console noise while preserving protected-route refresh.
- Screenshot capture now records browser metadata, automated browser coverage, and pilot browser recommendations.
- `.env.example` now includes an SMTP pilot verification checklist.

## Browser Support Guidance

| Browser | Pilot status |
|---|---|
| Chrome | Primary supported pilot browser |
| Edge | Primary supported pilot browser |
| Safari | Manual validation recommended before broader rollout |
| Firefox | Manual validation recommended before broader rollout |

Automated screenshot coverage remains Chromium through Puppeteer. No heavy browser dependency was added.

## SMTP Pilot Checklist

Pilot setup must configure:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Procedure:

1. Configure SMTP values in local/production environment.
2. Start backend and frontend.
3. Create or assign a fault to trigger a notification.
4. Confirm the in-app notification appears.
5. Confirm the email arrives at the assigned user's inbox.
6. If email fails, continue validating in-app notifications and fix SMTP configuration before broader rollout.

## Pilot Handoff Checklist

### Setup Commands

```bash
npm install
cp .env.example .env
npm start
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5176
```

### Demo Accounts

Seeded Phase 9F accounts use password `Phase9F@1234`:

- `super.admin@phase9f.io`
- `operations.manager@phase9f.io`
- `supervisor.north@phase9f.io`
- `technician1@phase9f.io`
- `viewer1@phase9f.io`

### Validation Commands

```bash
node scripts/phase9fSeedData.js
node scripts/phase9fValidateApiWorkflows.js
node scripts/phase9fCaptureScreenshots.js
cd frontend
npm run build
cd ..
npm test
git status --short
```

### Backup / Restore Safety Notes

- Enable maintenance mode before creating backups.
- Restore requires maintenance mode, successful dry-run, and exact typed confirmation.
- Real restore creates a pre-restore backup automatically.
- Do not expose backup download links or raw storage paths during pilot.

## Validation Result

| Check | Result |
|---|---|
| Phase 9F seed | Passed: refreshed users, 50 Phase 9F transformers, 502 inspections, 141 faults, 257 maintenance records, 330 audit logs, 90 notifications, and 3 backup jobs |
| Phase 9F API validation | Passed: 64 passed, 0 failed, 4 skipped/gap |
| Browser screenshot capture | Passed: 12 screenshots, 0 console logs, backend preflight version `2.0.0`, Admin stats 200, Chromium/Puppeteer metadata captured |
| Frontend build | Passed, with existing Vite chunk-size warning |
| Backend tests | Passed: 11 suites, 184 tests |

## Known Limitations

- Automated browser validation remains Chromium-only.
- Production SMTP must be configured and verified separately.
- Large pilot datasets may require future dashboard/report performance tuning.
- Safari and Firefox should be manually validated before expanding beyond controlled pilot.

## Release Readiness

Verdict: **Ready for pilot candidate handoff**.

## Rollback

1. Revert the modified files listed above.
2. Rerun `cd frontend && npm run build`.
3. Rerun `npm test`.
4. Rerun the Phase 9F validation chain to confirm rollback state.
