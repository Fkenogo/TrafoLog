# Phase 7B Notifications Panel

**Date:** 2026-07-04  
**Scope:** Frontend user-owned notification panel plus one tiny backend endpoint blocker fix for the ready delete endpoint.

## Summary

Implemented a live notifications panel in the application topbar using only the ready user notification endpoints. The existing bell now loads unread count, opens a non-blocking operational panel, lists notifications, supports an unread filter, and allows mark-read, mark-all-read, refresh, and delete actions.

The panel is intentionally limited to user-owned in-app notifications. Push tokens, preferences, delivery status, resend, clear-all, and admin notification workflows remain unexposed.

## Files Modified

| File | Change |
|---|---|
| `frontend/src/api/notificationApi.ts` | Added typed wrappers for list, unread count, mark one read, mark all read, and delete |
| `frontend/src/types/api.ts` | Added notification type, priority, delivery status, notification, and unread-count types |
| `frontend/src/layouts/AppLayout.tsx` | Wired the topbar bell to unread count and added the notification dropdown panel |
| `frontend/src/styles/app.css` | Added notification badge, panel, toolbar, card, badge, and responsive styles |
| `src/services/notificationService.js` | Fixed ready delete endpoint by importing `ApiError` and replacing removed Mongoose `remove()` usage with `deleteOne()` |
| `docs/CHANGELOG_LOCAL_SETUP.md` | Added Phase 7B changelog entry |
| `docs/superpowers/reports/2026-07-04-phase-7b-notifications-panel.md` | Created this report |

## APIs Consumed

- `GET /api/notifications`
- `GET /api/notifications/unread/count`
- `PUT /api/notifications/:id/read`
- `PUT /api/notifications/read-all`
- `DELETE /api/notifications/:id`

## Frontend Implementation

- Added `notificationApi` as the only frontend API access point for notification operations.
- Added notification data contracts to shared API types.
- Added a topbar notification shell in `AppLayout`.
- The unread-count query runs independently and does not block the app if it fails.
- The notification list query is enabled when the panel is opened.
- Opening the panel invalidates and refreshes both list and unread count.
- The panel shows:
  - title
  - message
  - type badge
  - priority badge
  - read/unread badge
  - created date
  - linked record metadata when available
  - mark-read action
  - delete action
  - mark-all-read action
  - unread filter
  - refresh action
  - loading, error, and empty states

## Validation And Error Handling

- No frontend form validation was needed because Phase 7B has no create/update form.
- Mutations disable their controls while pending.
- Success actions show toast confirmations.
- API failures use the existing friendly error mapper via `notifyApiError`.
- The topbar shows a muted indicator if unread-count loading fails, and the rest of the app remains usable.

## Query Invalidation

After mark-read, mark-all-read, or delete, the panel invalidates:

- `['notifications', 'list']`
- `['notifications', 'unread-count']`

The panel also refreshes both queries when opened.

## Backend Blocker Fixed

During API smoke validation, `DELETE /api/notifications/:id` failed with `500 ApiError is not defined`.

Root causes:

- `src/services/notificationService.js` referenced `ApiError` without importing it.
- The service used `notification.remove()`, which is not available with the current Mongoose version.

Fix:

- Imported `{ ApiError }` from `../utils/error`.
- Replaced `await notification.remove()` with `await notification.deleteOne()`.

No backend routes, schemas, or payload contracts were changed.

## Verification

Commands run:

```bash
cd /Users/theo/kvassetTracker_zoe/frontend
npm run build
npm run dev
cd /Users/theo/kvassetTracker_zoe
npm start
node --input-type=module - <<'NODE'
// temporary local notification API smoke script
NODE
npm test
git status --short
```

Results:

- Frontend build passed.
- Frontend dev server started at `http://127.0.0.1:5173/`.
- Backend server started at `http://localhost:3000`.
- API smoke passed for login, unread count, list, mark one as read, mark all as read, and delete.
- Backend tests passed: 5 suites, 91 tests.
- `git status --short` captured the dirty worktree.

## Manual Validation

Validated by live API smoke using the documented seeded admin account. The smoke script created one temporary user-owned notification, confirmed it appeared in the list and unread count, marked it read, marked all read, deleted it through the API, and confirmed it no longer existed in MongoDB.

Browser UI was compiled and the Vite server was started. No Playwright/browser automation was run in this phase.

## Known Issues And Risks

- `GET /api/notifications` accepts filter query params in the controller, but `NotificationService.getUserNotifications` currently ignores the passed filter object. The unread filter is therefore implemented client-side.
- Notification route ordering still makes `DELETE /api/notifications/push-token` risky because `/:id` is registered first. This remains out of scope because push-token deletion is not exposed in Phase 7B.
- The notification panel displays linked record metadata but does not navigate to linked records because linked record routing is not consistently documented in notification payloads.
- Backend tests still emit existing Mongoose duplicate-index warnings and Jest open-handle warnings.

## Rollback

To roll back Phase 7B only:

```bash
git checkout -- frontend/src/layouts/AppLayout.tsx frontend/src/styles/app.css frontend/src/types/api.ts src/services/notificationService.js docs/CHANGELOG_LOCAL_SETUP.md
rm frontend/src/api/notificationApi.ts
rm docs/superpowers/reports/2026-07-04-phase-7b-notifications-panel.md
```

Use path-specific rollback only. The worktree contains previous phase changes that should not be reverted wholesale.

## Stop Point

Stopped after Phase 7B. Push notifications, notification preferences, admin notifications, clear-all, resend, delivery status, and other advanced modules were not implemented.
