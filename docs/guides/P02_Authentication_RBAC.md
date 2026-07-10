# Prompt 02 — Authentication System & Role-Based Access Control

**Phase:** 01 — Foundation & Authentication  
**Depends on:** Prompt 01 complete and verified

---

## Context

Project foundation is complete. Now build the full authentication and RBAC system. This is the security backbone of the entire application — every feature in subsequent prompts depends on it being correct.

---

## Task

### 1. Supabase Auth Setup

- Email + password authentication only (no social login)
- Create `src/lib/AuthContext.tsx`
- Expose via React context:
  - `user: User | null`
  - `session: Session | null`
  - `role: Role | null`
  - `loading: boolean`
  - `signIn(email, password): Promise<void>`
  - `signOut(): Promise<void>`
- On login: fetch the user's profile from the `users` table to retrieve `role`, `territory_id`, and `service_area_id`
- Persist session using Supabase's built-in session management

### 2. Protected Route Component

Create `src/components/ProtectedRoute.tsx`:

```typescript
interface ProtectedRouteProps {
  children: ReactNode
  requiredRoles?: Role[]   // if empty, any authenticated user passes
}
```

- Redirects unauthenticated users to `/login`
- If `requiredRoles` is provided and user's role is not in the list: render `<AccessDenied />` component
- `AccessDenied` shows a clear message and a link back to the dashboard

### 3. Login Page (`src/pages/LoginPage.tsx`)

- Professional design using the navy/teal colour system
- kVAssetTracker logo/wordmark at top
- "UEDCL Transformer Management Platform" subtitle
- Email input field
- Password input field with show/hide toggle
- Sign In button with loading spinner during authentication
- Clear error message on failed login (wrong credentials, account inactive)
- No self-registration — accounts are created by Super Admin only

### 4. RBAC Permission Matrix

Create `src/lib/permissions.ts` implementing this exact matrix:

```typescript
export function canDo(role: Role, action: string): boolean
```

| Action | SUPER_ADMIN | TERRITORY_MANAGER | ENGINEER | FIELD_TECHNICIAN | VIEWER |
|---|---|---|---|---|---|
| `view_all_transformers` | ✅ | Own territory | ✅ | Assigned area | ✅ |
| `add_transformer` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `edit_transformer` | ✅ | Own territory | ✅ | ❌ | ❌ |
| `delete_transformer` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `log_inspection` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `log_maintenance` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `report_fault` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `assign_fault` | ✅ | Own territory | ✅ | ❌ | ❌ |
| `resolve_fault` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `log_installation` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `verify_asset` | ✅ | Own territory | ✅ | ❌ | ❌ |
| `decommission_asset` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `view_manager_dashboard` | ✅ | Own territory | ✅ | ❌ | ✅ |
| `view_field_dashboard` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `manage_users` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `export_reports` | ✅ | Own territory | ✅ | ❌ | ✅ |
| `bulk_import` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `view_audit_logs` | ✅ | ❌ | ❌ | ❌ | ❌ |

Also export a `usePermissions()` hook that returns `canDo` pre-bound to the current user's role:

```typescript
const { can } = usePermissions()
can('log_inspection')   // returns boolean
```

### 5. Navigation Shell (`src/components/Layout.tsx`)

- Persistent sidebar (desktop) / bottom navigation (mobile)
- Navigation items with role-based visibility:

| Nav Item | Visible To |
|---|---|
| Dashboard | All authenticated users |
| Transformers | All authenticated users |
| Map | All authenticated users |
| Inspections | All except Viewer |
| Maintenance | All except Viewer |
| Faults | All authenticated users |
| Installations | All except Viewer |
| Reports | Super Admin, Territory Manager, Engineer, Viewer |
| Users | Super Admin only |
| Import | Super Admin only |
| Settings | Super Admin only |

- Header bar showing: page title, user's full name, role badge (coloured by role), sign out button
- Role badge colours:
  - Super Admin: navy background
  - Territory Manager: teal background
  - Engineer: blue background
  - Field Technician: green background
  - Viewer: gray background
- Responsive: sidebar collapses on mobile, shows bottom tab bar instead
- Active route highlighted in sidebar

### 6. React Router Setup (`src/App.tsx`)

Configure all routes wrapped in appropriate `ProtectedRoute` guards:

```
Public:
  /login

Protected (any authenticated user):
  /                   ← Dashboard
  /transformers       ← Transformer list
  /transformers/:id   ← Asset profile
  /map                ← Map view

Protected (Field Technician and above — excludes Viewer):
  /transformers/:id/inspect
  /transformers/:id/maintenance
  /transformers/:id/fault
  /transformers/:id/installation
  /inspections
  /maintenance
  /faults
  /installations

Protected (Engineer and above):
  /reports

Protected (Super Admin only):
  /users
  /import
  /settings
```

### 7. User Management Page (`src/pages/UsersPage.tsx`)

Basic user management for Super Admin:

- List all users with: name, email, role badge, territory, active status
- "Add User" button — creates Supabase Auth user + inserts into `users` table
- Edit user: change role, territory assignment, active/inactive
- Deactivate user (does not delete — sets `is_active = false`)
- Deactivated users cannot log in (check `is_active` in AuthContext on login)

---

## Expected Result

After this prompt:
- Login page works with Supabase Auth
- Authenticated users see the navigation shell
- Navigation items show/hide based on role
- Protected routes redirect or show AccessDenied correctly
- `canDo()` / `can()` is available throughout the app
- Super Admin can create and manage user accounts

---

## Notes

> Test login by manually creating a user in Supabase Auth dashboard, then inserting a matching row in the `users` table with role `super_admin`.

> The `permissions.ts` file is referenced by every feature in subsequent prompts — get this right before moving on.

> "Own territory" logic for Territory Manager means filtering queries by `territory_id = user.territory_id`. Implement this as a utility in `src/lib/filters.ts`.
