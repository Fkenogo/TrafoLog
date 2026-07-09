# Phase 9F Seed Data Report

## Seed Script

Seed script:

```text
scripts/phase9fSeedData.js
```

The script creates a repeatable Phase 9F validation dataset using stable prefixes and metadata. It clears previous Phase 9F records before reseeding so the validation dataset can be refreshed.

## Refreshed Seed Result

```json
{
  "users": 11,
  "phase9f_transformers": 50,
  "total_inspections": 356,
  "total_faults": 97,
  "total_maintenance_records": 180,
  "phase9f_audit_logs": 330,
  "phase9f_notifications": 90,
  "phase9f_backup_jobs": 3
}
```

The Phase 9F-owned dataset reset correctly. Totals for inspections, faults, and maintenance include older non-Phase9F local records that were already present in the development database.

## Users

| Persona | Count | Seeded role |
|---|---:|---|
| Super Admin | 1 | Super Admin |
| Operations Manager | 1 | Territory Manager |
| Supervisor | 2 | Engineer |
| Field Technician | 5 | Field Technician |
| Viewer | 2 | Viewer |

The application role model does not include literal `Operations Manager` or `Supervisor`, so the seed uses the closest existing roles:

| Requested persona | Existing role used |
|---|---|
| Operations Manager | Territory Manager |
| Supervisor | Engineer |

## Transformers

Seeded 50 Phase 9F transformers with:

- Different manufacturers.
- Pole-mounted, ground/plinth, and indoor-style mounting values.
- kVA ratings from 50 to 1000.
- 11 kV and 33 kV network voltage.
- Active, maintenance, faulty, and decommissioned-style statuses.
- Mixed age profiles.
- Overloaded and poor/critical condition examples.
- GPS coverage plus intentionally missing-GPS examples.

## Inspections

The refreshed database contains 356 total inspection records, including Phase 9F-created inspections and existing local validation records.

Phase 9F inspection data includes:

- Good/Fair/Poor/Critical outcomes.
- Routine, emergency, follow-up, and commissioning-style visit types.
- Overdue-like historical records.
- Narrative and recommended-action values.

Photo upload backend validation was not exercised because Phase 9F did not add or alter photo storage.

## Faults

The refreshed database contains 97 total fault records, including Phase 9F-created faults and existing local validation records.

Fault data includes:

- Low-to-critical operational severity equivalents.
- Open, assigned, in-progress, resolved, and closed states.
- Multiple fault types including overload, oil leak, bushing failure, theft, vandalism, and side faults.

## Maintenance

The refreshed database contains 180 total maintenance records, including Phase 9F-created maintenance and existing local validation records.

Maintenance data includes:

- Preventive maintenance.
- Corrective maintenance.
- Emergency maintenance.
- Scheduled/completed/in-progress style states.

## Audit Logs

Seeded 330 Phase 9F audit entries to populate multi-page audit views and filters.

## Notifications

Seeded 90 notifications for:

- Maintenance due.
- Inspection overdue.
- Transformer fault.
- Restore completed.
- Backup completed.
- Login.
- User creation.

## Backup History

Seeded backup history includes:

- Multiple completed backup jobs.
- One failed backup job fixture.
- Metadata suitable for history-table validation.

## Seed Accounts

All accounts use:

```text
Phase9F@1234
```

| Account | Email |
|---|---|
| Super Admin | `super.admin@phase9f.io` |
| Operations Manager | `operations.manager@phase9f.io` |
| Supervisor | `supervisor.north@phase9f.io` |
| Technician | `technician1@phase9f.io` |
| Viewer | `viewer1@phase9f.io` |

## Implementation Notes

- Phase 9F uses `@phase9f.io` addresses because the backend email validator rejects `.local`.
- Transformer seed initially inserts valid GPS for all transformers and then unsets GPS for a subset. This avoids MongoDB 2dsphere validation errors while still creating missing-GPS scenarios.
- Backup seed uses the real backup service while maintenance mode is enabled, then creates a failed backup metadata fixture.
