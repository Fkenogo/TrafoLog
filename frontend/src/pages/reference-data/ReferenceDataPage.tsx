import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Edit3, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { getApiErrorMessage, notifyApiError } from '../../api/http';
import {
  FeederPayload,
  RatingPayload,
  referenceDataApi,
  ServiceAreaPayload,
  TerritoryPayload
} from '../../api/referenceDataApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { ReferenceItem } from '../../types/api';
import { formatDate } from '../../utils/format';

type ReferenceKey = 'territories' | 'serviceAreas' | 'feeders' | 'districts' | 'ratings';
type WritableReferenceKey = Exclude<ReferenceKey, 'districts'>;

type ReferenceFormValues = {
  name: string;
  code: string;
  region: string;
  territory_id: string;
  service_area_id: string;
  network_voltage_kv: string;
  kva: string;
};

type ConfirmDelete = {
  type: WritableReferenceKey;
  item: ReferenceItem;
};

const tabs: Array<{ key: ReferenceKey; label: string; writable: boolean }> = [
  { key: 'territories', label: 'Territories', writable: true },
  { key: 'serviceAreas', label: 'Service Areas', writable: true },
  { key: 'feeders', label: 'Feeders', writable: true },
  { key: 'districts', label: 'Districts', writable: false },
  { key: 'ratings', label: 'Ratings', writable: true }
];

const listQueries = {
  territories: { queryKey: ['reference-data', 'territories'], queryFn: referenceDataApi.territories },
  serviceAreas: { queryKey: ['reference-data', 'service-areas'], queryFn: referenceDataApi.serviceAreas },
  feeders: { queryKey: ['reference-data', 'feeders'], queryFn: referenceDataApi.feeders },
  districts: { queryKey: ['reference-data', 'districts'], queryFn: referenceDataApi.districts },
  ratings: { queryKey: ['reference-data', 'ratings'], queryFn: referenceDataApi.ratings }
} as const;

const baseString = z.string().trim();
const formSchemas: Record<WritableReferenceKey, z.ZodTypeAny> = {
  territories: z.object({
    name: baseString.min(2, 'Territory name is required'),
    code: baseString.min(2, 'Territory code is required'),
    region: baseString.optional().default(''),
    territory_id: baseString.optional().default(''),
    service_area_id: baseString.optional().default(''),
    network_voltage_kv: baseString.optional().default(''),
    kva: baseString.optional().default('')
  }),
  serviceAreas: z.object({
    name: baseString.min(2, 'Service area name is required'),
    code: baseString.optional().default(''),
    region: baseString.optional().default(''),
    territory_id: baseString.min(1, 'Choose a territory'),
    service_area_id: baseString.optional().default(''),
    network_voltage_kv: baseString.optional().default(''),
    kva: baseString.optional().default('')
  }),
  feeders: z.object({
    name: baseString.min(2, 'Feeder name is required'),
    code: baseString.optional().default(''),
    region: baseString.optional().default(''),
    territory_id: baseString.optional().default(''),
    service_area_id: baseString.min(1, 'Choose a service area'),
    network_voltage_kv: z.enum(['11', '33'], { message: 'Choose 11 kV or 33 kV' }),
    kva: baseString.optional().default('')
  }),
  ratings: z.object({
    name: baseString.optional().default(''),
    code: baseString.optional().default(''),
    region: baseString.optional().default(''),
    territory_id: baseString.optional().default(''),
    service_area_id: baseString.optional().default(''),
    network_voltage_kv: z.enum(['11', '33'], { message: 'Choose 11 kV or 33 kV' }),
    kva: z
      .string()
      .trim()
      .min(1, 'kVA rating is required')
      .refine((value) => Number(value) > 0, 'kVA rating must be greater than 0')
  })
};

const defaultValues: ReferenceFormValues = {
  name: '',
  code: '',
  region: '',
  territory_id: '',
  service_area_id: '',
  network_voltage_kv: '',
  kva: ''
};

const regionOptions = ['Central', 'Eastern', 'Northern', 'Western'];
const voltageOptions = [11, 33];
const kvaOptions = [50, 100, 160, 200, 250, 315, 500, 630, 1000];

