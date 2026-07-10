# Prompt 04 — Transformer Registration Form & Asset List

**Phase:** 02 — Database & Asset Registry  
**Depends on:** Prompt 03 complete — all database tables created and verified

---

## Context

Database schema is complete. Now build the two core asset management screens: the transformer registration form and the asset list page.

---

## Task

### Part 1 — Transformer Registration Form

**File:** `src/pages/AddTransformerPage.tsx`  
**Route:** `/transformers/new`  
**Access:** Field Technician and above

Build a multi-step form with 4 steps. Show a step progress indicator at the top.

---

#### Step 1: Network & Technical Specifications

> ⚠️ **Network Voltage must be selected first.** It drives the kVA dropdown. This is a core business rule.

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| Network Voltage | Dropdown | ✅ | `11kV` / `33kV` — selected first, drives kVA options |
| kVA Rating | Dropdown | ✅ | Filtered by Network Voltage from `transformer_ratings` table |
| Display Rating | Read-only | — | Auto-composed e.g. `315kVA/11kV` — shown prominently |
| Secondary Voltage | Dropdown | | `415V` / `240V` / `Other` |
| Phase Type | Dropdown | | `Single Phase` / `Three Phase` |
| Cooling Type | Dropdown | | `ONAN` / `ONAF` / `OFAF` |
| Mounting Type | Dropdown | | `Pole Mounted` / `Plinth` / `Ground` / `Indoor Substation` |
| Vector Group | Text | | Optional — for engineers |

**kVA options by network voltage:**

| 11kV Network | 33kV Network |
|---|---|
| 50 / 100 / 160 / 200 / 250 / 315 / 500 / 630 / 1000 / Other | 50 / 100 / 160 / 200 / 250 / 315 / 500 / 630 / 1000 / Other |

---

#### Step 2: Location

| Field | Type | Required | Notes |
|---|---|---|---|
| Service Territory | Dropdown | ✅ | From `service_territories` table |
| Service Area | Dropdown | ✅ | Filtered by territory from `service_areas` table |
| Feeder Name | Text | | |
| Feeder Code | Text | | Optional |
| Substation Name | Text | | Optional |
| District | Dropdown | | From `districts` table |
| Sub-county | Text | | |
| Parish | Text | | |
| Village / Area | Text | | |
| Site Name | Text | ✅ | Common local name for the location |

**GPS Capture** — show two options:

- **Option A — Capture GPS Now:** Button that calls `navigator.geolocation.getCurrentPosition()`. On success, display: latitude, longitude, accuracy in metres. Show a spinner while capturing.
- **Option B — Enter Manually:** Latitude and longitude text inputs.

Show the captured coordinates on a small Mapbox mini-map preview after capture.

---

#### Step 3: Identity & Installation

| Field | Type | Notes |
|---|---|---|
| Manufacturer | Text | |
| Manufacturer Serial Number | Text | Used for duplicate checking |
| Year of Manufacture | Number | Range: 1950 to current year |
| UEDCL Internal Reference | Text | Optional — migration field |
| Installation Date | Date picker | |
| Installing Contractor / Team | Text | |
| Commissioned By | Text | |
| Commissioning Date | Date picker | |
| Warranty Expiry | Date picker | Optional |

---

#### Step 4: Photos

Upload interface for 4 photo categories (multiple files each):

| Category | Notes |
|---|---|
| Nameplate | Should clearly show kVA and voltage ratings |
| Full Transformer | Overall view of the unit |
| Site / Environment | Surrounding area |
| Installation | Installation/commissioning photos |

- Show thumbnail previews after file selection
- Compress images client-side before upload (install `browser-image-compression`)
- Upload to Supabase Storage bucket: `asset-photos`
- Store photo records in `asset_photos` table after transformer is saved

---

#### Form Behaviour

- Validate required fields before allowing the **Next** button
- On final submit:
  1. Save transformer record to database
  2. `asset_id` auto-generates via database trigger (`TRF-000001` format)
  3. Check serial number against existing records — if match found, show warning: _"A transformer with this serial number already exists. Please verify this is not a duplicate."_ — allow user to proceed or cancel
  4. Upload all photos, link to transformer record
  5. Add timeline entry: _"Transformer registered"_
  6. Redirect to the new transformer's profile page
- Show a loading state and progress indicator during save

---

### Part 2 — Transformer Asset List Page

**File:** `src/pages/TransformersPage.tsx`  
**Route:** `/transformers`

#### Table Columns

| Column | Notes |
|---|---|
| Asset ID | Bold, monospace font |
| Rating | Badge format: `315kVA / 11kV` — network voltage in coloured pill (teal=11kV, navy=33kV) |
| Site Name | |
| Territory | |
| Service Area | |
| Status | Coloured badge: green=Active, red=Faulty, blue=Under Maintenance, gray=Decommissioned, purple=Unverified |
| Last Inspection | Date or "Never" in red if null |
| Open Fault | Red ⚠ icon if `has_open_fault = true` |

- Pagination: 25 rows per page with page controls
- Click any row → navigate to `/transformers/:id`
- Sort by clicking column headers

#### Search

- Search bar at the top — searches across: `asset_id`, `serial_number`, `site_name`, `uedcl_reference`
- Results update as user types (debounced 300ms)

#### Filter Panel

Collapsible panel (shown/hidden via a Filter button):

| Filter | Type |
|---|---|
| Service Territory | Dropdown |
| Network Voltage | Radio: All / 11kV only / 33kV only |
| kVA Rating | Multi-select checkboxes |
| Operational Status | Multi-select checkboxes |
| Has Open Fault | Toggle: All / Yes / No |
| Last Inspected Before | Date picker — shows overdue assets |

- "Clear All Filters" button
- Show active filter count badge on the Filter button

#### Action Bar

- **"+ Add Transformer"** button — navigates to `/transformers/new`  
  _(Only visible if `can('add_transformer')`)_
- **"Export"** dropdown — Excel and CSV exports (implemented in Prompt 10)
- Showing count: _"Showing 47 of 2,341 transformers"_

---

## Notes

> The kVA dropdown **must** filter dynamically based on network voltage selection. Do not show 33kV ratings when 11kV is selected and vice versa. This is a critical business rule.

> GPS capture requires HTTPS in production. In development, it works on localhost.

> Photo uploads require the `asset-photos` Supabase Storage bucket to exist with public access enabled.

> Install `browser-image-compression` for client-side photo compression before upload.
