# Prompt 07 — Inspection & Maintenance Forms

**Phase:** 05 — Field Activity Modules  
**Depends on:** Prompt 06 complete — asset profile page working

---

## Context

Asset profile page is complete. Now build the two primary field forms: inspection logging and maintenance logging. These are the forms field technicians use most frequently.

---

## Shared Behaviour for All Field Forms

Apply these rules to **every** field form (inspection, maintenance, fault, installation):

- GPS is auto-captured when the form opens (`navigator.geolocation`)
- User identity auto-populated from auth context (read-only)
- On successful submit: call `addTimelineEntry()` with appropriate event type
- Show a loading spinner during submit
- On success: redirect back to the transformer profile at the relevant tab
- Structure code for offline-readiness (full offline implementation comes in Prompt 11)

---

## Part 1 — Log Inspection Form

**File:** `src/pages/LogInspectionPage.tsx`  
**Route:** `/transformers/:id/inspect`  
**Access:** Field Technician and above

---

### Section 1: Visit Details

| Field | Type | Notes |
|---|---|---|
| Inspection Date & Time | DateTime picker | Defaults to now |
| Visit Type | Dropdown | `Routine Inspection` / `Follow-up` / `Audit` |
| GPS Coordinates | Auto-captured | Show latitude, longitude, accuracy. Refresh button. |

---

### Section 2: Network Confirmation

> These fields catch cases where the physical nameplate differs from the database record.

| Field | Type | Notes |
|---|---|---|
| Network Voltage Confirmed | Toggle Yes/No | Pre-labelled: "Confirmed as [X]kV?" |
| kVA Rating Confirmed | Toggle Yes/No | Pre-labelled: "Confirmed as [X]kVA?" |

If either is **No**:
- Show warning banner: _"Discrepancy flagged — this record will be sent to Engineer for review"_
- Set `rating_discrepancy_flag = true` on the inspection record
- Create notification for Engineers

---

### Section 3: Physical Condition

Use **visual button groups** for each field (not dropdowns — easier on mobile):

| Field | Options |
|---|---|
| Overall Physical Condition | `Good` `Fair` `Poor` `Critical` |
| Rust / Corrosion | `None` `Minor` `Severe` |
| Oil Leakage | `None` `Slow Drip` `Active Leak` |
| Bushing Condition | `Good` `Cracked` `Broken` |
| Tank / Body Damage | `None` `Dents` `Puncture` |
| Cooling Fins | `Good` `Damaged` `Blocked` |

Colour-code the buttons: green for good states, amber for moderate, red for severe.

---

### Section 4: Oil & Breather

| Field | Options |
|---|---|
| Oil Level | `Full` `Adequate` `Low` `Very Low` |
| Silica Gel Color | `Blue — OK` `Pink — Monitor` `White — Replace Now` |
| Oil Test Required | `Yes` `No` |

---

### Section 5: Electrical Readings

| Field | Type | Notes |
|---|---|---|
| Load Current Phase A (Amps) | Number input | |
| Load Current Phase B (Amps) | Number input | |
| Load Current Phase C (Amps) | Number input | |
| Voltage Reading HV Side | Number input | Optional |
| Voltage Reading LV Side | Number input | Optional |

**Live calculated field** — shown below the inputs, updates in real time:

```
Estimated Load: 87%  ████████░░  [Amber]

Formula (3-phase):
  load_percentage = (avgAmps × voltageLV × 1.732) / (kVA × 1000) × 100

Formula (single-phase):
  load_percentage = (amps × voltageLV) / (kVA × 1000) × 100

Use transformer.phase_type to select the correct formula.
Use transformer.kva_rating for kVA.
Use secondary voltage (e.g. 415) for voltageLV.
```

Colour coding:
- `< 80%` → green
- `80–89%` → amber
- `>= 90%` → red + prominent warning banner:

```
⚠ OVERLOAD DETECTED
This transformer is operating at [X]% of its rated capacity.
Immediate attention recommended.
```

Set `overload_flag = true` on save if load >= 90%.

---

### Section 6: Site & Safety

| Field | Options |
|---|---|
| Security Fencing | `Present` `Damaged` `Absent` |
| Earthing | `Present` `Absent` |
| Warning Signs | `Present` `Absent` |
| Vegetation Encroachment | `None` `Moderate` `Severe` |
| Unauthorised Connections Observed | `Yes` `No` |

---

### Section 7: Assessment

| Field | Type | Notes |
|---|---|---|
| Condition Narrative | Textarea (large) | Required. Placeholder: _"Describe the overall condition and any observations..."_ |
| Recommended Action | Large button group | `No Action` `Monitor` `Schedule Maintenance` `Urgent Repair` `Replace` |
| Photos | Multi-file upload | Preview thumbnails. Upload to Supabase Storage. |

Recommended Action button colours:
- No Action → green
- Monitor → blue
- Schedule Maintenance → amber
- Urgent Repair → orange
- Replace → red

---

### On Save

1. Save to `inspections` table
2. Update `transformers`: set `last_inspection_date = now()`
3. If `overload_flag = true`: update transformer status notes
4. If `recommended_action` is `urgent_repair` or `replace`:
   - Create notification for Territory Manager and Super Admin
5. Add timeline entry: _"Inspection completed — Recommended: [recommended_action]"_

---

## Part 2 — Log Maintenance Form

**File:** `src/pages/LogMaintenancePage.tsx`  
**Route:** `/transformers/:id/maintenance`  
**Access:** Field Technician and above

---

### Section 1: Maintenance Details

| Field | Type | Options |
|---|---|---|
| Maintenance Date | DateTime | Defaults to now |
| Maintenance Type | Dropdown | `Preventive` / `Corrective` / `Emergency` |
| Team / Contractor | Text | |
| Supervised By | Text | |

---

### Section 2: Work Performed

Toggle switches (Yes / No) for each item:

| Work Item | Conditional Field |
|---|---|
| Oil Top-up | If Yes: show "Litres added" number input |
| Oil Replacement | |
| Oil Filtration | |
| Silica Gel Replaced | |
| Bushing Replacement | |
| Tap Changer Service | |
| Cooling System Service | |
| Physical Cleaning | |
| Other Work | If toggled: show text input |

---

### Section 3: Parts Used

- Free text area: _"List parts used with quantities (e.g. Silica gel 2kg, Bushing 11kV x2)"_

---

### Section 4: Post-Maintenance Assessment

| Field | Type |
|---|---|
| Load Phase A after maintenance (Amps) | Number |
| Load Phase B after maintenance (Amps) | Number |
| Load Phase C after maintenance (Amps) | Number |
| Post-maintenance condition narrative | Textarea (required) |
| Next Recommended Maintenance Date | Date picker |

---

### Section 5: Sign-off & Photos

| Field | Type |
|---|---|
| Reviewed By | Text |
| Photos Before | Multi-file upload (category: `maintenance_before`) |
| Photos After | Multi-file upload (category: `maintenance_after`) |

---

### On Save

1. Save to `maintenance_records` table
2. Update `transformers`: set `last_maintenance_date = now()`
3. Add timeline entry: _"Maintenance completed — [maintenance_type]"_

---

## Notes

> The load percentage formula differs between single-phase and three-phase transformers. Check `transformer.phase_type` to select the correct formula.

> Overload notifications must fire **immediately** on save — do not batch them.

> Install `browser-image-compression` for client-side photo compression before upload to keep storage costs manageable.