function refId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_id' in value && typeof value._id === 'string') return value._id;
  return '';
}

function refLabel(value: unknown, fallback = 'Not assigned') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const item = value as { name?: string; code?: string; display_label?: string; _id?: string };
    return item.name || item.display_label || item.code || item._id || fallback;
  }
  return fallback;
}

function findLabel(items: ReferenceItem[], id: string, fallback = 'Not assigned') {
  if (!id) return fallback;
  const item = items.find((candidate) => candidate._id === id);
  return item?.name || item?.display_label || item?.code || id;
}

function itemTitle(item: ReferenceItem) {
  return item.name || item.display_label || (item.kva && item.network_voltage_kv ? `${item.kva} kVA / ${item.network_voltage_kv} kV` : '') || item.code || item._id;
}

function isWritableKey(value: ReferenceKey): value is WritableReferenceKey {
  return value !== 'districts';
}

function blankFromItem(type: WritableReferenceKey, item?: ReferenceItem): ReferenceFormValues {
  if (!item) return defaultValues;
  return {
    name: item.name ?? '',
    code: item.code ?? '',
    region: item.region ?? '',
    territory_id: refId(item.territory_id),
    service_area_id: refId(item.service_area_id),
    network_voltage_kv: item.network_voltage_kv ? String(item.network_voltage_kv) : '',
    kva: item.kva ? String(item.kva) : ''
  };
}

function buildPayload(type: WritableReferenceKey, values: ReferenceFormValues) {
  if (type === 'territories') {
    const payload: TerritoryPayload = { name: values.name.trim(), code: values.code.trim().toUpperCase() };
    if (values.region.trim()) payload.region = values.region.trim();
    return payload;
  }
  if (type === 'serviceAreas') {
    const payload: ServiceAreaPayload = { name: values.name.trim(), territory_id: values.territory_id };
    if (values.code.trim()) payload.code = values.code.trim().toUpperCase();
    return payload;
  }
  if (type === 'feeders') {
    const payload: FeederPayload = {
      name: values.name.trim(),
      service_area_id: values.service_area_id,
      network_voltage_kv: Number(values.network_voltage_kv)
    };
    if (values.code.trim()) payload.code = values.code.trim().toUpperCase();
    return payload;
  }
  const payload: RatingPayload = { kva: Number(values.kva), network_voltage_kv: Number(values.network_voltage_kv) };
  return payload;
}

function matchesSearch(item: ReferenceItem, type: ReferenceKey, search: string, related: { territories: ReferenceItem[]; serviceAreas: ReferenceItem[] }) {
  if (!search.trim()) return true;
  const text = search.trim().toLowerCase();
  const relatedTerritory = type === 'serviceAreas' ? findLabel(related.territories, refId(item.territory_id), '') : '';
  const relatedServiceArea = type === 'feeders' ? findLabel(related.serviceAreas, refId(item.service_area_id), '') : '';
  return [
    item.name,
    item.code,
    item.region,
    item.location_town,
    item.display_label,
    item.kva,
    item.network_voltage_kv,
    relatedTerritory,
    relatedServiceArea
  ]
    .join(' ')
    .toLowerCase()
    .includes(text);
}

function filterByRelationship(item: ReferenceItem, type: ReferenceKey, territoryFilter: string, serviceAreaFilter: string, voltageFilter: string) {
  if (type === 'serviceAreas' && territoryFilter) return refId(item.territory_id) === territoryFilter;
  if (type === 'feeders' && serviceAreaFilter) return refId(item.service_area_id) === serviceAreaFilter;
  if (type === 'ratings' && voltageFilter) return String(item.network_voltage_kv ?? '') === voltageFilter;
  if (type === 'districts' && territoryFilter) return item.region === territoryFilter;
  return true;
}

function getColumns(type: ReferenceKey) {
  if (type === 'territories') return ['Name', 'Code', 'Region', 'Status', 'Updated', 'Edit', 'Delete'];
  if (type === 'serviceAreas') return ['Name', 'Code', 'Territory', 'Status', 'Updated', 'Edit', 'Delete'];
  if (type === 'feeders') return ['Name', 'Code', 'Service Area', 'Voltage', 'Status', 'Updated', 'Edit', 'Delete'];
  if (type === 'ratings') return ['Rating', 'kVA', 'Network Voltage', 'Standard', 'Status', 'Updated', 'Edit', 'Delete'];
  return ['District', 'Code', 'Region', 'Status', 'Updated'];
}

