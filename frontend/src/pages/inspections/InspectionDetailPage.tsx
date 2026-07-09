import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarCheck, ClipboardCheck, Pencil, Plus, ShieldAlert, Zap } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { inspectionApi } from '../../api/inspectionApi';
import { transformerApi } from '../../api/transformerApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { Inspection, Transformer, User } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

function asTransformer(value?: string | Transformer) {
  return typeof value === 'object' ? value : undefined;
}

function refId(value?: string | Transformer) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id;
}

function userName(value?: string | User) {
  if (!value) return 'Not recorded';
  return typeof value === 'string' ? 'Recorded inspector' : value.name || value.email || 'Recorded inspector';
}

function readable(value?: string | number | boolean | null) {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function numberValue(value?: number, suffix = '') {
  if (typeof value !== 'number') return 'Not recorded';
  return `${value}${suffix}`;
}

function conditionValue(item?: Inspection) {
  return item?.physical?.overall_condition || item?.overall_condition || 'Not recorded';
}

function conditionBadgeClass(condition?: string) {
  const value = condition?.toLowerCase();
  if (value === 'good') return 'condition-badge condition-good';
  if (value === 'fair') return 'condition-badge condition-fair';
  if (value === 'poor') return 'condition-badge condition-poor';
  if (value === 'critical') return 'condition-badge condition-critical';
  return 'badge';
}

function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value || 'Not recorded'}</strong>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-heading"><h2>{title}</h2></div>
      {children}
    </section>
  );
}

function transformerSite(transformer?: Transformer) {
  return transformer?.location_administrative?.site_name || transformer?.site_name || 'Not recorded';
}

function transformerTerritory(transformer?: Transformer) {
  const territory = transformer?.location_operational?.territory_id;
  if (!territory) return 'Not recorded';
  return typeof territory === 'string' ? territory : territory.name || territory.code || 'Not recorded';
}

