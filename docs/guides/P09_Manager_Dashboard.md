# Prompt 09 — Manager Dashboard

**Phase:** 06 — Manager Dashboard & Reporting  
**Depends on:** Prompt 08 complete — all field activity forms working

---

## Context

All field activity modules are complete. Now build the manager dashboard — the primary decision-making view for UEDCL leadership. This screen must give the transformer manager complete operational visibility without requiring any report submissions.

---

## Install Dependencies

```bash
npm install recharts date-fns
```

---

## Task

**File:** `src/pages/DashboardPage.tsx`  
**Route:** `/`  
**Access:** Super Admin, Engineer, Viewer (full data); Territory Manager (own territory only)

---

## Data Scoping

```typescript
// Territory Manager: filter all queries by their territory_id
// All other authorised roles: no filter — full data
const territoryFilter = user.role === 'territory_manager'
  ? { territory_id: user.territory_id }
  : {}
```

If Territory Manager: show a banner at the top:
> _"Showing data for: Central Service Territory"_

---

## 1. KPI Strip

Horizontal row of metric cards at the top of the page.

| Tile | Query |
|---|---|
| Total Transformers | `COUNT(*) FROM transformers` |
| Active | `COUNT(*) WHERE operational_status = 'active'` |
| Faulty | `COUNT(*) WHERE has_open_fault = true` |
| Under Maintenance | `COUNT(*) WHERE operational_status = 'under_maintenance'` |
| Decommissioned | `COUNT(*) WHERE operational_status = 'decommissioned'` |
| 11kV Network Total | `COUNT(*) WHERE network_voltage_kv = 11` |
| 33kV Network Total | `COUNT(*) WHERE network_voltage_kv = 33` |

Each card: large number, descriptive label, relevant icon.

**Make KPI cards clickable** — they pre-filter the transformers list:
- Clicking "Faulty" → opens `/transformers?status=faulty`
- Clicking "11kV Network Total" → opens `/transformers?network=11`
- etc.

---

## 2. Alert Panel

Always visible if any alerts exist. Fetch from Supabase on load.

### 🔴 Red (Critical)

**Open faults — Critical or Complete Outage severity:**
```sql
SELECT COUNT(*) FROM fault_records
WHERE fault_status NOT IN ('resolved', 'closed')
AND severity IN ('critical', 'complete_outage')
```

**Faults unresolved for more than 7 days:**
```sql
SELECT COUNT(*) FROM fault_records
WHERE fault_status NOT IN ('resolved', 'closed')
AND fault_datetime < now() - interval '7 days'
```

**Transformers not inspected in 180+ days:**
```sql
SELECT COUNT(*) FROM transformers
WHERE (last_inspection_date < now() - interval '180 days'
  OR last_inspection_date IS NULL)
AND operational_status != 'decommissioned'
```

### 🟠 Orange (High)

**Overloaded transformers (load >= 90% in most recent inspection):**
```sql
-- Most recent inspection per transformer where load_percentage >= 90
```

**Inspections recommending urgent repair or replacement (last 30 days):**
```sql
SELECT COUNT(*) FROM inspections
WHERE recommended_action IN ('urgent_repair', 'replace')
AND created_at > now() - interval '30 days'
```

### 🟡 Yellow (Normal)

**Transformers not inspected in 90+ days (but < 180):**
```sql
SELECT COUNT(*) FROM transformers
WHERE last_inspection_date < now() - interval '90 days'
AND last_inspection_date >= now() - interval '180 days'
AND operational_status != 'decommissioned'
```

**Unverified transformers:**
```sql
SELECT COUNT(*) FROM transformers WHERE record_status = 'unverified'
```

### Alert Panel Layout

Each alert row:
```
[🔴 icon]  Critical Faults Open: 3          [View All →]
[🔴 icon]  Faults Unresolved > 7 days: 7    [View All →]
[🟠 icon]  Overloaded Transformers: 12       [View All →]
[🟡 icon]  Overdue Inspection (90+ days): 47 [View All →]
```

"View All" links pre-filter the relevant list page.  
If all alerts are zero: hide the alert panel entirely (show a green banner: _"No active alerts"_).