function tabDescription(type: ReferenceKey) {
  if (type === 'territories') return 'Maintain operational territories used by transformer ownership and reporting.';
  if (type === 'serviceAreas') return 'Manage service areas and their parent territory assignments.';
  if (type === 'feeders') return 'Manage feeder names, codes, service areas, and network voltage.';
  if (type === 'ratings') return 'Maintain standard transformer kVA and network voltage reference values.';
  return 'District data is read-only because backend write endpoints are not available.';
}

function ReferenceForm({
  type,
  editing,
  territories,
  serviceAreas,
  saving,
  error,
  onCancel,
  onSubmit
}: {
  type: WritableReferenceKey;
  editing?: ReferenceItem;
  territories: ReferenceItem[];
  serviceAreas: ReferenceItem[];
  saving: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (values: ReferenceFormValues) => void;
}) {
  const form = useForm<ReferenceFormValues>({
    resolver: zodResolver(formSchemas[type]),
    defaultValues: blankFromItem(type, editing)
  });

  useEffect(() => {
    form.reset(blankFromItem(type, editing));
  }, [editing, form, type]);

  const title = editing ? `Edit ${itemTitle(editing)}` : `Add ${tabs.find((tab) => tab.key === type)?.label.slice(0, -1)}`;

  return (
    <section className="panel reference-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <span>Only fields supported by the backend are shown.</span>
        </div>
        <button className="icon-button" type="button" onClick={onCancel} aria-label="Close form"><X size={16} /></button>
      </div>

      <form className="transformer-form reference-form" onSubmit={form.handleSubmit(onSubmit)}>
        {error ? <div className="form-error">{getApiErrorMessage(error)}</div> : null}
        <div className="form-grid reference-form-grid">
          {(type === 'territories' || type === 'serviceAreas' || type === 'feeders') ? (
            <label>
              <span>Name</span>
              <input {...form.register('name')} placeholder="Name" />
              {form.formState.errors.name ? <small className="field-error">{form.formState.errors.name.message}</small> : null}
            </label>
          ) : null}

          {(type === 'territories' || type === 'serviceAreas' || type === 'feeders') ? (
            <label>
              <span>Code</span>
              <input {...form.register('code')} placeholder="Code" />
              {form.formState.errors.code ? <small className="field-error">{form.formState.errors.code.message}</small> : null}
            </label>
          ) : null}

          {type === 'territories' ? (
            <label>
              <span>Region</span>
              <select {...form.register('region')}>
                <option value="">No region selected</option>
                {regionOptions.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
              {form.formState.errors.region ? <small className="field-error">{form.formState.errors.region.message}</small> : null}
            </label>
          ) : null}

          {type === 'serviceAreas' ? (
            <label>
              <span>Territory</span>
              <select {...form.register('territory_id')}>
                <option value="">Choose territory</option>
                {territories.map((territory) => <option key={territory._id} value={territory._id}>{territory.name || territory.code || territory._id}</option>)}
              </select>
              {form.formState.errors.territory_id ? <small className="field-error">{form.formState.errors.territory_id.message}</small> : null}
            </label>
          ) : null}

          {type === 'feeders' ? (
            <label>
              <span>Service Area</span>
              <select {...form.register('service_area_id')}>
                <option value="">Choose service area</option>
                {serviceAreas.map((serviceArea) => <option key={serviceArea._id} value={serviceArea._id}>{serviceArea.name || serviceArea.code || serviceArea._id}</option>)}
              </select>
              {form.formState.errors.service_area_id ? <small className="field-error">{form.formState.errors.service_area_id.message}</small> : null}
            </label>
          ) : null}

          {(type === 'feeders' || type === 'ratings') ? (
            <label>
              <span>Network Voltage</span>
              <select {...form.register('network_voltage_kv')}>
                <option value="">Choose voltage</option>
                {voltageOptions.map((voltage) => <option key={voltage} value={String(voltage)}>{voltage} kV</option>)}
              </select>
              {form.formState.errors.network_voltage_kv ? <small className="field-error">{form.formState.errors.network_voltage_kv.message}</small> : null}
            </label>
          ) : null}

          {type === 'ratings' ? (
            <label>
              <span>kVA Rating</span>
              <select {...form.register('kva')}>
                <option value="">Choose kVA</option>
                {kvaOptions.map((kva) => <option key={kva} value={String(kva)}>{kva} kVA</option>)}
              </select>
              {form.formState.errors.kva ? <small className="field-error">{form.formState.errors.kva.message}</small> : null}
            </label>
          ) : null}
        </div>

        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}</button>
        </div>
      </form>
    </section>
  );
}

