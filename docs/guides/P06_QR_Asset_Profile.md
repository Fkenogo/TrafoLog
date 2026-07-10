# Prompt 06 — QR Code System & Asset Profile Page

**Phase:** 04 — QR Codes & Asset Profile  
**Depends on:** Prompt 05 complete — map working

---

## Context

Mapping is complete. Now build the QR code system and the full 7-tab asset profile page. The asset profile is the most important screen in the system — every transformer's complete digital record lives here.

---

## Install Dependencies

```bash
npm install qrcode @types/qrcode react-qr-reader
```

---

## Task

### Part 1 — QR Code Generation

**File:** `src/lib/qr.ts`

#### QR Code Format

```
KVASSET-{assetId}-{shortUUID}
Example: KVASSET-TRF-000042-a1b2c3
```

The QR code encodes the URL: `{appBaseUrl}/transformers/{transformerId}`  
Opening the URL requires login — the QR does not expose data publicly.

#### Functions to Implement

```typescript
// Generate a QR code, save to qr_codes table, return PNG data URL
generateQRCode(transformerId: string, assetId: string): Promise<string>

// Download QR code as PNG file
downloadQRCode(assetId: string): void

// Update last_scanned_at when QR is scanned
recordQRScan(qrCodeString: string): Promise<void>
```

#### UI Elements (added to transformer profile header)

- **"Generate QR Code"** button — visible to Engineers and above
- If QR already exists: show rendered QR code image
- **"Download QR Code"** button — downloads as PNG
- **"Regenerate"** option — marks old QR inactive, generates new one
- QR code records `last_scanned_at` timestamp on each successful scan

---

### Part 2 — QR Code Scanner

**File:** `src/components/QRScanner.tsx`

- Camera-based QR scanner using `react-qr-reader`
- Accessible from main navigation and field technician dashboard
- On successful scan:
  1. Parse the `KVASSET-...` string
  2. Call `recordQRScan()` to update timestamp
  3. Navigate to the correct transformer profile
- If QR code not found or invalid: show clear error message
- Fallback: _"Enter Asset ID manually"_ text input field that does the same lookup

---

### Part 3 — Asset Profile Page

**File:** `src/pages/TransformerProfilePage.tsx`  
**Route:** `/transformers/:id`

---

#### Header Section (always visible)

```
TRF-000234                              [315kVA / 11kV]  [Three Phase]
Nakawa Market Distribution Substation
────────────────────────────────────────────────────────
Territory: Central  |  Service Area: Kampala East  |  Feeder: F04-Nakawa (11kV)
Mounting: Pole Mounted  |  Status: [● FAULTY]

[⚠ OPEN FAULT — Oil Leak — Reported 3 days ago]   ← red banner, shown if has_open_fault

[Log Visit]  [Report Fault]  [Generate QR]  [Edit Record]
```

Action button visibility based on `canDo()` permissions.

---

#### Tab Navigation

Build all 7 tabs. Each tab loads its data lazily (only fetches when tab is first opened).

---

**Tab 1 — Overview**

Two-column layout:

| Left Column | Right Column |
|---|---|
| All technical specifications | Small Mapbox map showing GPS pin |
| Manufacturer, serial, year | UEDCL hierarchy (Territory → Service Area → Feeder) |
| Phase, cooling, mounting | Admin location (District → Parish → Village) |
| Secondary voltage | GPS method and accuracy |
| Vector group | Key dates table |

Key dates table:
- Installation Date
- Last Inspection Date (red if > 90 days ago)
- Last Maintenance Date
- Last Load Reading Date
- Warranty Expiry

---

**Tab 2 — Inspections**

- List of all inspection records, newest first
- Each card shows:
  - Date and inspector name
  - Visit type badge
  - Condition indicators (colour-coded icons for rust, oil, bushings)
  - Load readings (Phase A / B / C) and calculated load %
  - Overload flag warning if applicable
  - Recommended action badge
  - Photo thumbnail strip
- Click card to expand full inspection detail

---

**Tab 3 — Maintenance**

- List of all maintenance records, newest first
- Each card shows:
  - Date, type, team/contractor
  - Work performed as a checklist with ✓/✗ icons
  - Post-maintenance condition narrative
  - Next maintenance date
  - Photo thumbnails

---

**Tab 4 — Faults**

- Open faults shown at top with red background
- All fault records listed, newest first
- Each card shows:
  - Fault date and type
  - Severity badge (colour-coded)
  - Status badge (Open / Assigned / In Progress / Resolved)
  - If open: assigned to, target resolution date
  - If resolved: downtime hours, resolution summary
- **Assign to Team** button (Manager / Engineer only) on open faults
- **Resolve Fault** button on open/in-progress faults

---

**Tab 5 — Installations**

- List of installation records
- Each entry shows: date, type, team, commissioning notes
- If replacement: shows link to previous transformer (clickable asset ID)
- If this transformer replaced another: shows "Replaced by" link

---

**Tab 6 — Photos**

- Masonry grid gallery
- Category filter tabs: All / Nameplate / Installation / Inspection / Fault / Maintenance
- Each photo shows: category badge, date captured, captured by
- Click photo → opens lightbox with full-size view, navigation between photos

---

**Tab 7 — Timeline (Asset Lifecycle)**

Chronological feed, newest first, of every event in the transformer's history.

| Event Type | Icon | Colour |
|---|---|---|
| REGISTERED | 📋 | Gray |
| INSPECTED | 🔍 | Blue |
| MAINTENANCE | 🔧 | Green |
| FAULT_REPORTED | ⚠️ | Orange |
| FAULT_RESOLVED | ✅ | Green |
| INSTALLED | ⚡ | Teal |
| REPLACED | 🔄 | Navy |
| DECOMMISSIONED | 🚫 | Red |

Each entry:
- Icon + event type label
- Date and time
- Event summary text
- Linked record ID (clickable — opens the related inspection/fault/maintenance record)
- Created by (user name)

Timeline populates from the `asset_timeline` table. Entries are created automatically by each form submission via the `addTimelineEntry()` helper.

---

## Shared Helper

Ensure `addTimelineEntry()` in `src/lib/supabase-helpers.ts` is called at the end of every form submission throughout the app:

```typescript
await addTimelineEntry(
  transformerId,
  'INSPECTED',
  'Inspection completed — Recommended action: Schedule Maintenance',
  'inspection',
  inspectionId
)
```

---

## Notes

> QR codes require HTTPS for camera access in the browser. In development on localhost, this is fine. In production on Vercel, HTTPS is automatic.

> The asset profile page is the most important page in the system. Invest time making it clean, fast, and easy to navigate on mobile.

> Lazy tab loading is essential for performance — do not fetch all 7 tabs' data on page load.
