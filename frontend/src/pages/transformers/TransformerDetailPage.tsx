import { useMemo, useState } from 'react';
import { useMutation, useQuery, UseQueryResult, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarCheck,
  CircuitBoard,
  ClipboardCheck,
  Copy,
  Download,
  History,
  Info,
  MapPinned,
  Pencil,
  Plus,
  PowerOff,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wrench,
  Zap
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { faultApi } from '../../api/faultApi';
import { notifyApiError } from '../../api/http';
import { inspectionApi } from '../../api/inspectionApi';
import { maintenanceApi } from '../../api/maintenanceApi';
import { DecommissionPayload, transformerApi } from '../../api/transformerApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Fault, Inspection, MaintenanceRecord, TimelineEvent, Transformer, TransformerQrCode, User } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

type DetailTab = 'overview' | 'specifications' | 'location' | 'faults' | 'inspections' | 'maintenance' | 'timeline' | 'qr';

const tabs: Array<{ id: DetailTab; label: string; icon: typeof Info }> = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'specifications', label: 'Specifications', icon: CircuitBoard },
  { id: 'location', label: 'Location', icon: MapPinned },
  { id: 'faults', label: 'Fault History', icon: ShieldAlert },
  { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'qr', label: 'QR', icon: QrCode }
];

const decommissionReasons: DecommissionPayload['reason'][] = ['End of Life', 'Damaged', 'Theft', 'Vandalism', 'Replaced', 'Other'];

function notRecorded(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  return String(value);
}

function readableLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function userName(value?: string | User) {
  if (!value || typeof value === 'string') return 'Not recorded';
  return value.name || value.email || 'Not recorded';
}

function refName(value?: string | { name?: string; code?: string }) {
  if (!value || typeof value === 'string') return undefined;
  return value.name || value.code;
}

function getSiteLabel(item?: Transformer) {
  if (!item) return 'Not recorded';
  return item.location_administrative?.site_name || item.site_name || getTransformerName(item);
}

function getTerritory(item?: Transformer) {
  return item?.location_operational?.territory_name || refName(item?.location_operational?.territory_id) || 'Not recorded';
}

function getServiceArea(item?: Transformer) {
  return item?.location_operational?.service_area_name || refName(item?.location_operational?.service_area_id) || 'Not recorded';
}

function getFeeder(item?: Transformer) {
  return item?.location_operational?.feeder_name || item?.location_operational?.feeder_code || refName(item?.location_operational?.feeder_id) || 'Not recorded';
}

function getCondition(item?: Transformer, latestInspection?: Inspection | null) {
  return (
    item?.condition ||
    item?.overall_condition ||
    item?.latest_inspection?.physical?.overall_condition ||
    item?.latest_inspection?.overall_condition ||
    latestInspection?.physical?.overall_condition ||
    latestInspection?.overall_condition ||
    undefined
  );
}

function parseQrPayload(qr?: TransformerQrCode) {
  const payload: Record<string, unknown> = {};
  if (qr?.qr_data && typeof qr.qr_data === 'object') Object.assign(payload, qr.qr_data);
  if (qr?.qr_code_string) {
    try {
      const parsed = JSON.parse(qr.qr_code_string);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(payload, parsed);
    } catch {
      // QR strings may be plain text; the UI falls back to the raw encoded value.
    }
  }
  return payload;
}

function getQrEncodedValue(qr?: TransformerQrCode) {
  if (qr?.qr_code_string) return qr.qr_code_string;
  if (qr?.qr_data?.url && typeof qr.qr_data.url === 'string') return qr.qr_data.url;
  if (qr?.qr_data?.id && typeof qr.qr_data.id === 'string') return qr.qr_data.id;
  return '';
}

function getQrUrl(qr?: TransformerQrCode) {
  const payload = parseQrPayload(qr);
  return typeof payload.url === 'string' ? payload.url : '';
}

function isDownloadableQrImage(qr?: TransformerQrCode) {
  return Boolean(qr?.qr_code_image?.startsWith('data:image/'));
}

function statusBadgeClass(status?: string) {
  if (status === 'Faulty') return 'badge danger';
  if (status === 'Under Maintenance') return 'badge amber';
  if (status === 'Active') return 'badge green';
  return 'badge';
}

