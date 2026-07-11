# Railway-Safe Phase 9F Reference Seeder Design

## Objective

Add a narrow, idempotent script that reconciles only the three territories and five service areas required by `scripts/seedRailwayDemoUsers.js`. The script must require an explicit `MONGODB_URI`, must never fall back to localhost, and must not touch users, assets, operational data, authentication state, or unrelated reference records.

## Confirmed cause

The Railway demo-user seeder resolves assignments using the exact territory codes `P9FC`, `P9FE`, and `P9FW` and service-area codes `P9FSA1` through `P9FSA5`. Its Railway run reported those exact records as missing. The seeder correctly refused to invent ObjectIds, so eight users with scoped roles could not be created or updated.

The Railway database will not be queried during implementation. Similar records under other codes or names therefore cannot be inventoried in this task, and they would not satisfy the existing code-keyed user assignment contract. The reference seeder must not rename, repurpose, or modify such records.

## Canonical records

The definitions below come directly from `scripts/phase9fSeedData.js`.

### Territories

| Code | Name | Description | Region | Active |
|---|---|---|---|---|
| `P9FC` | Phase 9F Central | Phase 9F validation central territory | Central | `true` |
| `P9FE` | Phase 9F Eastern | Phase 9F validation eastern territory | Eastern | `true` |
| `P9FW` | Phase 9F Western | Phase 9F validation western territory | Western | `true` |

Although the broad seed relies on the Territory model's `is_active: true` default, the narrow reconciler will treat `is_active` as a canonical field so an existing inactive Phase 9F reference is restored to the state expected by the demo dataset.

### Service areas

| Code | Name | Territory code | Location town | Active |
|---|---|---|---|---|
| `P9FSA1` | Phase 9F Service Area 1 | `P9FC` | Kampala | `true` |
| `P9FSA2` | Phase 9F Service Area 2 | `P9FE` | Jinja | `true` |
| `P9FSA3` | Phase 9F Service Area 3 | `P9FW` | Mbarara | `true` |
| `P9FSA4` | Phase 9F Service Area 4 | `P9FC` | Mukono | `true` |
| `P9FSA5` | Phase 9F Service Area 5 | `P9FE` | Mbale | `true` |

`P9FSA6` is not required by the Railway demo users and will not be created or reconciled.

## Schema and dependency analysis

`Territory` requires `name` and `code`; both are unique. `description`, `region`, and `is_active` are schema-valid canonical fields. The model has timestamp fields named `created_at` and `updated_at`.

`ServiceArea` requires `territory_id` and `name`. Its `code`, `location_town`, and `is_active` fields are optional in the schema but are canonical Phase 9F fields; `code` is also the stable lookup key consumed by the demo-user seeder. The model has timestamp fields named `created_at` and `updated_at`.

A service area requires an existing territory reference for this seeder's safety contract. It does not require a district, feeder, manager/user, geometry, GPS, status enum, or any other prerequisite document. Feeders point to service areas, not the reverse. Districts are independent reference documents. Therefore the three territories and five service areas form a schema-valid minimal dataset.

## Architecture

Create `scripts/seedRailwayPhase9FReferences.js` with four focused responsibilities:

1. Validate and return the explicit MongoDB target from `MONGODB_URI`.
2. Reconcile a model record by its canonical `code` without replacing the document.
3. Resolve territory documents before reconciling dependent service areas.
4. Print per-record results and a stable final summary, then signal failure through a non-zero process exit code.

The script will export its canonical specifications and small helpers so focused Jest tests can exercise environment validation, comparison, reconciliation, dependency failure, summary behavior, and end-to-end idempotency.

## Reconciliation behavior

For each territory code, the script will use `findOne({ code })`. If absent, it will instantiate and save a new Territory using the canonical fields. If present, it will compare only `name`, `code`, `description`, `region`, and `is_active`; it will assign and save only fields whose canonical values differ. This preserves `_id`, `created_at`, and unrelated metadata that Mongoose strict schemas may retain in existing database documents. An exact match is `SKIPPED`.

For each service-area code, the script will first resolve the canonical territory document produced by the territory phase. If unavailable, it will produce `FAILED` and perform no service-area write. Otherwise it will find by `code` and reconcile only `territory_id`, `name`, `code`, `location_town`, and `is_active`. ObjectId equality will be normalized for comparison. Existing `_id`, `created_at`, and unrelated metadata remain untouched. An exact match is `SKIPPED`.

Each record operation will be isolated in error handling so the output identifies every failure. Any failed required record makes the final process exit code non-zero. A territory failure prevents dependent service-area writes rather than causing invented relationships.

The script will use no destructive methods and no replacement-style writes. It will never search for or mutate records by approximate name, alternate code, or region.

## Output contract

Each required code receives one result line with one of:

- `CREATED`
- `UPDATED`
- `SKIPPED`
- `FAILED`

The final line reports stable totals in this order:

```text
Summary: CREATED=n UPDATED=n SKIPPED=n FAILED=n
```

Failures may include validation or conflict messages but output must never include `MONGODB_URI`, credentials, or connection strings.

## Explicit collection scope

The script reads and may modify only:

- `territories`, limited to codes `P9FC`, `P9FE`, and `P9FW`
- `serviceareas`, limited to codes `P9FSA1` through `P9FSA5`

It does not import models for or modify users, transformers, feeders, districts, transformer ratings, faults, inspections, maintenance records, audit logs, notifications, sessions, refresh tokens, imports, or backups.

## Broad-seed behavior intentionally excluded

The narrow script will not copy the broad seed's localhost fallback, cleanup routine, sixth service area, feeders, districts, transformer ratings, user creation, generated operational assets, audit/notification generation, backup operations, or maintenance-mode behavior.

## Testing strategy

`src/tests/seedRailwayPhase9FReferences.test.js` will be written before implementation and must initially fail because the new script does not exist. It will cover:

- missing `MONGODB_URI` and absence of localhost fallback;
- creation of all three territories and five service areas;
- exact canonical field values and parent relationships;
- rerun idempotency with `SKIPPED` outcomes and no duplicates;
- preservation of unrelated records and unrelated metadata;
- unchanged user and asset collection counts/content;
- failure and no write when a mandatory territory prerequisite is unavailable;
- stable summary totals and non-zero failure signaling at the callable API boundary.

After focused tests pass, the existing demo-user seeder suite, full backend suite, and frontend production build will be run exactly as requested.

## Documentation and delivery

Update `docs/CHANGELOG_LOCAL_SETUP.md` and create an implementation report under `docs/superpowers/reports/`. Both will document this later Railway execution order:

```bash
railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayPhase9FReferences.js'

railway run --service MongoDB sh -c 'MONGODB_URI="$MONGO_PUBLIC_URL" node scripts/seedRailwayDemoUsers.js'
```

They will warn not to run:

```bash
node scripts/phase9fSeedData.js
```

against the Railway preview database.

Neither seeder will be executed against Railway during implementation. After all requested validations pass, only relevant files will be staged, committed with `Add Railway-safe Phase 9F reference seeder`, and pushed to `origin/main`. The pushed commit and clean worktree will then be verified.

## Rollback

The implementation commit can be reverted with a new Git revert commit. Because the seeder is non-destructive and preserves document identities, a database rollback—if ever needed after a later authorized Railway execution—must be a deliberate manual reconciliation of only the eight canonical reference records; this script will not provide or perform deletion.
