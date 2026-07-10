# Prompt 05 — Interactive Transformer Map

**Phase:** 03 — GPS Mapping  
**Depends on:** Prompt 04 complete — transformer registration and list working

---

## Context

Asset registration and the transformer list are working. Now build the GPS mapping module, which gives management a live geographic view of the entire transformer fleet.

---

## Install Dependencies

```bash
npm install mapbox-gl @types/mapbox-gl react-map-gl
```

Add your Mapbox token to `.env`:
```
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here
```

---

## Task

**File:** `src/pages/MapPage.tsx`  
**Route:** `/map`

### 1. Mapbox Setup

- Use `VITE_MAPBOX_TOKEN` environment variable
- Initial view: Uganda — centre `[32.2903, 1.3733]`, zoom `7`
- Map style: `mapbox://styles/mapbox/light-v11`
- Map fills the available viewport (full height minus navigation)

### 2. Transformer Markers

Load all transformers that have GPS coordinates. For performance, **only fetch these fields** (not the full record):

```
id, asset_id, site_name, kva_rating, network_voltage_kv,
operational_status, has_open_fault, last_inspection_date,
latitude, longitude
```

Render each transformer as a circle marker, colour-coded by status:

| Status | Colour |
|---|---|
| Active — no open fault | `#15803D` green |
| Active — overdue inspection (90+ days) | `#CA8A04` amber |
| Faulty / has open fault | `#DC2626` red |
| Under Maintenance | `#2563EB` blue |
| Decommissioned | `#6B7280` gray |
| Unverified | `#9333EA` purple |

**Clustering:**
- Use Mapbox clustering for markers when zoomed out
- Cluster bubble shows the count of transformers
- Cluster colour reflects the worst status within it (red if any faulty, amber if any overdue, etc.)
- Clusters expand to individual markers on zoom in

### 3. Marker Popup

Clicking a marker opens a popup card:

```
[Asset ID]          [Rating Badge: 315kVA / 11kV]
Site Name: Nakawa Market
Status: [Faulty - red badge]
Last Inspection: 14 Mar 2024  (or "Never inspected" in red)
[⚠ Open Fault]   (shown in red if has_open_fault = true)

[View Full Record →]
```

"View Full Record" button navigates to `/transformers/:id`.

### 4. Map Filter Panel

Collapsible panel overlaid on the map (top-left):

| Filter | Type |
|---|---|
| Service Territory | Dropdown |
| Service Area | Dropdown (filtered by territory) |
| Network Voltage | Radio: All / 11kV only / 33kV only |
| kVA Rating | Multi-select |
| Operational Status | Multi-select |
| Has Open Fault | Toggle |
| Last Inspected Before | Date picker |

- Filters apply in real time — markers update without page reload
- "Reset Filters" button clears all
- Show count of currently visible transformers

### 5. Map Legend

Fixed position (bottom-right corner):
- All 6 status colours with labels
- Total visible transformer count: _"Showing 1,247 transformers"_

### 6. Search on Map

Search bar at the top of the map:
- Search by: Asset ID, Site Name, Serial Number
- On match: fly to the transformer's location (zoom 15) and open its popup
- If no match: show "Not found" message

### 7. View Toggle

Button in the header or map controls area to toggle between:
- **Map View** (this page)
- **List View** (the TransformersPage component)

Both views share the same filter state so switching preserves filters.

---

## Notes

> Always use clustering — never render all markers individually. Mapbox clustering handles 10,000+ markers efficiently.

> Supabase query for map data: use `.select()` with only the fields listed above to keep the payload small and fast.

> Test the map with at least 20 sample transformer records distributed across Uganda before considering this prompt complete.
