# Local Demo Users

Phase 9F demo data creates the following local accounts for repeatable validation and pilot demos.

Run:

```bash
node scripts/phase9fSeedData.js
```

All accounts use:

```text
Password: Phase9F@1234
```

If passwords are changed during User Management testing, reset them with:

```bash
node scripts/resetDemoPasswords.js
```

## Accounts

| Name | Email | Role | Status | Permissions |
|---|---|---|---|---|
| Phase 9F Super Admin | `super.admin@phase9f.io` | Super Admin | Active | Full platform access: admin workspace, user management, audit logs, all transformer/fault/inspection/maintenance workflows, reports, exports, backup, restore, and maintenance mode. |
| Phase 9F Operations Manager | `operations.manager@phase9f.io` | Territory Manager | Active | Territory-scoped operations: dashboard, own territory transformers, transformer verification, fault assignment, and report export. |
| Phase 9F Supervisor North | `supervisor.north@phase9f.io` | Engineer | Active | Service-area operations: assigned-area visibility, transformer verification, fault assignment, fault resolution, and dashboard access. |
| Phase 9F Supervisor South | `supervisor.south@phase9f.io` | Engineer | Active | Service-area operations: assigned-area visibility, transformer verification, fault assignment, fault resolution, and dashboard access. |
| Phase 9F Field Technician 1 | `technician1@phase9f.io` | Field Technician | Active | Field workflows: assigned-area visibility, inspection logging, maintenance logging, fault reporting, and nearby transformer lookup. |
| Phase 9F Field Technician 2 | `technician2@phase9f.io` | Field Technician | Active | Field workflows: assigned-area visibility, inspection logging, maintenance logging, fault reporting, and nearby transformer lookup. |
| Phase 9F Field Technician 3 | `technician3@phase9f.io` | Field Technician | Active | Field workflows: assigned-area visibility, inspection logging, maintenance logging, fault reporting, and nearby transformer lookup. |
| Phase 9F Field Technician 4 | `technician4@phase9f.io` | Field Technician | Active | Field workflows: assigned-area visibility, inspection logging, maintenance logging, fault reporting, and nearby transformer lookup. |
| Phase 9F Field Technician 5 | `technician5@phase9f.io` | Field Technician | Active | Field workflows: assigned-area visibility, inspection logging, maintenance logging, fault reporting, and nearby transformer lookup. |
| Phase 9F Viewer One | `viewer1@phase9f.io` | Viewer | Active | Read-only validation: dashboard, transformer visibility, and reports. |
| Phase 9F Viewer Two | `viewer2@phase9f.io` | Viewer | Inactive | Deactivated-account validation. Login should be rejected until reactivated by a Super Admin. |

## Local Environment Check

Run:

```bash
node scripts/checkLocalEnvironment.js
```

The check verifies:

- MongoDB connection
- Redis connection
- Backend health endpoint
- Frontend URL
- Upload temp folder write access
- Backup folder write access

The script prints `PASS` or `FAIL` for each check and exits non-zero when any required local dependency is unavailable.
