# Prompt 08 — Fault Reporting & Installation Forms

**Phase:** 05 — Field Activity Modules  
**Depends on:** Prompt 07 complete — inspection and maintenance forms working

---

## Context

Inspection and maintenance forms are complete. Now build fault reporting (the fault-to-fix workflow) and installation records.

---

## Part 1 — Report Fault Form

**File:** `src/pages/ReportFaultPage.tsx`  
**Route:** `/transformers/:id/fault`  
**Access:** Field Technician and above

Also accessible from a global **"Report Fault"** button in the navigation — when accessed this way, show a transformer search field first so the user can find the correct asset.

---

### Section 1: Fault Details

| Field | Type | Notes |
|---|---|---|
| Date / Time Fault Reported | DateTime | Defaults to now |
| Reported By | Read-only | Auto from login |
| Fault Source | Button group | `Field Observation` `Customer Report` `Supervisor` |
| Fault Description | Textarea | Required. Placeholder: _"Describe what was observed — sounds, smells, visible damage, power status..."_ |
| Network Affected | Read-only | Auto-filled from transformer's `network_voltage_kv` |

**Fault Type** — visual card selector, show an icon for each:

```
Overload          Oil Leak          Bushing Failure    Winding Failure
Complete Failure  Fire              Theft / Vandalism  LV Side Fault
HV Side Fault     Other
```

**Severity** — large prominent button group, colour-coded:

| Option | Colour |
|---|---|
| Minor | Yellow |
| Major | Orange |
| Critical | Red |
| Complete Outage | Dark red |

If **Critical** or **Complete Outage** is selected, show banner:
> _"⚠ High severity — Territory Manager and Super Admin will be notified immediately on submission"_

| Field | Type | Notes |
|---|---|---|
| Customers Affected (estimated) | Number | |
| Area Affected | Text | Description of the affected zone |
| Photos | Multi-file upload | Category: `fault` |

---

### On Save

1. Save to `fault_records` table — set `network_voltage_kv` from transformer record automatically
2. Update transformer: set `has_open_fault = true`
3. If severity is `major`, `critical`, or `complete_outage`:
   - Update transformer `operational_status = 'faulty'`
4. If severity is `critical` or `complete_outage`:
   - Create urgent notifications for **all** Territory Managers and Super Admins
5. Add timeline entry: _"Fault reported — [fault_type] — Severity: [severity]"_

---

### Fault Management (on Asset Profile, Faults Tab)

Buttons visible to Managers and Engineers on open fault records:

**Assign to Team:**
- Opens a user selector modal
- Saves `assigned_to` + `date_assigned`
- Updates `fault_status = 'assigned'`
- Creates notification for assigned user

**Mark In Progress:**
- Updates `fault_status = 'in_progress'`

---

### Resolve Fault Modal

**File:** `src/components/ResolveFaultModal.tsx`

Triggered from the Faults tab on the asset profile. All roles that can log activity can resolve.

| Field | Type | Notes |
|---|---|---|
| Resolution Description | Textarea | Required |
| Root Cause | Textarea | |
| Parts Replaced | Text | |
| Photos After Repair | Multi-file upload | Category: `fault_resolved` |
| Resolved By | Read-only | Auto from login |

**On save:**
1. Update `fault_record`:
   - `fault_status = 'resolved'`
   - `resolved_date = now()`
   - `resolved_by = currentUser.id`
   - `downtime_hours` = auto-calculated: `(resolved_date - fault_datetime)` in hours
2. Update transformer:
   - `has_open_fault = false`
   - If `operational_status` was `'faulty'`: revert to `'active'`
3. Add timeline entry: _"Fault resolved — Downtime: [X] hours"_

> ⚠️ `downtime_hours` is **always** calculated automatically. Do not show a manual input field for it.

---

## Part 2 — Installation Record Form

**File:** `src/pages/LogInstallationPage.tsx`  
**Route:** `/transformers/:id/installation`  
**Access:** Field Technician and above

---

### Section 1: Installation Details

| Field | Type | Notes |
|---|---|---|
| Installation Date | DateTime | Defaults to now |
| Installation Type | Button group | `New Installation` `Replacement` `Relocation` |

**If Replacement is selected:**
- Show transformer search field: _"Search for previous transformer by Asset ID or site name"_
- User selects the transformer being replaced (required for Replacement type)
- Show replacement reason dropdown: `Overload` `Failure` `Upgrade` `Load Split` `Other`

---

### Section 2: Network Confirmation

> ⚠️ The network voltage of the new transformer must match the feeder it is being installed on.

| Field | Type | Notes |
|---|---|---|
| Network Voltage of Installation | Button group | `11kV` `33kV` |
| kVA Rating Being Installed | Dropdown | Filtered by selected network voltage |

If selected network voltage does not match the transformer record's `feeder.network_voltage_kv`:
- Show red warning: _"⚠ Network voltage mismatch — selected voltage does not match this feeder's network"_

---

### Section 3: Team & Source

| Field | Type |
|---|---|
| Installing Team / Contractor | Text |
| Supervised By | Text |
| Transformer Source | Dropdown: `New Purchase` / `Refurbished` / `Transferred from Store` |

---

### Section 4: Technical Records

| Field | Type |
|---|---|
| Pre-installation Test Results | Textarea |
| Commissioning Readings | Textarea |
| Commissioned By | Text |
| Handover Date | Date picker |

---

### Section 5: Photos

| Category | Upload |
|---|---|
| Photos Before | Multi-file (category: `install_before`) |
| Photos During | Multi-file (category: `install_during`) |
| Photos After | Multi-file (category: `install_after`) |

---

### On Save

1. Save to `installation_records` table
2. Update current transformer: `install_date`, `operational_status = 'active'`
3. **If Replacement AND `previous_transformer_id` is set:**
   - Update previous transformer: `operational_status = 'decommissioned'`
   - Add timeline entry on **previous** transformer: _"Decommissioned — Replaced by [new Asset ID]"_
   - Add timeline entry on **current** transformer: _"Installation completed — Replacement. Replaced [previous Asset ID]"_
4. **Otherwise:**
   - Add timeline entry on current transformer: _"Installation completed — [installation_type]"_

---

## Notes

> The fault severity escalation logic — updating transformer status and creating notifications — must be implemented exactly as described. Do not simplify it.

> `downtime_hours` is always auto-calculated. Never show a manual input field for it.

> The replacement workflow links two transformer records via `previous_transformer_id`. Test this carefully — both timeline entries (on both transformers) must be created.
