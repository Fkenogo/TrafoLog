# Prompt 03 — Complete Supabase Database Schema

**Phase:** 02 — Database & Asset Registry  
**Depends on:** Prompts 01 and 02 complete and verified

---

## Context

Authentication and navigation shell are working. Now create the complete database schema in Supabase. Run the SQL below in the **Supabase SQL Editor** in one go.

---

## Task

### Step 1: Run This SQL in Supabase SQL Editor

```sql
-- ─────────────────────────────────────────────
-- REFERENCE / LOOKUP TABLES
-- ─────────────────────────────────────────────

CREATE TABLE service_territories (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE service_areas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID REFERENCES service_territories(id),
  name         TEXT NOT NULL,
  location_town TEXT
);

CREATE TABLE districts (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   TEXT NOT NULL,
  region TEXT
);

CREATE TABLE feeders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id  UUID REFERENCES service_areas(id),
  name             TEXT NOT NULL,
  code             TEXT,
  network_voltage_kv INTEGER NOT NULL CHECK (network_voltage_kv IN (11, 33))
);

CREATE TABLE transformer_ratings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kva                INTEGER NOT NULL,
  network_voltage_kv INTEGER NOT NULL CHECK (network_voltage_kv IN (11, 33)),
  display_label      TEXT NOT NULL,
  UNIQUE(kva, network_voltage_kv)
);

-- ─────────────────────────────────────────────
-- CORE ASSET TABLE
-- ─────────────────────────────────────────────

CREATE TABLE transformers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id              TEXT UNIQUE,                    -- auto-generated TRF-000001
  uedcl_reference       TEXT,
  manufacturer          TEXT,
  serial_number         TEXT,
  year_manufactured     INTEGER,
  rating_id             UUID REFERENCES transformer_ratings(id),
  kva_rating            INTEGER,
  network_voltage_kv    INTEGER CHECK (network_voltage_kv IN (11, 33)),  -- CRITICAL
  voltage_secondary     TEXT,
  phase_type            TEXT,
  cooling_type          TEXT,
  mounting_type         TEXT,
  vector_group          TEXT,
  territory_id          UUID REFERENCES service_territories(id),
  service_area_id       UUID REFERENCES service_areas(id),
  feeder_id             UUID REFERENCES feeders(id),
  substation_name       TEXT,
  district_id           UUID REFERENCES districts(id),
  sub_county            TEXT,
  parish                TEXT,
  village               TEXT,
  site_name             TEXT,
  latitude              DECIMAL(10,8),
  longitude             DECIMAL(11,8),
  gps_method            TEXT DEFAULT 'field_captured',
  gps_accuracy          DECIMAL,
  install_date          DATE,
  installing_contractor TEXT,
  commissioned_by       TEXT,
  commissioning_date    DATE,
  warranty_expiry       DATE,
  operational_status    TEXT DEFAULT 'unverified',
  record_status         TEXT DEFAULT 'draft',
  last_inspection_date  TIMESTAMPTZ,
  last_maintenance_date TIMESTAMPTZ,
  last_load_reading_date TIMESTAMPTZ,
  has_open_fault        BOOLEAN DEFAULT false,
  batch_import_id       UUID,                           -- for bulk import rollback
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_by            UUID REFERENCES auth.users(id),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ACTIVITY TABLES
-- ─────────────────────────────────────────────

CREATE TABLE inspections (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id             UUID REFERENCES transformers(id) ON DELETE CASCADE,
  inspector_id               UUID REFERENCES auth.users(id),
  inspection_date            TIMESTAMPTZ NOT NULL,
  visit_type                 TEXT,
  gps_lat                    DECIMAL(10,8),
  gps_lng                    DECIMAL(11,8),
  network_voltage_confirmed  BOOLEAN,
  kva_rating_confirmed       BOOLEAN,
  rating_discrepancy_flag    BOOLEAN DEFAULT false,
  rust_condition             TEXT,
  oil_leakage                TEXT,
  bushing_condition          TEXT,
  tank_damage                TEXT,
  cooling_fins_condition     TEXT,
  oil_level                  TEXT,
  silica_gel_color           TEXT,
  oil_test_required          BOOLEAN,
  load_phase_a               DECIMAL,
  load_phase_b               DECIMAL,
  load_phase_c               DECIMAL,
  voltage_hv                 DECIMAL,
  voltage_lv                 DECIMAL,
  load_percentage            DECIMAL,                   -- auto-calculated
  overload_flag              BOOLEAN DEFAULT false,     -- auto-set if load_percentage >= 90
  security_fencing           TEXT,
  earthing                   TEXT,
  warning_signs              TEXT,
  vegetation_encroachment    TEXT,
  unauthorized_connections   BOOLEAN,
  condition_narrative        TEXT,
  recommended_action         TEXT,
  created_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id            UUID REFERENCES transformers(id) ON DELETE CASCADE,
  technician_id             UUID REFERENCES auth.users(id),
  maintenance_date          TIMESTAMPTZ NOT NULL,
  maintenance_type          TEXT,
  team_contractor           TEXT,
  supervised_by             TEXT,
  oil_topup                 BOOLEAN,
  oil_topup_liters          DECIMAL,
  oil_replacement           BOOLEAN,
  oil_filtration            BOOLEAN,
  silica_gel_replaced       BOOLEAN,
  bushing_replacement       BOOLEAN,
  tap_changer_service       BOOLEAN,
  cooling_service           BOOLEAN,
  physical_cleaning         BOOLEAN,
  other_work                TEXT,
  parts_used                TEXT,
  post_condition_narrative  TEXT,
  load_after_a              DECIMAL,
  load_after_b              DECIMAL,
  load_after_c              DECIMAL,
  completed_by              TEXT,
  reviewed_by               TEXT,
  next_maintenance_date     DATE,
  created_at                TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE fault_records (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id         UUID REFERENCES transformers(id) ON DELETE CASCADE,
  reported_by            UUID REFERENCES auth.users(id),
  fault_datetime         TIMESTAMPTZ NOT NULL,
  fault_source           TEXT,
  fault_description      TEXT,
  fault_type             TEXT,
  severity               TEXT,
  network_voltage_kv     INTEGER,                      -- auto-filled from transformer
  customers_affected     INTEGER,
  area_affected          TEXT,
  fault_status           TEXT DEFAULT 'open',
  assigned_to            UUID REFERENCES auth.users(id),
  date_assigned          TIMESTAMPTZ,
  target_resolution      TIMESTAMPTZ,
  resolved_date          TIMESTAMPTZ,
  resolution_description TEXT,
  root_cause             TEXT,
  parts_replaced         TEXT,
  downtime_hours         DECIMAL,                      -- auto-calculated on resolution
  resolved_by            UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE installation_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id            UUID REFERENCES transformers(id) ON DELETE CASCADE,
  installation_date         TIMESTAMPTZ NOT NULL,
  installation_type         TEXT,
  previous_transformer_id   UUID REFERENCES transformers(id),
  replacement_reason        TEXT,
  network_voltage_kv        INTEGER,
  kva_rating                INTEGER,
  installing_team           TEXT,
  supervised_by             TEXT,
  transformer_source        TEXT,
  pre_install_test_results  TEXT,
  commissioning_readings    TEXT,
  commissioned_by           TEXT,
  handover_date             DATE,
  created_at                TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- SUPPORTING TABLES
-- ─────────────────────────────────────────────

CREATE TABLE asset_photos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id      UUID REFERENCES transformers(id) ON DELETE CASCADE,
  photo_category      TEXT,                            -- nameplate/installation/inspection/fault/maintenance
  image_url           TEXT NOT NULL,
  captured_by         UUID REFERENCES auth.users(id),
  captured_at         TIMESTAMPTZ DEFAULT now(),
  linked_record_type  TEXT,                            -- 'inspection'|'maintenance'|'fault'|'installation'
  linked_record_id    UUID
);

CREATE TABLE asset_timeline (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id      UUID REFERENCES transformers(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  event_summary       TEXT NOT NULL,
  linked_record_type  TEXT,
  linked_record_id    UUID,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE qr_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformer_id  UUID REFERENCES transformers(id) ON DELETE CASCADE,
  qr_code_string  TEXT UNIQUE NOT NULL,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  generated_by    UUID REFERENCES auth.users(id),
  status          TEXT DEFAULT 'active',
  last_scanned_at TIMESTAMPTZ
);

CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  role            TEXT NOT NULL DEFAULT 'viewer',
  territory_id    UUID REFERENCES service_territories(id),
  service_area_id UUID REFERENCES service_areas(id),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  message             TEXT NOT NULL,
  linked_record_type  TEXT,
  linked_record_id    UUID,
  is_read             BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE import_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by    UUID REFERENCES auth.users(id),
  file_name      TEXT,
  total_rows     INTEGER,
  success_count  INTEGER,
  skip_count     INTEGER,
  error_count    INTEGER,
  error_details  JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- AUTO-INCREMENT ASSET ID (TRF-000001 format)
-- ─────────────────────────────────────────────

CREATE SEQUENCE transformer_asset_seq START 1;

CREATE OR REPLACE FUNCTION generate_asset_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.asset_id IS NULL THEN
    NEW.asset_id := 'TRF-' || LPAD(nextval('transformer_asset_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_asset_id
  BEFORE INSERT ON transformers
  FOR EACH ROW
  EXECUTE FUNCTION generate_asset_id();

-- ─────────────────────────────────────────────
-- SEED: TRANSFORMER RATINGS
-- ─────────────────────────────────────────────

INSERT INTO transformer_ratings (kva, network_voltage_kv, display_label) VALUES
  (50,   11, '50kVA/11kV'),
  (100,  11, '100kVA/11kV'),
  (160,  11, '160kVA/11kV'),
  (200,  11, '200kVA/11kV'),
  (250,  11, '250kVA/11kV'),
  (315,  11, '315kVA/11kV'),
  (500,  11, '500kVA/11kV'),
  (630,  11, '630kVA/11kV'),
  (1000, 11, '1000kVA/11kV'),
  (50,   33, '50kVA/33kV'),
  (100,  33, '100kVA/33kV'),
  (160,  33, '160kVA/33kV'),
  (200,  33, '200kVA/33kV'),
  (250,  33, '250kVA/33kV'),
  (315,  33, '315kVA/33kV'),
  (500,  33, '500kVA/33kV'),
  (630,  33, '630kVA/33kV'),
  (1000, 33, '1000kVA/33kV');

-- ─────────────────────────────────────────────
-- SEED: UEDCL SERVICE TERRITORIES
-- ─────────────────────────────────────────────

INSERT INTO service_territories (name, code) VALUES
  ('Central Service Territory',           'CST'),
  ('Northern Service Territory',          'NST'),
  ('North North West Service Territory',  'NNWST'),
  ('Eastern Service Territory',           'EST'),
  ('Western Service Territory',           'WST');

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE transformers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fault_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_timeline     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes           ENABLE ROW LEVEL SECURITY;

-- Basic RLS: authenticated users can read and write
-- (Tighten per-role policies before production deployment)
CREATE POLICY "auth_read"   ON transformers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON transformers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON transformers FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_read"   ON inspections  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON inspections  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_read"   ON maintenance_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON maintenance_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_read"   ON fault_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert" ON fault_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update" ON fault_records FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all"    ON asset_timeline FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all"    ON asset_photos   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all"    ON notifications  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read"   ON users          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all"    ON qr_codes       FOR ALL USING (auth.role() = 'authenticated');
```