function conditionBadgeClass(condition?: string) {
  if (condition === 'Critical' || condition === 'Poor') return 'badge danger';
  if (condition === 'Fair') return 'badge amber';
  if (condition === 'Good') return 'badge green';
  return 'badge muted-badge';
}

function severityBadgeClass(severity?: string) {
  if (severity === 'Critical' || severity === 'Complete Outage') return 'badge danger';
  if (severity === 'Major') return 'badge amber';
  if (severity === 'Minor') return 'badge green';
  return 'badge';
}

function yesNoBadge(value?: boolean) {
  return <span className={value ? 'badge danger' : 'badge green'}>{value ? 'Yes' : 'No'}</span>;
}

function DetailField({ label, value }: { label: string; value?: string | number | JSX.Element | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? 'Not recorded'}</dd>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string | JSX.Element; icon: typeof Zap }) {
  return (
    <article className="asset-summary-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TabPanelState<T>({
  query,
  title,
  emptyTitle,
  emptyMessage,
  getRows,
  children
}: {
  query: Pick<UseQueryResult<T>, 'isLoading' | 'error' | 'data'>;
  title: string;
  emptyTitle: string;
  emptyMessage: string;
  getRows: (data: T | undefined) => unknown[];
  children: JSX.Element;
}) {
  if (query.isLoading) return <Loading label={`Loading ${title.toLowerCase()}`} />;
  if (query.error) return <ErrorState error={query.error} title={`${title} unavailable`} />;
  if (getRows(query.data).length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return children;
}

function OverviewTab({ item, latestInspection }: { item: Transformer; latestInspection?: Inspection | null }) {
  return (
    <div className="detail-section-grid">
      <section className="panel detail-subpanel">
        <div className="panel-heading"><h2>Operational profile</h2></div>
        <dl className="detail-grid">
          <DetailField label="Asset ID" value={getTransformerName(item)} />
          <DetailField label="Site name" value={getSiteLabel(item)} />
          <DetailField label="Operational status" value={<span className={statusBadgeClass(item.operational_status)}>{readableLabel(item.operational_status)}</span>} />
          <DetailField label="Condition" value={<span className={conditionBadgeClass(getCondition(item, latestInspection))}>{readableLabel(getCondition(item, latestInspection))}</span>} />
          <DetailField label="Territory" value={getTerritory(item)} />
          <DetailField label="Service area" value={getServiceArea(item)} />
          <DetailField label="Feeder" value={getFeeder(item)} />
          <DetailField label="Last inspection" value={formatDate(item.last_inspection_date || latestInspection?.inspection_date)} />
          <DetailField label="Open fault" value={yesNoBadge(item.has_open_fault)} />
          <DetailField label="Created" value={formatDate(item.created_at)} />
          <DetailField label="Updated" value={formatDate(item.updated_at)} />
          <DetailField label="Record status" value={readableLabel(item.record_status)} />
        </dl>
      </section>
    </div>
  );
}

function SpecificationsTab({ item }: { item: Transformer }) {
  return (
    <section className="panel detail-subpanel">
      <div className="panel-heading"><h2>Technical specifications</h2></div>
      <dl className="detail-grid">
        <DetailField label="kVA rating" value={item.kva_rating ? `${item.kva_rating.toLocaleString()} kVA` : 'Not recorded'} />
        <DetailField label="Network voltage" value={item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'} />
        <DetailField label="Display rating" value={notRecorded(item.display_rating)} />
        <DetailField label="Manufacturer" value={notRecorded(item.manufacturer)} />
        <DetailField label="Serial number" value={notRecorded(item.serial_number)} />
        <DetailField label="Year manufactured" value={item.year_manufactured ?? 'Not recorded'} />
        <DetailField label="Secondary voltage" value={notRecorded(item.voltage_secondary)} />
        <DetailField label="Phase type" value={readableLabel(item.phase_type)} />
        <DetailField label="Cooling type" value={notRecorded(item.cooling_type)} />
        <DetailField label="Mounting type" value={readableLabel(item.mounting_type)} />
        <DetailField label="Vector group" value={notRecorded(item.vector_group)} />
        <DetailField label="UEDCL reference" value={notRecorded(item.uedcl_reference)} />
      </dl>
    </section>
  );
}

function LocationTab({ item }: { item: Transformer }) {
  return (
    <section className="panel detail-subpanel">
      <div className="panel-heading"><h2>Location details</h2></div>
      <dl className="detail-grid">
        <DetailField label="Site name" value={getSiteLabel(item)} />
        <DetailField label="District" value={item.location_administrative?.district_name || 'Not recorded'} />
        <DetailField label="Sub-county" value={notRecorded(item.location_administrative?.sub_county)} />
        <DetailField label="Parish" value={notRecorded(item.location_administrative?.parish)} />
        <DetailField label="Village" value={notRecorded(item.location_administrative?.village)} />
        <DetailField label="Territory" value={getTerritory(item)} />
        <DetailField label="Service area" value={getServiceArea(item)} />
        <DetailField label="Feeder" value={getFeeder(item)} />
        <DetailField label="Substation" value={notRecorded(item.location_operational?.substation_name)} />
        <DetailField label="GPS method" value={readableLabel(item.gps?.method)} />
        <DetailField label="GPS accuracy" value={item.gps?.accuracy_metres !== undefined ? `${item.gps.accuracy_metres} m` : 'Not recorded'} />
        <DetailField label="GPS captured" value={formatDate(item.gps?.captured_at)} />
      </dl>
    </section>
  );
}

function FaultsTab({ query, transformerId }: { query: UseQueryResult<Fault[], Error>; transformerId: string }) {
  const rows = query.data ?? [];
  const openRows = rows.filter((fault) => !['Resolved', 'Closed'].includes(fault.fault_status ?? ''));
  const latest = rows[0];
  return (
    <div className="tab-stack">
      <section className="panel detail-subpanel">
        <div className="panel-heading">
          <h2>Operational faults</h2>
          <Link className="primary-button" to={`/faults/new?transformerId=${transformerId}`}><ShieldAlert size={16} />Report Fault</Link>
        </div>
        <div className="asset-summary-grid compact-grid">
          <SummaryCard label="Open Faults" value={openRows.length.toLocaleString()} icon={ShieldAlert} />
          <SummaryCard label="Fault History" value={rows.length.toLocaleString()} icon={History} />
          <SummaryCard label="Latest Fault" value={latest?.fault_type || 'Not recorded'} icon={Info} />
        </div>
      </section>
      <TabPanelState query={query} title="Fault history" emptyTitle="No faults recorded for this transformer" emptyMessage="Fault reports linked to this transformer will appear here." getRows={(data) => data ?? []}>
        <DataTable<Fault>
          columns={['Fault type', 'Status', 'Severity', 'Date', 'Description', 'Actions']}
          rows={rows}
          emptyTitle="No faults recorded for this transformer"
          emptyMessage="Fault reports linked to this transformer will appear here."
          renderRow={(fault) => (
            <tr key={fault._id}>
            <td>{readableLabel(fault.fault_type)}</td>
              <td><span className={statusBadgeClass(fault.fault_status)}>{fault.fault_status === 'Open' ? 'Reported' : fault.fault_status === 'Resolved' ? 'Awaiting Verification' : readableLabel(fault.fault_status)}</span></td>
              <td><span className={severityBadgeClass(fault.severity)}>{readableLabel(fault.severity)}</span></td>
              <td>{formatDate(fault.fault_date || fault.created_at)}</td>
              <td>{notRecorded(fault.fault_description)}</td>
              <td><div className="table-actions"><Link className="secondary-button" to={`/faults/${fault._id}`}>View</Link><Link className="secondary-button" to={`/faults/${fault._id}/edit`}>Edit</Link></div></td>
            </tr>
          )}
        />
      </TabPanelState>
    </div>
  );
}

function InspectionsTab({ listQuery, latestQuery }: { listQuery: UseQueryResult<ReturnType<typeof inspectionApi.byTransformer> extends Promise<infer T> ? T : never, Error>; latestQuery: UseQueryResult<Inspection | null, Error> }) {
  const rows = listQuery.data?.data ?? [];
  const latest = latestQuery.data;
  return (
    <div className="tab-stack">
      <section className="panel detail-subpanel">
        <div className="panel-heading"><h2>Latest inspection</h2></div>
        {latestQuery.isLoading ? (
          <Loading label="Loading latest inspection" />
        ) : latestQuery.error ? (
          <EmptyState title="No inspections recorded for this transformer" message="Latest inspection data is not available yet." />
        ) : latest ? (
          <dl className="detail-grid">
            <DetailField label="Inspection date" value={formatDate(latest.inspection_date)} />
            <DetailField label="Condition" value={<span className={conditionBadgeClass(latest.physical?.overall_condition || latest.overall_condition)}>{readableLabel(latest.physical?.overall_condition || latest.overall_condition)}</span>} />
            <DetailField label="Visit type" value={readableLabel(latest.visit_type)} />
            <DetailField label="Inspector" value={userName(latest.inspector_id || latest.inspected_by)} />
            <DetailField label="Recommended action" value={readableLabel(latest.recommended_action)} />
            <DetailField label="Load percentage" value={latest.electrical?.load_percentage !== undefined ? `${latest.electrical.load_percentage}%` : 'Not recorded'} />
            <DetailField label="Overload flag" value={yesNoBadge(latest.electrical?.overload_flag)} />
            <DetailField label="Narrative" value={notRecorded(latest.condition_narrative)} />
          </dl>
        ) : (
          <EmptyState title="No inspections recorded for this transformer" message="Latest inspection data is not available yet." />
        )}
      </section>
      <section className="panel detail-subpanel">
        <div className="panel-heading"><h2>Inspection history</h2></div>
        <TabPanelState query={listQuery} title="Inspection history" emptyTitle="No inspections recorded for this transformer" emptyMessage="Inspection records linked to this transformer will appear here." getRows={(data) => data?.data ?? []}>
          <DataTable<Inspection>
            columns={['Date', 'Condition', 'Visit type', 'Inspector', 'Recommended action', 'Actions']}
            rows={rows}
            emptyTitle="No inspections recorded for this transformer"
            emptyMessage="Inspection records linked to this transformer will appear here."
            renderRow={(inspection) => (
              <tr key={inspection._id}>
                <td>{formatDate(inspection.inspection_date)}</td>
                <td><span className={conditionBadgeClass(inspection.physical?.overall_condition || inspection.overall_condition)}>{readableLabel(inspection.physical?.overall_condition || inspection.overall_condition)}</span></td>
                <td>{readableLabel(inspection.visit_type)}</td>
                <td>{userName(inspection.inspector_id || inspection.inspected_by)}</td>
                <td>{readableLabel(inspection.recommended_action)}</td>
                <td>
                  <div className="table-actions">
                    <Link className="secondary-button" to={`/inspections/${inspection._id}`}>View</Link>
                    <Link className="secondary-button" to={`/inspections/${inspection._id}/edit`}>Edit</Link>
                  </div>
                </td>
              </tr>
            )}
          />
        </TabPanelState>
      </section>
    </div>
  );
}

function MaintenanceTab({ query }: { query: UseQueryResult<ReturnType<typeof maintenanceApi.byTransformer> extends Promise<infer T> ? T : never, Error> }) {
  const rows = query.data?.data ?? [];
  return (
    <TabPanelState query={query} title="Maintenance" emptyTitle="No maintenance records for this transformer" emptyMessage="Maintenance records linked to this transformer will appear here." getRows={(data) => data?.data ?? []}>
      <DataTable<MaintenanceRecord>
        columns={['Type', 'Status', 'Date', 'Next maintenance', 'Technician']}
        rows={rows}
        emptyTitle="No maintenance records for this transformer"
        emptyMessage="Maintenance records linked to this transformer will appear here."
        renderRow={(record) => (
          <tr key={record._id}>
            <td>{readableLabel(record.maintenance_type)}</td>
            <td><span className="badge">{readableLabel(record.status || record.sync_status)}</span></td>
            <td>{formatDate(record.maintenance_date)}</td>
            <td>{formatDate(record.next_maintenance_date)}</td>
            <td>{record.technician_name || userName(record.technician_id) || notRecorded(record.completed_by)}</td>
          </tr>
        )}
      />
    </TabPanelState>
  );
}

function TimelineTab({ query }: { query: UseQueryResult<ReturnType<typeof transformerApi.timeline> extends Promise<infer T> ? T : never, Error> }) {
  const rows = query.data?.data ?? [];
  return (
    <TabPanelState query={query} title="Timeline" emptyTitle="No timeline events" emptyMessage="Operational events for this transformer will appear here." getRows={(data) => data?.data ?? []}>
      <div className="timeline-list">
        {rows.map((event: TimelineEvent) => (
          <article className="timeline-row" key={event._id}>
            <div className="timeline-marker" />
            <div>
              <div className="row-title-line">
                <strong>{readableLabel(event.event_type)}</strong>
                <small>{formatDate(event.event_date || event.created_at)}</small>
              </div>
              <span>{notRecorded(event.event_summary)}</span>
              {event.event_details && <p>{event.event_details}</p>}
            </div>
          </article>
        ))}
      </div>
    </TabPanelState>
  );
}

function QrTab({ item, query }: { item: Transformer; query: UseQueryResult<TransformerQrCode, Error> }) {
  if (query.isLoading) return <Loading label="Loading QR data" />;
  if (query.error) return <ErrorState error={query.error} title="QR data unavailable" />;
  const qr = query.data;
  if (!qr) return <EmptyState title="No QR data available" message="QR data for this transformer is not available yet." />;

  const qrPayload = parseQrPayload(qr);
  const qrEncodedValue = getQrEncodedValue(qr);
  const qrUrl = getQrUrl(qr);
  const qrImageAvailable = Boolean(qr.qr_code_image);
  const canDownloadImage = isDownloadableQrImage(qr);
  const qrIdentityRows = [
    ['Asset ID', getTransformerName(item)],
    ['Site', getSiteLabel(item)],
    ['Serial number', notRecorded(item.serial_number)],
    ['kVA rating', item.kva_rating ? `${item.kva_rating.toLocaleString()} kVA` : 'Not recorded'],
    ['Network voltage', item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'],
    ['Territory', getTerritory(item)],
    ['Service area', getServiceArea(item)],
    ['Feeder', getFeeder(item)]
  ];
  const encodedRows = [
    ['Asset reference', typeof qrPayload.id === 'string' ? qrPayload.id : getTransformerName(item)],
    ['QR URL', qrUrl || 'Not recorded'],
    ['Encoded rating', typeof qrPayload.rating === 'string' ? qrPayload.rating : notRecorded(item.display_rating)],
    ['Encoded site', typeof qrPayload.site === 'string' ? qrPayload.site : getSiteLabel(item)],
    ['Encoded territory', typeof qrPayload.territory === 'string' ? qrPayload.territory : getTerritory(item)]
  ];

  const copyQrData = async () => {
    const value = qrUrl || qrEncodedValue;
    if (!value) {
      toast.error('No QR data is available to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(qrUrl ? 'QR URL copied' : 'QR data copied');
    } catch {
      toast.error('Unable to copy QR data');
    }
  };

  const refreshQr = async () => {
    const result = await query.refetch();
    if (result.error) {
      notifyApiError(result.error);
      return;
    }
    toast.success('QR data refreshed');
  };

  const printQrLabel = () => {
    window.print();
  };

  const downloadQrImage = () => {
    if (!canDownloadImage || !qr.qr_code_image) {
      toast.error('QR image is not available for download');
      return;
    }
    const link = document.createElement('a');
    link.href = qr.qr_code_image;
    link.download = `qr-${getTransformerName(item)}.png`;
    link.click();
    toast.success('QR image download started');
  };

  return (
    <div className="tab-stack qr-workspace">
      <section className="panel detail-subpanel qr-label-card">
        <div className="panel-heading">
          <div>
            <h2>Asset QR label</h2>
            <p>Print-ready identity label for field verification.</p>
          </div>
          <div className="detail-action-row">
            <button className="secondary-button" type="button" onClick={copyQrData}>
              <Copy size={16} />
              <span>Copy QR Data</span>
            </button>
            <button className="secondary-button" type="button" onClick={refreshQr} disabled={query.isFetching}>
              <RefreshCw size={16} />
              <span>{query.isFetching ? 'Refreshing' : 'Refresh QR'}</span>
            </button>
            <button className="secondary-button" type="button" onClick={downloadQrImage} disabled={!canDownloadImage}>
              <Download size={16} />
              <span>Download Image</span>
            </button>
            <button className="primary-button" type="button" onClick={printQrLabel}>
              <Printer size={16} />
              <span>Print Label</span>
            </button>
          </div>
        </div>

        <div className="qr-label-layout">
          <div className={qrImageAvailable ? 'qr-preview large-qr-preview' : 'qr-preview large-qr-preview qr-preview-empty'}>
            {qr.qr_code_image ? (
              <img src={qr.qr_code_image} alt={`QR code for ${getTransformerName(item)}`} />
            ) : (
              <div>
                <QrCode size={92} />
                <strong>QR image not available</strong>
                <span>The encoded QR data is available below.</span>
              </div>
            )}
          </div>
          <div className="qr-identity-block">
            <span className="eyebrow">Transformer identity</span>
            <h3>{getTransformerName(item)}</h3>
            <dl>
              {qrIdentityRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {!qrImageAvailable ? (
          <div className="qr-unavailable-note">
            <QrCode size={18} />
            <span>QR image not available from the current endpoint. The label can still print the QR string for manual verification.</span>
          </div>
        ) : null}
      </section>

      <section className="panel detail-subpanel">
        <div className="panel-heading"><h2>QR details</h2></div>
        <dl className="detail-grid">
          <DetailField label="QR string" value={qrEncodedValue ? <code className="inline-code-wrap">{qrEncodedValue}</code> : 'Not recorded'} />
          <DetailField label="Version" value={qr.version ?? 'Not recorded'} />
          <DetailField label="Format" value={readableLabel(qr.format)} />
          <DetailField label="Status" value={<span className={qr.status === 'active' ? 'badge green' : 'badge'}>{readableLabel(qr.status)}</span>} />
          <DetailField label="Generated" value={formatDate(qr.generated_at)} />
          <DetailField label="Expiry" value={formatDate(qr.expires_at)} />
          <DetailField label="Scan count" value={qr.scan_count ?? 0} />
          <DetailField label="Last scanned" value={formatDate(qr.last_scanned_at)} />
        </dl>
      </section>

      <section className="panel detail-subpanel">
        <div className="panel-heading"><h2>Encoded record</h2></div>
        <dl className="detail-grid qr-encoded-grid">
          {encodedRows.map(([label, value]) => (
            <DetailField key={label} label={label} value={value} />
          ))}
        </dl>
      </section>

      <section className="qr-print-label" aria-hidden="true">
        <strong className="qr-print-brand">kVAssetTracker</strong>
        <div className="qr-print-code">
          {qr.qr_code_image ? <img src={qr.qr_code_image} alt="" /> : <QrCode size={118} />}
        </div>
        <h2>{getTransformerName(item)}</h2>
        <p>{getSiteLabel(item)}</p>
        <dl>
          <div><dt>Rating</dt><dd>{item.kva_rating ? `${item.kva_rating.toLocaleString()} kVA` : 'Not recorded'} / {item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'}</dd></div>
          <div><dt>Serial</dt><dd>{notRecorded(item.serial_number)}</dd></div>
          <div><dt>QR</dt><dd>{qrUrl || qrEncodedValue || 'Not recorded'}</dd></div>
        </dl>
      </section>
    </div>
  );
}

export function TransformerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showDecommission, setShowDecommission] = useState(false);
  const [decommissionReason, setDecommissionReason] = useState<DecommissionPayload['reason']>('End of Life');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const transformerQuery = useQuery({
    queryKey: ['transformers', id],
    queryFn: () => transformerApi.getById(id ?? ''),
    enabled: Boolean(id)
  });
  const faultsQuery = useQuery({ queryKey: ['faults', 'transformer', id], queryFn: () => faultApi.byTransformer(id ?? ''), enabled: Boolean(id) });
  const inspectionsQuery = useQuery({ queryKey: ['inspections', 'transformer', id], queryFn: () => inspectionApi.byTransformer(id ?? '', { limit: 20 }), enabled: Boolean(id) });
  const latestInspectionQuery = useQuery({
    queryKey: ['inspections', 'transformer', id, 'latest'],
    queryFn: () => inspectionApi.latestForTransformer(id ?? '').catch(() => null),
    enabled: Boolean(id)
  });
  const maintenanceQuery = useQuery({ queryKey: ['maintenance', 'transformer', id], queryFn: () => maintenanceApi.byTransformer(id ?? '', { limit: 20 }), enabled: Boolean(id) });
  const timelineQuery = useQuery({ queryKey: ['transformers', id, 'timeline'], queryFn: () => transformerApi.timeline(id ?? '', { limit: 50 }), enabled: Boolean(id) });
  const qrQuery = useQuery({ queryKey: ['transformers', id, 'qr'], queryFn: () => transformerApi.qr(id ?? ''), enabled: Boolean(id) });

  const item = transformerQuery.data;
  const latestInspection = latestInspectionQuery.data;
  const condition = getCondition(item, latestInspection);
  const openFaults = useMemo(() => (faultsQuery.data ?? []).filter((fault) => !['Resolved', 'Closed'].includes(fault.fault_status ?? '')), [faultsQuery.data]);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['transformers', id] });
    void queryClient.invalidateQueries({ queryKey: ['transformers'] });
    void queryClient.invalidateQueries({ queryKey: ['faults', 'transformer', id] });
    void queryClient.invalidateQueries({ queryKey: ['inspections', 'transformer', id] });
    void queryClient.invalidateQueries({ queryKey: ['inspections', 'transformer', id, 'latest'] });
    void queryClient.invalidateQueries({ queryKey: ['maintenance', 'transformer', id] });
  };

  const invalidateAfterMutation = (transformerId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['transformers'] });
    void queryClient.invalidateQueries({ queryKey: ['faults', 'open'] });
    void queryClient.invalidateQueries({ queryKey: ['inspections', 'overdue'] });
    void queryClient.invalidateQueries({ queryKey: ['maintenance', 'upcoming'] });
    if (transformerId) {
      void queryClient.invalidateQueries({ queryKey: ['transformers', transformerId] });
      void queryClient.invalidateQueries({ queryKey: ['transformers', transformerId, 'timeline'] });
      void queryClient.invalidateQueries({ queryKey: ['transformers', transformerId, 'qr'] });
    }
  };

  const decommissionMutation = useMutation({
    mutationFn: (payload: DecommissionPayload) => transformerApi.decommission(id ?? '', payload),
    onSuccess: (transformer) => {
      invalidateAfterMutation(transformer._id);
      setShowDecommission(false);
      toast.success('Transformer decommissioned');
    },
    onError: notifyApiError
  });

  const deleteMutation = useMutation({
    mutationFn: () => transformerApi.delete(id ?? ''),
    onSuccess: () => {
      invalidateAfterMutation(id);
      toast.success('Transformer deleted');
      navigate('/transformers');
    },
    onError: notifyApiError
  });

  if (!id) return <ErrorState error={new Error('Missing transformer id')} title="Transformer unavailable" />;
  if (transformerQuery.isLoading) return <Loading label="Loading transformer" />;
  if (transformerQuery.error) return <ErrorState error={transformerQuery.error} title="Transformer unavailable" />;
  if (!item) return <EmptyState title="Transformer not found" message="The requested transformer record could not be found." />;

  return (
    <div className="page-stack detail-page">
      <section className="detail-hero">
        <div>
          <Link className="back-link" to="/transformers">
            <ArrowLeft size={16} />
            <span>Back to Registry</span>
          </Link>
          <div className="detail-title-row">
            <div>
              <h1>{getTransformerName(item)}</h1>
              <p>{getSiteLabel(item)}</p>
            </div>
            <div className="detail-badge-row">
              <span className={statusBadgeClass(item.operational_status)}>{readableLabel(item.operational_status)}</span>
              <span className={conditionBadgeClass(condition)}>{readableLabel(condition)}</span>
            </div>
          </div>
        </div>
        <div className="detail-action-row">
          <Link className="secondary-button" to={`/transformers/${item._id}/edit`}>
            <Pencil size={16} />
            <span>Edit</span>
          </Link>
          <Link className="primary-button" to={`/inspections/new?transformerId=${item._id}`}>
            <Plus size={16} />
            <span>New Inspection</span>
          </Link>
          <Link className="secondary-button" to={`/faults/new?transformerId=${item._id}`}>
            <ShieldAlert size={16} />
            <span>Report Fault</span>
          </Link>
          <button className="secondary-button" type="button" onClick={refreshAll}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button className="secondary-button warning-button" type="button" onClick={() => setShowDecommission((current) => !current)} disabled={item.operational_status === 'Decommissioned'}>
            <PowerOff size={16} />
            <span>Decommission</span>
          </button>
          <button className="secondary-button danger-button" type="button" onClick={() => setShowDelete((current) => !current)}>
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      </section>

      {showDecommission && (
        <section className="panel confirmation-panel">
          <div>
            <h2>Decommission transformer</h2>
            <p>Choose a reason before changing this transformer to decommissioned.</p>
          </div>
          <label>
            <span>Reason</span>
            <select value={decommissionReason} onChange={(event) => setDecommissionReason(event.target.value as DecommissionPayload['reason'])}>
              {decommissionReasons.map((reason) => (
                <option value={reason} key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={() => setShowDecommission(false)} disabled={decommissionMutation.isPending}>Cancel</button>
            <button className="primary-button warning-button" type="button" onClick={() => decommissionMutation.mutate({ reason: decommissionReason })} disabled={decommissionMutation.isPending}>
              <PowerOff size={16} />
              <span>{decommissionMutation.isPending ? 'Decommissioning' : 'Confirm Decommission'}</span>
            </button>
          </div>
        </section>
      )}

      {showDelete && (
        <section className="panel confirmation-panel danger-confirmation">
          <div>
            <h2>Delete transformer</h2>
            <p>This soft deletes the registry record. Type DELETE to confirm.</p>
          </div>
          <label>
            <span>Confirmation</span>
            <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="DELETE" />
          </label>
          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={() => setShowDelete(false)} disabled={deleteMutation.isPending}>Cancel</button>
            <button className="primary-button danger-button" type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending || deleteConfirmation !== 'DELETE'}>
              <Trash2 size={16} />
              <span>{deleteMutation.isPending ? 'Deleting' : 'Confirm Delete'}</span>
            </button>
          </div>
        </section>
      )}

      <section className="status-strip detail-status-strip">
        <div>
          <Zap size={18} />
          <span>{getTerritory(item)} / {getServiceArea(item)} / {getFeeder(item)}</span>
        </div>
        <small>{openFaults.length > 0 ? `${openFaults.length} open fault${openFaults.length === 1 ? '' : 's'}` : 'No open faults recorded'}</small>
      </section>

      <section className="asset-summary-grid" aria-label="Transformer summary">
        <SummaryCard label="kVA Rating" value={item.kva_rating ? `${item.kva_rating.toLocaleString()} kVA` : 'Not recorded'} icon={Zap} />
        <SummaryCard label="Network Voltage" value={item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'} icon={CircuitBoard} />
        <SummaryCard label="Manufacturer" value={notRecorded(item.manufacturer)} icon={Info} />
        <SummaryCard label="Serial Number" value={notRecorded(item.serial_number)} icon={Info} />
        <SummaryCard label="Territory" value={getTerritory(item)} icon={MapPinned} />
        <SummaryCard label="Service Area" value={getServiceArea(item)} icon={MapPinned} />
        <SummaryCard label="Feeder" value={getFeeder(item)} icon={MapPinned} />
        <SummaryCard label="Last Inspection" value={formatDate(item.last_inspection_date || latestInspection?.inspection_date)} icon={CalendarCheck} />
        <SummaryCard label="Open Fault" value={yesNoBadge(item.has_open_fault || openFaults.length > 0)} icon={ShieldAlert} />
        <SummaryCard label="Record Status" value={readableLabel(item.record_status)} icon={ClipboardCheck} />
      </section>

      <section className="panel detail-tabs-panel">
        <div className="detail-tabs" role="tablist" aria-label="Transformer detail sections">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.id ? 'active' : undefined}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              key={tab.id}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' && <OverviewTab item={item} latestInspection={latestInspection} />}
      {activeTab === 'specifications' && <SpecificationsTab item={item} />}
      {activeTab === 'location' && <LocationTab item={item} />}
      {activeTab === 'faults' && <FaultsTab query={faultsQuery} transformerId={item._id} />}
      {activeTab === 'inspections' && <InspectionsTab listQuery={inspectionsQuery} latestQuery={latestInspectionQuery} />}
      {activeTab === 'maintenance' && <MaintenanceTab query={maintenanceQuery} />}
      {activeTab === 'timeline' && <TimelineTab query={timelineQuery} />}
      {activeTab === 'qr' && <QrTab item={item} query={qrQuery} />}
    </div>
  );
}