export function InspectionDetailPage() {
  const { id } = useParams();

  const inspectionQuery = useQuery({
    queryKey: ['inspections', id],
    queryFn: () => inspectionApi.getById(id ?? ''),
    enabled: Boolean(id)
  });

  const embeddedTransformer = asTransformer(inspectionQuery.data?.transformer_id);
  const transformerId = refId(inspectionQuery.data?.transformer_id);

  const transformerQuery = useQuery({
    queryKey: ['transformers', transformerId],
    queryFn: () => transformerApi.getById(transformerId),
    enabled: Boolean(transformerId) && !embeddedTransformer
  });

  const transformer = embeddedTransformer || transformerQuery.data;
  const inspection = inspectionQuery.data;
  const photos = inspection?.photos ?? [];

  const timeline = useMemo(() => {
    const rows = [
      { label: 'Inspection created', date: inspection?.created_at },
      { label: 'Inspection updated', date: inspection?.updated_at },
      { label: 'Field visit date', date: inspection?.inspection_date }
    ].filter((row) => row.date);
    return rows;
  }, [inspection]);

  if (!id) return <ErrorState error={new Error('Missing inspection id')} title="Inspection unavailable" />;
  if (inspectionQuery.isLoading) return <Loading label="Loading inspection" />;
  if (inspectionQuery.error) return <ErrorState error={inspectionQuery.error} title="Inspection unavailable" />;
  if (!inspection) return <EmptyState title="Inspection not found" message="The selected inspection could not be loaded." />;

  return (
    <div className="page-stack">
      <section className="detail-hero">
        <div>
          <Link className="back-link" to="/inspections">
            <ArrowLeft size={16} />
            <span>Back to Inspections</span>
          </Link>
          <div className="detail-title-row">
            <div>
              <span className="eyebrow">Inspection workflow</span>
              <h1>{getTransformerName(inspection.transformer_id)}</h1>
              <p>{formatDate(inspection.inspection_date)} inspection by {userName(inspection.inspector_id || inspection.inspected_by)}</p>
            </div>
            <div className="detail-badge-row">
              <span className={conditionBadgeClass(conditionValue(inspection))}>{conditionValue(inspection)}</span>
              <span className="badge">{readable(inspection.recommended_action)}</span>
            </div>
          </div>
        </div>
        <div className="detail-action-row">
          <Link className="secondary-button" to={`/inspections/${inspection._id}/edit`}>
            <Pencil size={16} />
            <span>Edit Inspection</span>
          </Link>
          {transformerId ? (
            <Link className="primary-button" to={`/inspections/new?transformerId=${transformerId}`}>
              <Plus size={16} />
              <span>New Inspection</span>
            </Link>
          ) : null}
          {transformerId ? (
            <Link className="secondary-button" to={`/faults/new?transformerId=${transformerId}&inspectionId=${inspection._id}`}>
              <ShieldAlert size={16} />
              <span>Create Fault</span>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="asset-summary-grid">
        <div className="asset-summary-card">
          <CalendarCheck size={20} />
          <span>Inspection Date</span>
          <strong>{formatDate(inspection.inspection_date)}</strong>
        </div>
        <div className="asset-summary-card">
          <ClipboardCheck size={20} />
          <span>Visit Type</span>
          <strong>{readable(inspection.visit_type)}</strong>
        </div>
        <div className="asset-summary-card">
          <Zap size={20} />
          <span>Load</span>
          <strong>{numberValue(inspection.electrical?.load_percentage, '%')}</strong>
        </div>
      </section>

      <Section title="Inspection Summary">
        <div className="detail-grid">
          <DetailField label="Condition" value={<span className={conditionBadgeClass(conditionValue(inspection))}>{conditionValue(inspection)}</span>} />
          <DetailField label="Recommended Action" value={readable(inspection.recommended_action)} />
          <DetailField label="Recommended Details" value={readable(inspection.recommended_action_details)} />
          <DetailField label="Status" value={<span className="badge">{readable(inspection.sync_status || 'Saved')}</span>} />
        </div>
      </Section>

      <Section title="Transformer">
        {transformerQuery.isLoading ? <Loading label="Loading related transformer" /> : null}
        <div className="detail-grid">
          <DetailField label="Transformer" value={getTransformerName(transformer || inspection.transformer_id)} />
          <DetailField label="Asset ID" value={transformer?.asset_id || 'Not recorded'} />
          <DetailField label="Site" value={transformerSite(transformer)} />
          <DetailField label="Territory" value={transformerTerritory(transformer)} />
          <DetailField label="kVA Rating" value={numberValue(transformer?.kva_rating, ' kVA')} />
          <DetailField label="Network Voltage" value={numberValue(transformer?.network_voltage_kv, ' kV')} />
          <DetailField label="Network Voltage Confirmed" value={readable(inspection.network_voltage_confirmed)} />
          <DetailField label="kVA Rating Confirmed" value={readable(inspection.kva_rating_confirmed)} />
          <DetailField label="Rating Discrepancy" value={readable(inspection.rating_discrepancy_details)} />
        </div>
        {transformerId ? (
          <div className="panel-actions">
            <Link className="secondary-button" to={`/transformers/${transformerId}`}>Related Transformer</Link>
          </div>
        ) : null}
      </Section>

      <Section title="Physical Inspection">
        <div className="detail-grid">
          <DetailField label="Rust" value={readable(inspection.physical?.rust_corrosion)} />
          <DetailField label="Oil Leakage" value={readable(inspection.physical?.oil_leakage)} />
          <DetailField label="Tank Body" value={readable(inspection.physical?.tank_body_damage)} />
          <DetailField label="Cooling" value={readable(inspection.physical?.cooling_fins_condition)} />
          <DetailField label="Sound Level" value={readable(inspection.physical?.sound_level)} />
          <DetailField label="Temperature" value={numberValue(inspection.physical?.temperature, ' C')} />
        </div>
      </Section>

      <Section title="Electrical Inspection">
        <div className="detail-grid">
          <DetailField label="Phase A Current" value={numberValue(inspection.electrical?.load_current_a, ' A')} />
          <DetailField label="Phase B Current" value={numberValue(inspection.electrical?.load_current_b, ' A')} />
          <DetailField label="Phase C Current" value={numberValue(inspection.electrical?.load_current_c, ' A')} />
          <DetailField label="HV Side Voltage" value={numberValue(inspection.electrical?.voltage_hv_side, ' V')} />
          <DetailField label="LV Side Voltage" value={numberValue(inspection.electrical?.voltage_lv_side, ' V')} />
          <DetailField label="Load %" value={numberValue(inspection.electrical?.load_percentage, '%')} />
          <DetailField label="Frequency" value={numberValue(inspection.electrical?.frequency, ' Hz')} />
          <DetailField label="Power Factor" value={numberValue(inspection.electrical?.power_factor)} />
          <DetailField label="Overload Flag" value={readable(inspection.electrical?.overload_flag)} />
        </div>
      </Section>

      <Section title="Environmental">
        <div className="detail-grid">
          <DetailField label="Security Fencing" value={readable(inspection.site_safety?.security_fencing)} />
          <DetailField label="Earthing" value={readable(inspection.site_safety?.earthing)} />
          <DetailField label="Warning Signs" value={readable(inspection.site_safety?.warning_signs)} />
          <DetailField label="Vegetation Encroachment" value={readable(inspection.site_safety?.vegetation_encroachment)} />
          <DetailField label="Unauthorised Connections" value={readable(inspection.site_safety?.unauthorised_connections)} />
          <DetailField label="Safety Notes" value={readable(inspection.site_safety?.safety_notes)} />
        </div>
      </Section>

      <Section title="Oil">
        <div className="detail-grid">
          <DetailField label="Oil Level" value={readable(inspection.oil_breather?.oil_level)} />
          <DetailField label="Silica Gel Color" value={readable(inspection.oil_breather?.silica_gel_color)} />
          <DetailField label="Oil Test Required" value={readable(inspection.oil_breather?.oil_test_required)} />
          <DetailField label="Oil Test Notes" value={readable(inspection.oil_breather?.oil_test_notes)} />
          <DetailField label="Oil Temperature" value={numberValue(inspection.oil_breather?.oil_temperature, ' C')} />
        </div>
      </Section>

      <Section title="Bushings">
        <div className="detail-grid">
          <DetailField label="Bushing Condition" value={readable(inspection.physical?.bushing_condition)} />
        </div>
      </Section>

      <Section title="Load">
        <div className="detail-grid">
          <DetailField label="Load Percentage" value={numberValue(inspection.electrical?.load_percentage, '%')} />
          <DetailField label="Overload" value={readable(inspection.electrical?.overload_flag)} />
        </div>
      </Section>

      <Section title="Photographs">
        {photos.length > 0 ? (
          <div className="photo-list">
            {photos.map((photo) => <span className="badge" key={photo}>{photo}</span>)}
          </div>
        ) : (
          <EmptyState title="No photographs attached" message="Photo upload is not enabled for this workflow." />
        )}
      </Section>

      <Section title="Inspector Notes">
        <div className="detail-grid">
          <DetailField label="Narrative" value={readable(inspection.condition_narrative)} />
          <DetailField label="Recommended Actions" value={readable(inspection.recommended_action)} />
          <DetailField label="Recommended Action Details" value={readable(inspection.recommended_action_details)} />
        </div>
      </Section>

      <Section title="Timeline">
        <div className="timeline-list">
          {timeline.map((row) => (
            <div className="timeline-item" key={`${row.label}-${row.date}`}>
              <span>{formatDate(row.date)}</span>
              <strong>{row.label}</strong>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