export function ReferenceDataPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ReferenceKey>('territories');
  const [search, setSearch] = useState('');
  const [territoryFilter, setTerritoryFilter] = useState('');
  const [serviceAreaFilter, setServiceAreaFilter] = useState('');
  const [voltageFilter, setVoltageFilter] = useState('');
  const [editing, setEditing] = useState<ReferenceItem | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | undefined>();

  const queries = useQueries({
    queries: tabs.map((tab) => ({ queryKey: listQueries[tab.key].queryKey, queryFn: listQueries[tab.key].queryFn }))
  });

  const dataByKey = useMemo(() => ({
    territories: queries[0].data ?? [],
    serviceAreas: queries[1].data ?? [],
    feeders: queries[2].data ?? [],
    districts: queries[3].data ?? [],
    ratings: queries[4].data ?? []
  }), [queries]);

  const activeQuery = queries[tabs.findIndex((tab) => tab.key === activeTab)];
  const activeRows = dataByKey[activeTab];
  const activeConfig = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const writableActiveTab = isWritableKey(activeTab);
  const showForm = writableActiveTab && (isCreating || editing);

  const invalidateReferenceData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reference-data'] }),
      queryClient.invalidateQueries({ queryKey: ['transformers'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: ReferenceFormValues) => {
      if (!writableActiveTab) throw new Error('This reference data is read-only.');
      const payload = buildPayload(activeTab, values);
      if (editing) {
        if (activeTab === 'territories') return referenceDataApi.updateTerritory(editing._id, payload as TerritoryPayload);
        if (activeTab === 'serviceAreas') return referenceDataApi.updateServiceArea(editing._id, payload as ServiceAreaPayload);
        if (activeTab === 'feeders') return referenceDataApi.updateFeeder(editing._id, payload as FeederPayload);
        return referenceDataApi.updateRating(editing._id, payload as RatingPayload);
      }
      if (activeTab === 'territories') return referenceDataApi.createTerritory(payload as TerritoryPayload);
      if (activeTab === 'serviceAreas') return referenceDataApi.createServiceArea(payload as ServiceAreaPayload);
      if (activeTab === 'feeders') return referenceDataApi.createFeeder(payload as FeederPayload);
      return referenceDataApi.createRating(payload as RatingPayload);
    },
    onSuccess: async () => {
      toast.success(editing ? 'Reference data updated' : 'Reference data created');
      setEditing(undefined);
      setIsCreating(false);
      await invalidateReferenceData();
    },
    onError: notifyApiError
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, item }: ConfirmDelete) => {
      if (type === 'territories') return referenceDataApi.deleteTerritory(item._id);
      if (type === 'serviceAreas') return referenceDataApi.deleteServiceArea(item._id);
      if (type === 'feeders') return referenceDataApi.deleteFeeder(item._id);
      return referenceDataApi.deleteRating(item._id);
    },
    onSuccess: async () => {
      toast.success('Reference data deleted');
      setConfirmDelete(undefined);
      await invalidateReferenceData();
    },
    onError: notifyApiError
  });

  const rows = useMemo(() => activeRows
    .filter((item) => matchesSearch(item, activeTab, search, dataByKey))
    .filter((item) => filterByRelationship(item, activeTab, territoryFilter, serviceAreaFilter, voltageFilter)), [
      activeRows,
      activeTab,
      dataByKey,
      search,
      serviceAreaFilter,
      territoryFilter,
      voltageFilter
    ]);

  const startCreate = () => {
    setEditing(undefined);
    setIsCreating(true);
    setConfirmDelete(undefined);
  };

  const startEdit = (item: ReferenceItem) => {
    setEditing(item);
    setIsCreating(false);
    setConfirmDelete(undefined);
  };

  const clearPanels = () => {
    setEditing(undefined);
    setIsCreating(false);
    setConfirmDelete(undefined);
    saveMutation.reset();
    deleteMutation.reset();
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['reference-data'] });
  };

  const renderActions = (item: ReferenceItem) => {
    if (!writableActiveTab) return null;
    return (
      <>
        <td><button className="icon-button" type="button" onClick={() => startEdit(item)} aria-label={`Edit ${itemTitle(item)}`}><Edit3 size={16} /></button></td>
        <td><button className="icon-button danger-icon" type="button" onClick={() => setConfirmDelete({ type: activeTab, item })} aria-label={`Delete ${itemTitle(item)}`}><Trash2 size={16} /></button></td>
      </>
    );
  };

  const renderRow = (item: ReferenceItem) => {
    const status = item.is_active === false ? <span className="badge danger">Inactive</span> : <span className="badge green">Active</span>;
    if (activeTab === 'territories') {
      return (
        <tr key={item._id}>
          <td>{item.name || 'Unnamed territory'}</td>
          <td>{item.code || 'Not recorded'}</td>
          <td>{item.region || 'Not recorded'}</td>
          <td>{status}</td>
          <td>{formatDate(item.updated_at || item.created_at)}</td>
          {renderActions(item)}
        </tr>
      );
    }
    if (activeTab === 'serviceAreas') {
      return (
        <tr key={item._id}>
          <td>{item.name || 'Unnamed service area'}</td>
          <td>{item.code || 'Not recorded'}</td>
          <td>{findLabel(dataByKey.territories, refId(item.territory_id), refLabel(item.territory_id))}</td>
          <td>{status}</td>
          <td>{formatDate(item.updated_at || item.created_at)}</td>
          {renderActions(item)}
        </tr>
      );
    }
    if (activeTab === 'feeders') {
      return (
        <tr key={item._id}>
          <td>{item.name || 'Unnamed feeder'}</td>
          <td>{item.code || 'Not recorded'}</td>
          <td>{findLabel(dataByKey.serviceAreas, refId(item.service_area_id), refLabel(item.service_area_id))}</td>
          <td>{item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'}</td>
          <td>{status}</td>
          <td>{formatDate(item.updated_at || item.created_at)}</td>
          {renderActions(item)}
        </tr>
      );
    }
    if (activeTab === 'ratings') {
      return (
        <tr key={item._id}>
          <td>{item.display_label || `${item.kva ?? 'Unknown'} kVA / ${item.network_voltage_kv ?? 'Unknown'} kV`}</td>
          <td>{item.kva ? `${item.kva} kVA` : 'Not recorded'}</td>
          <td>{item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'}</td>
          <td>{item.is_standard === false ? 'Custom' : 'Standard'}</td>
          <td>{status}</td>
          <td>{formatDate(item.updated_at || item.created_at)}</td>
          {renderActions(item)}
        </tr>
      );
    }
    return (
      <tr key={item._id}>
        <td>{item.name || 'Unnamed district'}</td>
        <td>{item.code || 'Not recorded'}</td>
        <td>{item.region || 'Not recorded'}</td>
        <td>{status}</td>
        <td>{formatDate(item.updated_at || item.created_at)}</td>
      </tr>
    );
  };

  return (
    <div className="page-stack reference-management-page">
      <section className="section-header">
        <div>
          <span className="eyebrow">Operations setup</span>
          <h1>Reference Data</h1>
          <p>Manage the operational lists used by transformer records, inspections, and service-area reporting.</p>
        </div>
        <div className="detail-action-row">
          <button className="secondary-button" type="button" onClick={refresh}><RefreshCw size={16} /><span>Refresh</span></button>
          {activeConfig.writable ? <button className="primary-button" type="button" onClick={startCreate}><Plus size={16} /><span>Add {activeConfig.label.slice(0, -1)}</span></button> : null}
        </div>
      </section>

      <section className="panel detail-tabs-panel">
        <div className="detail-tabs reference-tabs" role="tablist" aria-label="Reference data groups">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch('');
                setTerritoryFilter('');
                setServiceAreaFilter('');
                setVoltageFilter('');
                clearPanels();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel registry-panel">
        <div className="panel-heading registry-heading">
          <div>
            <h2>{activeConfig.label}</h2>
            <span>{tabDescription(activeTab)}</span>
          </div>
          <span>{activeRows.length} records</span>
        </div>

        <div className="registry-toolbar reference-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeConfig.label.toLowerCase()}`} aria-label={`Search ${activeConfig.label}`} />
          </label>

          {activeTab === 'serviceAreas' ? (
            <label>
              <span>Territory</span>
              <select value={territoryFilter} onChange={(event) => setTerritoryFilter(event.target.value)}>
                <option value="">All territories</option>
                {dataByKey.territories.map((territory) => <option key={territory._id} value={territory._id}>{territory.name || territory.code || territory._id}</option>)}
              </select>
            </label>
          ) : null}

          {activeTab === 'feeders' ? (
            <label>
              <span>Service Area</span>
              <select value={serviceAreaFilter} onChange={(event) => setServiceAreaFilter(event.target.value)}>
                <option value="">All service areas</option>
                {dataByKey.serviceAreas.map((serviceArea) => <option key={serviceArea._id} value={serviceArea._id}>{serviceArea.name || serviceArea.code || serviceArea._id}</option>)}
              </select>
            </label>
          ) : null}

          {activeTab === 'districts' ? (
            <label>
              <span>Region</span>
              <select value={territoryFilter} onChange={(event) => setTerritoryFilter(event.target.value)}>
                <option value="">All regions</option>
                {regionOptions.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </label>
          ) : null}

          {activeTab === 'ratings' ? (
            <label>
              <span>Network Voltage</span>
              <select value={voltageFilter} onChange={(event) => setVoltageFilter(event.target.value)}>
                <option value="">All voltages</option>
                {voltageOptions.map((voltage) => <option key={voltage} value={String(voltage)}>{voltage} kV</option>)}
              </select>
            </label>
          ) : null}
        </div>

        {activeQuery.isLoading ? <Loading label={`Loading ${activeConfig.label.toLowerCase()}`} /> : null}
        {activeQuery.error ? <ErrorState error={activeQuery.error} title={`${activeConfig.label} unavailable`} /> : null}
        {!activeQuery.isLoading && !activeQuery.error ? (
          rows.length === 0 && activeRows.length > 0 ? (
            <EmptyState title="No matching records" message="Try a different search or filter." />
          ) : (
            <DataTable<ReferenceItem>
              columns={getColumns(activeTab)}
              rows={rows}
              emptyTitle={`No ${activeConfig.label.toLowerCase()}`}
              emptyMessage={activeConfig.writable ? `Create the first ${activeConfig.label.toLowerCase()} record when you are ready.` : 'No records were returned by the backend.'}
              renderRow={renderRow}
            />
          )
        ) : null}
      </section>

      {showForm ? (
        <ReferenceForm
          type={activeTab}
          editing={editing}
          territories={dataByKey.territories}
          serviceAreas={dataByKey.serviceAreas}
          saving={saveMutation.isPending}
          error={saveMutation.error}
          onCancel={clearPanels}
          onSubmit={(values) => saveMutation.mutate(values)}
        />
      ) : null}

      {confirmDelete ? (
        <section className="panel confirmation-panel danger-confirmation reference-delete-panel">
          <div>
            <h2>Delete {itemTitle(confirmDelete.item)}?</h2>
            <p>Deleting reference data can affect linked transformer records and future forms. If the backend rejects this delete because records are linked, the record will stay in place.</p>
          </div>
          {deleteMutation.error ? <div className="form-error">{getApiErrorMessage(deleteMutation.error)}</div> : <span className="muted">This action cannot be undone.</span>}
          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={() => setConfirmDelete(undefined)} disabled={deleteMutation.isPending}>Cancel</button>
            <button className="danger-button" type="button" onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
