import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CalendarClock, FileText, RefreshCw, Search } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { reportApi, ReportFilters, ReportKind, ReportResult } from '../../api/reportApi';
import { referenceDataApi } from '../../api/referenceDataApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Fault, Inspection, MaintenanceRecord, ReferenceItem, Transformer, User } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

type ReportTab = {
  kind: ReportKind;
  label: string;
  description: string;
};

type FilterForm = {
  startDate: string;
  endDate: string;
  territory_id: string;
  service_area_id: string;
  feeder_id: string;
  district_id: string;
  network_voltage_kv: string;
  kva_rating: string;
  operational_status: string;
  transformer_id: string;
  condition: string;
  fault_status: string;
  severity: string;
  fault_type: string;
  maintenance_type: string;
};

type FilterErrors = Partial<Record<keyof FilterForm, string>>;

const tabs: ReportTab[] = [
  {
    kind: 'transformers',
    label: 'Transformer Report',
    description: 'Asset status, rating, location, and latest condition across the transformer fleet.'
  },
  {
    kind: 'inspections',
    label: 'Inspection Report',
    description: 'Inspection activity, field condition, and recommended action summaries.'
  },
  {
    kind: 'faults',
    label: 'Fault Report',
    description: 'Incident and fault records by type, severity, status, and resolution progress.'
  },
  {
    kind: 'maintenance',
    label: 'Maintenance Report',
    description: 'Maintenance work history, technician activity, status, and next-service planning.'
  },
  {
    kind: 'asset-register',
    label: 'Asset Register',
    description: 'Operational asset register with identity, rating, location, status, and GPS availability.'
  }
];

const defaultFilters: FilterForm = {
  startDate: '',
  endDate: '',
  territory_id: '',
  service_area_id: '',
  feeder_id: '',
  district_id: '',
  network_voltage_kv: '',
  kva_rating: '',
  operational_status: '',
  transformer_id: '',
  condition: '',
  fault_status: '',
  severity: '',
  fault_type: '',
  maintenance_type: ''
};

const voltageOptions = [11, 33];
const kvaOptions = [50, 100, 160, 200, 250, 315, 500, 630, 1000];
const operationalStatusOptions = ['Active', 'Inactive', 'Decommissioned', 'Under Maintenance', 'Faulty'];
const conditionOptions = ['Good', 'Fair', 'Poor', 'Critical'];
const faultStatusOptions = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const severityOptions = ['Minor', 'Major', 'Critical', 'Complete Outage'];
const faultTypeOptions = ['Overload', 'Oil Leak', 'Bushing Failure', 'Winding Failure', 'Complete Failure', 'Fire', 'Theft', 'Vandalism', 'LV Side Fault', 'HV Side Fault', 'Other'];
const maintenanceTypeOptions = ['Preventive', 'Corrective', 'Emergency'];

const referenceQueries = [
  { queryKey: ['reference-data', 'territories'], queryFn: referenceDataApi.territories },
  { queryKey: ['reference-data', 'service-areas'], queryFn: referenceDataApi.serviceAreas },
  { queryKey: ['reference-data', 'feeders'], queryFn: referenceDataApi.feeders },
  { queryKey: ['reference-data', 'districts'], queryFn: referenceDataApi.districts },
  { queryKey: ['reference-data', 'ratings'], queryFn: referenceDataApi.ratings }
] as const;

function refName(value?: string | { name?: string; code?: string }) {
  if (!value || typeof value === 'string') return undefined;
  return value.name || value.code;
}

function optionLabel(item: ReferenceItem) {
  return item.name || item.display_label || item.code || (item.kva && item.network_voltage_kv ? `${item.kva} kVA / ${item.network_voltage_kv} kV` : item._id);
}

function userName(value?: string | User) {
  if (!value) return 'Not assigned';
  if (typeof value === 'string') return value;
  return value.name || value.email || 'Not assigned';
}

function siteName(transformer?: Transformer) {
  if (!transformer) return 'Not recorded';
  return transformer.location_administrative?.site_name || transformer.site_name || 'Not recorded';
}

function transformerFrom(value?: string | Transformer) {
  return value && typeof value === 'object' ? value : undefined;
}

