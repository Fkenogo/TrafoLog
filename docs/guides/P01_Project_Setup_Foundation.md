# Prompt 01 — Project Setup & Supabase Foundation

**Phase:** 01 — Foundation & Authentication  
**Build Order:** Run this first. All other prompts depend on this output.

---

## Context

You are building **kVAssetTracker** — a transformer asset management platform for Uganda Electricity Distribution Company Ltd (UEDCL).

This is a single-organisation platform used by:
- Field maintenance technicians logging inspections, maintenance, and faults in the field (often offline)
- Territory managers and engineers monitoring transformer fleet status
- UEDCL senior management making repair, replacement, and investment decisions

The platform manages transformers across two distribution network voltages: **11kV and 33kV**. A 315kVA transformer on an 11kV network and one on a 33kV network are completely different assets. This distinction must be maintained throughout the entire system.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend / Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Maps | Mapbox GL JS |
| Offline | Dexie.js (IndexedDB) |
| PWA | vite-plugin-pwa |
| Charts | Recharts |
| Exports | SheetJS (xlsx) + jsPDF |
| Hosting | Vercel |

---

## Task

Set up the complete project foundation. **Do NOT build any pages yet.**

### 1. Vite + React + TypeScript Project

- Initialise with Vite using the React + TypeScript template
- Configure Tailwind CSS with this custom design system:

```
Primary (navy):    #0F2544
Accent (teal):     #0D7377
Warning (orange):  #C2410C
Success (green):   #15803D
Neutral (gray):    #6B7280
Background:        #F8FAFC
Light teal:        #E0F4F4
Light orange:      #FFF3ED
Light gray:        #F8FAFC
```

### 2. Supabase Client Setup

- Install `@supabase/supabase-js`
- Create `src/lib/supabase.ts` with Supabase client initialisation
- Use environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Create a `.env.example` file documenting all required environment variables

### 3. Project Folder Structure

Create this exact structure:

```
src/
  components/       ← reusable UI components
  pages/            ← page-level components
  hooks/            ← custom React hooks
  lib/              ← supabase client, utilities, helpers
  types/            ← TypeScript interfaces and enums
  store/            ← global state if needed
```

### 4. TypeScript Types

Create `src/types/index.ts` with the following:

```typescript
// Enums
export enum Role {
  SUPER_ADMIN       = 'super_admin',
  TERRITORY_MANAGER = 'territory_manager',
  ENGINEER          = 'engineer',
  FIELD_TECHNICIAN  = 'field_technician',
  VIEWER            = 'viewer',
}

export enum OperationalStatus {
  ACTIVE           = 'active',
  FAULTY           = 'faulty',
  UNDER_MAINTENANCE = 'under_maintenance',
  DECOMMISSIONED   = 'decommissioned',
  UNVERIFIED       = 'unverified',
}

export enum NetworkVoltage {
  KV11 = 11,
  KV33 = 33,
}

export enum RecordStatus {
  DRAFT    = 'draft',
  VERIFIED = 'verified',
  ACTIVE   = 'active',
}

// Core interfaces
export interface User {
  id: string
  name: string
  email: string
  role: Role
  territory_id: string | null
  service_area_id: string | null
  is_active: boolean
  created_at: string
}

export interface ServiceTerritory {
  id: string
  name: string
  code: string
}

export interface ServiceArea {
  id: string
  territory_id: string
  name: string
  location_town: string | null
}

export interface District {
  id: string
  name: string
  region: string | null
}

export interface Feeder {
  id: string
  service_area_id: string
  name: string
  code: string | null
  network_voltage_kv: 11 | 33
}

export interface TransformerRating {
  id: string
  kva: number
  network_voltage_kv: 11 | 33
  display_label: string   // e.g. "315kVA/11kV"
}

export interface Transformer {
  id: string
  asset_id: string                          // TRF-000001 format
  uedcl_reference: string | null
  manufacturer: string | null
  serial_number: string | null
  year_manufactured: number | null
  rating_id: string | null
  kva_rating: number | null
  network_voltage_kv: 11 | 33 | null        // CRITICAL FIELD
  voltage_secondary: string | null
  phase_type: string | null
  cooling_type: string | null
  mounting_type: string | null
  vector_group: string | null
  territory_id: string | null
  service_area_id: string | null
  feeder_id: string | null
  substation_name: string | null
  district_id: string | null
  sub_county: string | null
  parish: string | null
  village: string | null
  site_name: string | null
  latitude: number | null
  longitude: number | null
  gps_method: string | null
  gps_accuracy: number | null
  install_date: string | null
  installing_contractor: string | null
  commissioned_by: string | null
  commissioning_date: string | null
  warranty_expiry: string | null
  operational_status: OperationalStatus
  record_status: RecordStatus
  last_inspection_date: string | null
  last_maintenance_date: string | null
  last_load_reading_date: string | null
  has_open_fault: boolean
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export interface Inspection {
  id: string
  transformer_id: string
  inspector_id: string
  inspection_date: string
  visit_type: string | null
  gps_lat: number | null
  gps_lng: number | null
  network_voltage_confirmed: boolean | null
  kva_rating_confirmed: boolean | null
  rating_discrepancy_flag: boolean
  rust_condition: string | null
  oil_leakage: string | null
  bushing_condition: string | null
  tank_damage: string | null
  cooling_fins_condition: string | null
  oil_level: string | null
  silica_gel_color: string | null
  oil_test_required: boolean | null
  load_phase_a: number | null
  load_phase_b: number | null
  load_phase_c: number | null
  voltage_hv: number | null
  voltage_lv: number | null
  load_percentage: number | null
  overload_flag: boolean
  security_fencing: string | null
  earthing: string | null
  warning_signs: string | null
  vegetation_encroachment: string | null
  unauthorized_connections: boolean | null
  condition_narrative: string | null
  recommended_action: string | null
  created_at: string
}

export interface MaintenanceRecord {
  id: string
  transformer_id: string
  technician_id: string
  maintenance_date: string
  maintenance_type: string | null
  team_contractor: string | null
  supervised_by: string | null
  oil_topup: boolean | null
  oil_topup_liters: number | null
  oil_replacement: boolean | null
  oil_filtration: boolean | null
  silica_gel_replaced: boolean | null
  bushing_replacement: boolean | null
  tap_changer_service: boolean | null
  cooling_service: boolean | null
  physical_cleaning: boolean | null
  other_work: string | null
  parts_used: string | null
  post_condition_narrative: string | null
  load_after_a: number | null
  load_after_b: number | null
  load_after_c: number | null
  completed_by: string | null
  reviewed_by: string | null
  next_maintenance_date: string | null
  created_at: string
}

export interface FaultRecord {
  id: string
  transformer_id: string
  reported_by: string
  fault_datetime: string
  fault_source: string | null
  fault_description: string | null
  fault_type: string | null
  severity: 'minor' | 'major' | 'critical' | 'complete_outage' | null
  network_voltage_kv: 11 | 33 | null
  customers_affected: number | null
  area_affected: string | null
  fault_status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  assigned_to: string | null
  date_assigned: string | null
  target_resolution: string | null
  resolved_date: string | null
  resolution_description: string | null
  root_cause: string | null
  parts_replaced: string | null
  downtime_hours: number | null
  resolved_by: string | null
  created_at: string
}

export interface InstallationRecord {
  id: string
  transformer_id: string
  installation_date: string
  installation_type: 'new_installation' | 'replacement' | 'relocation' | null
  previous_transformer_id: string | null
  replacement_reason: string | null
  network_voltage_kv: 11 | 33 | null
  kva_rating: number | null
  installing_team: string | null
  supervised_by: string | null
  transformer_source: string | null
  pre_install_test_results: string | null
  commissioning_readings: string | null
  commissioned_by: string | null
  handover_date: string | null
  created_at: string
}

export interface AssetPhoto {
  id: string
  transformer_id: string
  photo_category: string
  image_url: string
  captured_by: string | null
  captured_at: string
  linked_record_type: string | null
  linked_record_id: string | null
}

export interface AssetTimelineEntry {
  id: string
  transformer_id: string
  event_type: string
  event_summary: string
  linked_record_type: string | null
  linked_record_id: string | null
  created_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  message: string
  linked_record_type: string | null
  linked_record_id: string | null
  is_read: boolean
  created_at: string
}
```

### 5. Verify

Run `npm run dev` — the app should start without TypeScript errors.

---

## Notes

> **Replace** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your `.env` file with your actual Supabase project values before running.

> The folder structure must be created exactly as specified — all subsequent prompts depend on it.

> Do **not** build any pages or UI in this prompt. Foundation only.