---

## 3. Two-Column Layout

Below the alert panel:

- **Left (60%):** Charts
- **Right (40%):** Activity Feed

---

### Charts (use Recharts)

**Chart 1 — Transformers by Service Territory**  
`BarChart` — one bar per territory, colour by dominant status

**Chart 2 — 11kV vs 33kV Network Split**  
`PieChart` (donut) — two segments, teal for 11kV, navy for 33kV

**Chart 3 — Transformers by kVA/Network Rating (Grouped Bar)**
```
X-axis: kVA values (50, 100, 160, 200, 250, 315, 500, 630, 1000)
Two bars per group:
  - 11kV count (teal)
  - 33kV count (navy)
```

**Chart 4 — Fault Trends — Last 12 Months (Line Chart)**
```
X-axis: months (Jan–Dec)
Two lines:
  - 11kV faults (teal)
  - 33kV faults (navy)
Data: fault_records grouped by month and network_voltage_kv
```

**Chart 5 — Inspections This Month vs Last Month**  
Simple `BarChart` comparison — two bars side by side

---

### Activity Feed

- Real-time list of the latest 20 `asset_timeline` entries across all assets
- Each entry:
  - Timestamp (relative: "2 hours ago", "Yesterday")
  - Transformer Asset ID (clickable link to profile)
  - Rating badge `[315kVA / 11kV]`
  - Event type icon
  - Event summary text
- Auto-refreshes every 60 seconds
- Alternatively: use Supabase real-time subscription:

```typescript
supabase
  .channel('asset_timeline_feed')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'asset_timeline'
  }, (payload) => {
    // prepend to feed
  })
  .subscribe()
```

---

## 4. Decision Support Tables

Tabbed section at the bottom of the dashboard. These tables directly support the manager's three key decisions: Repair, Replace, Load Split.

---

**Tab 1 — Repair Candidates**

```sql
SELECT f.*, t.asset_id, t.site_name, t.kva_rating, t.network_voltage_kv,
       t.territory_id,
       EXTRACT(EPOCH FROM (now() - f.fault_datetime))/86400 AS days_open
FROM fault_records f
JOIN transformers t ON f.transformer_id = t.id
WHERE f.fault_status NOT IN ('resolved', 'closed')
ORDER BY
  CASE f.severity
    WHEN 'complete_outage' THEN 1
    WHEN 'critical' THEN 2
    WHEN 'major' THEN 3
    ELSE 4
  END,
  days_open DESC
```

Columns: Asset ID | Rating (kVA/Network) | Site | Territory | Fault Type | Severity | Days Open | Assigned To

---

**Tab 2 — Replacement Candidates**

```sql
SELECT t.*,
  (EXTRACT(YEAR FROM now()) - t.year_manufactured) AS age_years,
  COUNT(f.id) AS fault_count_24m
FROM transformers t
LEFT JOIN fault_records f ON f.transformer_id = t.id
  AND f.fault_datetime > now() - interval '2 years'
WHERE
  (EXTRACT(YEAR FROM now()) - t.year_manufactured) > 20
  OR t.id IN (
    SELECT transformer_id FROM fault_records
    WHERE fault_datetime > now() - interval '2 years'
    GROUP BY transformer_id HAVING COUNT(*) >= 3
  )
GROUP BY t.id
ORDER BY fault_count_24m DESC, age_years DESC
```

Columns: Asset ID | Rating (kVA/Network) | Site | Territory | Age (years) | Fault Count (24 months) | Last Condition

---

**Tab 3 — Load Split Candidates**

Query: latest inspection per transformer where `load_percentage >= 80`:

Columns: Asset ID | Rating (kVA/Network) | Site | Feeder | Territory | Load % | Last Reading Date

**Show load % as a coloured progress bar:**
- `< 80%` → green
- `80–89%` → amber
- `>= 90%` → red

---

## Notes

> Use **Recharts** — do not use Chart.js or other libraries.

> The decision support tables are the highest-value feature for the UEDCL manager. Make them load fast, be easy to read, and have clear visual hierarchy.

> All charts must correctly show 11kV and 33kV as separate data series — never aggregate them.
