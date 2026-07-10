# kVAssetTracker — AI Coding Agent Build Prompts

**Platform:** Transformer Asset Registry & Field Maintenance Platform for UEDCL  
**Stack:** React + TypeScript + Tailwind · Supabase · Mapbox · Dexie.js · Vite PWA  
**Prepared by:** Kenogo · AKTIVATE · June 2026

---

## How to Use These Prompts

These are **12 sequential prompts** across 8 build phases. Each prompt must be completed and verified before moving to the next.

**Tools:** Designed for Claude Code or Lovable.dev. Copy and paste each prompt directly into the agent.

> ⚠️ **Critical Rule:** Do not skip or combine prompts. Each one hands off cleanly to the next. The order is mandatory.

---

## Before You Start — One-Time Setup

Complete these steps **before running Prompt 01**:

- [ ] Create a new project on Lovable.dev (or initialise a Vite + React + TypeScript project locally)
- [ ] Create a new Supabase project at [supabase.com](https://supabase.com) — note your project URL and anon key
- [ ] Create a Mapbox account at [mapbox.com](https://mapbox.com) — note your public access token
- [ ] Have the **kVAssetTracker PRD v2.0** document open for reference
- [ ] Name your project: `kvassettracker`

---

## Prompt Sequence

| # | File | Phase | Builds |
|---|---|---|---|
| 01 | [P01_Project_Setup_Foundation.md](P01_Project_Setup_Foundation.md) | Foundation | Project scaffold, Tailwind design system, TypeScript types, Supabase client |
| 02 | [P02_Authentication_RBAC.md](P02_Authentication_RBAC.md) | Foundation | Auth system, login page, RBAC permission matrix, navigation shell, user management |
| 03 | [P03_Database_Schema.md](P03_Database_Schema.md) | Database | Complete Supabase SQL schema, all tables, RLS, seed data, typed helpers |
| 04 | [P04_Registration_Form_Asset_List.md](P04_Registration_Form_Asset_List.md) | Asset Registry | 4-step transformer registration form, asset list with search and filters |
| 05 | [P05_GPS_Map.md](P05_GPS_Map.md) | Mapping | Mapbox map, colour-coded markers, clustering, filter panel, search, popups |
| 06 | [P06_QR_Asset_Profile.md](P06_QR_Asset_Profile.md) | QR & Profile | QR generation and scanning, 7-tab asset profile page, lifecycle timeline |
| 07 | [P07_Inspection_Maintenance_Forms.md](P07_Inspection_Maintenance_Forms.md) | Field Activity | Inspection form with live load calculator, maintenance form |
| 08 | [P08_Fault_Installation_Forms.md](P08_Fault_Installation_Forms.md) | Field Activity | Fault reporting, fault-to-fix workflow, installation and replacement records |
| 09 | [P09_Manager_Dashboard.md](P09_Manager_Dashboard.md) | Dashboard | KPI strip, alert panel, 5 charts, activity feed, 3 decision support tables |
| 10 | [P10_Report_Exports.md](P10_Report_Exports.md) | Reports | Excel and CSV exports, PDF district summary, reports page |
| 11 | [P11_Offline_PWA.md](P11_Offline_PWA.md) | Offline | Service worker, IndexedDB/Dexie.js, offline form queue, auto-sync |
| 12 | [P12_Bulk_Import.md](P12_Bulk_Import.md) | Import | Excel/CSV import, column mapping, validation, preview, rollback |

---

## Phase Summary

| Phase | Prompts | Outcome |
|---|---|---|
| **01 — Foundation** | P01–P02 | Working app shell with auth, roles, and navigation |
| **02 — Database & Registry** | P03–P04 | All tables created, transformers can be registered and listed |
| **03 — GPS Mapping** | P05 | Every transformer visible on an interactive Uganda map |
| **04 — QR & Profile** | P06 | Full asset profile with QR codes and complete lifecycle timeline |
| **05 — Field Activity** | P07–P08 | All field forms: inspection, maintenance, fault reporting, installation |
| **06 — Dashboard & Reports** | P09–P10 | Management dashboard with live data, all report exports |
| **07 — Offline PWA** | P11 | App works fully offline, syncs automatically on reconnection |
| **08 — Bulk Import** | P12 | Existing UEDCL records can be migrated via Excel/CSV |

---

## Key Business Rules (Apply Throughout All Prompts)

These rules must be respected by every feature in every prompt:

1. **11kV and 33kV transformers are always distinct.** A 315kVA/11kV transformer and a 315kVA/33kV transformer are different assets. Never aggregate them.

2. **Network Voltage drives kVA selection.** On any form with a kVA dropdown, the options must be filtered by the selected network voltage.

3. **Asset ID never changes.** The `TRF-000001` format ID is permanent and system-generated. Never allow manual entry.

4. **Timeline entries are automatic.** Every form submission must call `addTimelineEntry()`. The asset lifecycle timeline must build itself without manual steps.

5. **Downtime is calculated, never entered.** `downtime_hours = resolved_date - fault_datetime`. Never show a manual input field for downtime.

6. **RBAC is enforced everywhere.** Use `canDo()` or `can()` to control button visibility and route access. Territory Manager always sees only their territory's data.

7. **Offline is non-negotiable.** All field forms must queue submissions when offline and sync on reconnection.

---

## Post-Build Verification Checklist

After completing all 12 prompts, verify each item before presenting to UEDCL:

- [ ] Transformer registers with 11kV/33kV network voltage correctly filtering kVA options
- [ ] GPS capture works on mobile browser
- [ ] Transformer appears on map immediately after registration
- [ ] QR code generates, downloads as PNG, and scans to open correct profile
- [ ] Asset ID (TRF-000001 format) auto-generates on creation
- [ ] Inspection form calculates load % in real time and flags overload
- [ ] Fault with Critical severity triggers immediate manager notification
- [ ] Replacement workflow decommissions previous transformer automatically
- [ ] Asset timeline builds automatically from all form submissions
- [ ] Manager dashboard shows all 7 KPI tiles, alert panel, 5 charts, 3 decision tables
- [ ] All 4 report exports generate correctly (Excel and PDF)
- [ ] App works fully offline — forms submittable with no internet
- [ ] Records sync automatically on reconnection
- [ ] Bulk import handles Excel and CSV with column mapping and validation
- [ ] RBAC enforced — Field Technician cannot see manager dashboard
- [ ] Territory Manager sees only their territory's data
- [ ] 11kV and 33kV transformers consistently distinguished throughout

---

## Pre-Demo Sample Data

Before showing to UEDCL, load at least 20 sample transformers including:

- [ ] At least 2 Service Territories (Central and Northern minimum)
- [ ] Both 11kV and 33kV transformers represented
- [ ] Mix of kVA ratings: 100kVA, 315kVA, 500kVA minimum
- [ ] Mix of statuses: Active, Faulty, Under Maintenance
- [ ] At least 3 transformers with inspection records
- [ ] At least 2 open faults (one Critical) to populate the alert panel
- [ ] At least 1 transformer with complete lifecycle: installed → inspected → faulted → repaired
- [ ] Sample data distributed across Uganda's map — not all clustered in Kampala

---

*kVAssetTracker · Prepared by Kenogo · AKTIVATE · June 2026*