function territoryName(item?: Transformer) {
  return item?.location_operational?.territory_name || refName(item?.location_operational?.territory_id) || 'Not recorded';
}

function serviceAreaName(item?: Transformer) {
  return item?.location_operational?.service_area_name || refName(item?.location_operational?.service_area_id) || 'Not recorded';
}

function feederName(item?: Transformer) {
  return item?.location_operational?.feeder_name || item?.location_operational?.feeder_code || refName(item?.location_operational?.feeder_id) || 'Not recorded';
}

function conditionLabel(item?: Transformer) {
  return item?.condition || item?.overall_condition || item?.latest_inspection?.physical?.overall_condition || item?.latest_inspection?.overall_condition || 'Not recorded';
}

function badgeClass(value?: string) {
  if (value === 'Critical' || value === 'Poor' || value === 'Faulty' || value === 'Complete Outage') return 'badge danger';
  if (value === 'Fair' || value === 'Assigned' || value === 'In Progress' || value === 'Under Maintenance' || value === 'Major') return 'badge amber';
  if (value === 'Good' || value === 'Active' || value === 'Resolved' || value === 'Closed') return 'badge green';
  return 'badge muted-badge';
}

function cleanFilters(kind: ReportKind, values: FilterForm): ReportFilters {
  const filters: ReportFilters = {};
  if (values.startDate) filters.startDate = values.startDate;
  if (values.endDate) filters.endDate = values.endDate;
  if (values.territory_id) filters.territory_id = values.territory_id;
  if (values.service_area_id) filters.service_area_id = values.service_area_id;
  if (values.feeder_id) filters.feeder_id = values.feeder_id;
  if (values.district_id) filters.district_id = values.district_id;
  if (values.network_voltage_kv) filters.network_voltage_kv = Number(values.network_voltage_kv) as 11 | 33;
  if (values.kva_rating) filters.kva_rating = Number(values.kva_rating);
  if (values.operational_status) filters.operational_status = values.operational_status;

  if (kind === 'inspections') {
    if (values.transformer_id.trim()) filters.transformer_id = values.transformer_id.trim();
    if (values.condition) filters.condition = values.condition;
  }
  if (kind === 'faults') {
    if (values.fault_status) filters.fault_status = values.fault_status;
    if (values.severity) filters.severity = values.severity;
    if (values.fault_type) filters.fault_type = values.fault_type;
  }
  if (kind === 'maintenance' && values.maintenance_type) {
    filters.maintenance_type = values.maintenance_type;
  }

  return filters;
}

function validateFilters(values: FilterForm) {
  const errors: FilterErrors = {};
  if (values.startDate && values.endDate && new Date(values.endDate) < new Date(values.startDate)) {
    errors.endDate = 'End date must be after the start date.';
  }
  return errors;
}