### Step 2: Create Supabase Storage Bucket

In the Supabase dashboard → Storage → New Bucket:
- Bucket name: `asset-photos`
- Public bucket: **yes** (so photo URLs work directly in the app)

### Step 3: Create Typed Query Helpers

Create `src/lib/supabase-helpers.ts` with these typed functions:

```typescript
// Transformers
getTransformers(filters?)           // with optional filter params
getTransformerById(id: string)
createTransformer(data: Partial<Transformer>)
updateTransformer(id: string, data: Partial<Transformer>)

// Reference data
getRatings()                        // all transformer_ratings
getRatingsByVoltage(kv: 11 | 33)    // filtered by network voltage
getTerritories()
getServiceAreas(territoryId: string)
getFeeders(serviceAreaId: string)
getDistricts()

// Activity
getInspections(transformerId: string)
getMaintenanceRecords(transformerId: string)
getFaultRecords(transformerId: string)
getInstallationRecords(transformerId: string)
getTimeline(transformerId: string)
getPhotos(transformerId: string)

// Notifications
getUnreadNotifications(userId: string)
markNotificationRead(id: string)

// Timeline helper (used by all form submissions)
addTimelineEntry(
  transformerId: string,
  eventType: string,
  summary: string,
  recordType?: string,
  recordId?: string
)
```

---

## Notes

> Run the full SQL block in the Supabase SQL Editor in a single execution.

> After running, verify **all tables appear** in the Supabase Table Editor before moving to Prompt 04.

> The `batch_import_id` field on `transformers` is used by the bulk import rollback feature in Prompt 12.

> RLS policies shown here are intentionally broad for development. Tighten them by role before any production deployment.