function appliedFilterLabels(filters?: ReportFilters) {
  if (!filters || Object.keys(filters).length === 0) return [];
  return Object.entries(filters).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`);
}

function SummaryCards({ result }: { result?: ReportResult }) {
  const total = typeof result?.summary.total === 'number' ? result.summary.total : result?.rows.length ?? 0;
  const generated = result?.generatedAt ? formatDate(result.generatedAt) : 'Not generated';
  return (
    <div className="report-summary-grid">
      <article className="registry-summary-card">
        <span>Total records</span>
        <strong>{total.toLocaleString()}</strong>
      </article>
      <article className="registry-summary-card green">
        <span>Report status</span>
        <strong>{result ? 'Ready' : 'Idle'}</strong>
      </article>
      <article className="registry-summary-card amber">
        <span>Generated</span>
        <strong>{generated}</strong>
      </article>
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function InputField({ label, type = 'text', value, onChange, error }: { label: string; type?: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function renderReportRows(kind: ReportKind, rows: unknown[]) {
  if (kind === 'transformers') {
    return (rows as Transformer[]).map((row) => (
      <tr key={row._id}>
        <td>{getTransformerName(row)}</td>
        <td>{siteName(row)}</td>
        <td>{territoryName(row)}</td>
        <td>{serviceAreaName(row)}</td>
        <td>{feederName(row)}</td>
        <td>{row.kva_rating ?? 'Not recorded'}</td>
        <td>{row.network_voltage_kv ? `${row.network_voltage_kv} kV` : 'Not recorded'}</td>
        <td><span className={badgeClass(row.operational_status)}>{row.operational_status || 'Not recorded'}</span></td>
        <td>{conditionLabel(row)}</td>
      </tr>
    ));
  }

  if (kind === 'inspections') {
    return (rows as Inspection[]).map((row) => {
      const transformer = transformerFrom(row.transformer_id);
      return (
        <tr key={row._id}>
          <td>{formatDate(row.inspection_date)}</td>
          <td>{getTransformerName(transformer)}</td>
          <td>{siteName(transformer)}</td>
          <td>{userName(row.inspector_id || row.inspected_by)}</td>
          <td><span className={badgeClass(row.physical?.overall_condition || row.overall_condition)}>{row.physical?.overall_condition || row.overall_condition || 'Not recorded'}</span></td>
          <td>{row.recommended_action || row.recommended_action_details || 'Not recorded'}</td>
        </tr>
      );
    });
  }

  if (kind === 'faults') {
    return (rows as Fault[]).map((row) => {
      const transformer = transformerFrom(row.transformer_id);
      return (
        <tr key={row._id}>
          <td>{row.fault_type || 'Not recorded'}</td>
          <td>{getTransformerName(transformer)}</td>
          <td><span className={badgeClass(row.severity)}>{row.severity || 'Not recorded'}</span></td>
          <td><span className={badgeClass(row.fault_status)}>{row.fault_status || 'Not recorded'}</span></td>
          <td>{formatDate(row.fault_date)}</td>
          <td>{userName(row.assigned_to)}</td>
          <td>{row.resolution_description || row.root_cause || 'Not recorded'}</td>
        </tr>
      );
    });
  }

  if (kind === 'maintenance') {
    return (rows as MaintenanceRecord[]).map((row) => {
      const transformer = transformerFrom(row.transformer_id);
      return (
        <tr key={row._id}>
          <td>{formatDate(row.maintenance_date)}</td>
          <td>{getTransformerName(transformer)}</td>
          <td>{row.maintenance_type || 'Not recorded'}</td>
          <td><span className={badgeClass(row.status)}>{row.status || row.sync_status || 'Not recorded'}</span></td>
          <td>{userName(row.technician_id) || row.technician_name || 'Not assigned'}</td>
          <td>{formatDate(row.next_maintenance_date)}</td>
        </tr>
      );
    });
  }

  return (rows as Array<Record<string, unknown>>).map((row, index) => (
    <tr key={`${row['Asset ID'] ?? index}`}>
      <td>{String(row['Asset ID'] ?? 'Not recorded')}</td>
      <td>{String(row['Serial Number'] ?? 'Not recorded')}</td>
      <td>{String(row.Manufacturer ?? 'Not recorded')}</td>
      <td>{String(row.Rating ?? row.kVA ?? 'Not recorded')}</td>
      <td>{String(row['Network Voltage'] ?? 'Not recorded')}</td>
      <td>{[row.Territory, row['Service Area'], row.Feeder, row.District].filter(Boolean).join(' / ') || 'Not recorded'}</td>
      <td><span className={badgeClass(String(row['Operational Status'] ?? ''))}>{String(row['Operational Status'] ?? 'Not recorded')}</span></td>
      <td>{String(row['GPS Coordinates'] ?? '').includes('N/A') ? 'Missing GPS' : 'GPS recorded'}</td>
    </tr>
  ));
}

function columnsFor(kind: ReportKind) {
  if (kind === 'transformers') return ['Asset ID', 'Site', 'Territory', 'Service Area', 'Feeder', 'kVA', 'Voltage', 'Status', 'Condition'];
  if (kind === 'inspections') return ['Date', 'Transformer', 'Site', 'Inspector', 'Condition', 'Recommended Action'];
  if (kind === 'faults') return ['Fault Type', 'Transformer', 'Severity', 'Status', 'Date', 'Assigned To', 'Resolution'];
  if (kind === 'maintenance') return ['Date', 'Transformer', 'Type', 'Status', 'Technician', 'Next Maintenance'];
  return ['Asset ID', 'Serial Number', 'Manufacturer', 'kVA', 'Voltage', 'Location', 'Status', 'GPS'];
}

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="inline-error" role="alert">
      <AlertTriangle size={16} />
      <span>{children}</span>
    </div>
  );
}

export function ReportsPage() {
  const [activeKind, setActiveKind] = useState<ReportKind>('transformers');
  const [filters, setFilters] = useState<FilterForm>(defaultFilters);
  const [submitted, setSubmitted] = useState<Partial<Record<ReportKind, ReportFilters>>>({});
  const [formErrors, setFormErrors] = useState<FilterErrors>({});

  const [territoriesQuery, serviceAreasQuery, feedersQuery, districtsQuery, ratingsQuery] = useQueries({ queries: referenceQueries });
  const activeTab = tabs.find((tab) => tab.kind === activeKind) ?? tabs[0];
  const submittedFilters = submitted[activeKind];

  const reportQuery = useQuery({
    queryKey: ['reports', activeKind, submittedFilters],
    queryFn: () => reportApi.generate(activeKind, submittedFilters ?? {}),
    enabled: Boolean(submittedFilters),
    retry: 1
  });

  const territoryOptions = (territoriesQuery.data ?? []).map((item) => ({ value: item._id, label: optionLabel(item) }));
  const serviceAreaOptions = (serviceAreasQuery.data ?? []).map((item) => ({ value: item._id, label: optionLabel(item) }));
  const feederOptions = (feedersQuery.data ?? []).map((item) => ({ value: item._id, label: optionLabel(item) }));
  const districtOptions = (districtsQuery.data ?? []).map((item) => ({ value: item._id, label: optionLabel(item) }));
  const ratingOptions = useMemo(() => {
    const values = new Set<number>(kvaOptions);
    (ratingsQuery.data ?? []).forEach((item) => {
      if (typeof item.kva === 'number') values.add(item.kva);
    });
    return Array.from(values).sort((a, b) => a - b).map((value) => ({ value: String(value), label: `${value} kVA` }));
  }, [ratingsQuery.data]);

  const setFilter = (key: keyof FilterForm, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    if (formErrors[key]) setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const generate = (event?: FormEvent) => {
    event?.preventDefault();
    const errors = validateFilters(filters);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const nextFilters = cleanFilters(activeKind, filters);
    const alreadySubmitted = JSON.stringify(nextFilters) === JSON.stringify(submitted[activeKind]);
    setSubmitted((current) => ({ ...current, [activeKind]: nextFilters }));
    if (alreadySubmitted) void reportQuery.refetch();
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setFormErrors({});
  };

  const activeFilterLabels = appliedFilterLabels(submittedFilters);

  return (
    <div className="page-stack reports-page">
      <section className="detail-hero reports-hero">
        <div>
          <div className="breadcrumb">Operations / Reports</div>
          <div className="detail-title-row">
            <div>
              <h1>Reports</h1>
              <p>Generate JSON-backed operational reports from tested backend report endpoints.</p>
            </div>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={() => void reportQuery.refetch()} disabled={!submittedFilters || reportQuery.isFetching}>
          <RefreshCw size={16} />
          <span>{reportQuery.isFetching ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </section>

      <section className="report-tabs" aria-label="Report types">
        {tabs.map((tab) => (
          <button key={tab.kind} className={tab.kind === activeKind ? 'report-tab active' : 'report-tab'} type="button" onClick={() => setActiveKind(tab.kind)}>
            <FileText size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </section>

      <section className="panel report-filter-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{activeTab.label}</span>
            <h2>{activeTab.description}</h2>
          </div>
          <span className="muted">Reports run only when generated</span>
        </div>

        <form className="report-filter-grid" onSubmit={generate}>
          <InputField label="Start date" type="date" value={filters.startDate} onChange={(value) => setFilter('startDate', value)} />
          <InputField label="End date" type="date" value={filters.endDate} onChange={(value) => setFilter('endDate', value)} error={formErrors.endDate} />
          <SelectField label="Territory" value={filters.territory_id} onChange={(value) => setFilter('territory_id', value)} options={territoryOptions} disabled={territoriesQuery.isLoading} />
          <SelectField label="Service area" value={filters.service_area_id} onChange={(value) => setFilter('service_area_id', value)} options={serviceAreaOptions} disabled={serviceAreasQuery.isLoading} />
          <SelectField label="Feeder" value={filters.feeder_id} onChange={(value) => setFilter('feeder_id', value)} options={feederOptions} disabled={feedersQuery.isLoading} />
          <SelectField label="District" value={filters.district_id} onChange={(value) => setFilter('district_id', value)} options={districtOptions} disabled={districtsQuery.isLoading} />
          <SelectField label="Network voltage" value={filters.network_voltage_kv} onChange={(value) => setFilter('network_voltage_kv', value)} options={voltageOptions.map((value) => ({ value: String(value), label: `${value} kV` }))} />
          <SelectField label="kVA rating" value={filters.kva_rating} onChange={(value) => setFilter('kva_rating', value)} options={ratingOptions} />
          <SelectField label="Operational status" value={filters.operational_status} onChange={(value) => setFilter('operational_status', value)} options={operationalStatusOptions.map((value) => ({ value, label: value }))} />

          {activeKind === 'inspections' ? (
            <>
              <InputField label="Transformer ID" value={filters.transformer_id} onChange={(value) => setFilter('transformer_id', value)} />
              <SelectField label="Condition" value={filters.condition} onChange={(value) => setFilter('condition', value)} options={conditionOptions.map((value) => ({ value, label: value }))} />
            </>
          ) : null}

          {activeKind === 'faults' ? (
            <>
              <SelectField label="Fault status" value={filters.fault_status} onChange={(value) => setFilter('fault_status', value)} options={faultStatusOptions.map((value) => ({ value, label: value }))} />
              <SelectField label="Severity" value={filters.severity} onChange={(value) => setFilter('severity', value)} options={severityOptions.map((value) => ({ value, label: value }))} />
              <SelectField label="Fault type" value={filters.fault_type} onChange={(value) => setFilter('fault_type', value)} options={faultTypeOptions.map((value) => ({ value, label: value }))} />
            </>
          ) : null}

          {activeKind === 'maintenance' ? (
            <SelectField label="Maintenance type" value={filters.maintenance_type} onChange={(value) => setFilter('maintenance_type', value)} options={maintenanceTypeOptions.map((value) => ({ value, label: value }))} />
          ) : null}

          <div className="report-filter-actions">
            <button className="primary-button" type="submit" disabled={reportQuery.isFetching}>
              <Search size={16} />
              <span>{reportQuery.isFetching ? 'Generating' : 'Generate report'}</span>
            </button>
            <button className="secondary-button" type="button" onClick={resetFilters}>Clear filters</button>
          </div>
        </form>

        {Object.values(formErrors).filter(Boolean).map((error) => (
          <ErrorBanner key={error}>{error}</ErrorBanner>
        ))}
      </section>

      <SummaryCards result={reportQuery.data} />

      <section className="panel report-ledger">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Applied filters</span>
            <h2>{reportQuery.data ? `Last generated ${formatDate(reportQuery.data.generatedAt)}` : 'No report generated yet'}</h2>
          </div>
          <BarChart3 size={20} />
        </div>
        {activeFilterLabels.length > 0 ? (
          <div className="applied-filter-list">
            {activeFilterLabels.map((label) => <span className="badge" key={label}>{label}</span>)}
          </div>
        ) : (
          <span className="muted">No filters have been applied to this report.</span>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Results</span>
            <h2>{activeTab.label}</h2>
          </div>
          <CalendarClock size={20} />
        </div>

        {!submittedFilters ? (
          <EmptyState title="Generate a report" message="Choose filters if needed, then generate the report to load results." />
        ) : reportQuery.isLoading ? (
          <Loading label="Generating report" />
        ) : reportQuery.error ? (
          <ErrorState error={reportQuery.error} title="Report unavailable" />
        ) : (
          <DataTable
            columns={columnsFor(activeKind)}
            rows={reportQuery.data?.rows ?? []}
            emptyTitle="No report rows"
            emptyMessage="No records matched the selected filters."
            renderRow={(_, index) => renderReportRows(activeKind, reportQuery.data?.rows ?? [])[index]}
          />
        )}
      </section>
    </div>
  );
}
