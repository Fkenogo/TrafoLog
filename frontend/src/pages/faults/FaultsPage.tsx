import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { faultApi } from '../../api/faultApi';
import { referenceDataApi } from '../../api/referenceDataApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Fault } from '../../types/api';
import { formatDate } from '../../utils/format';
import {
  asTransformer,
  displayFaultStatus,
  faultLabel,
  faultStatusBadgeClass,
  faultTransformerName,
  severityBadgeClass,
  severityOptions,
  statusOptions,
  transformerServiceArea,
  transformerSite,
  transformerTerritory,
  userName
} from './faultHelpers';

const pageSize = 20;
type SortKey = 'fault_date' | 'severity' | 'status' | 'updated_at';

function matchesSearch(item: Fault, search: string) {
  if (!search.trim()) return true;
  const transformer = asTransformer(item.transformer_id);
  const haystack = [
    faultLabel(item),
    faultTransformerName(item),
    transformer?.asset_id,
    transformerSite(item.transformer_id),
    transformerTerritory(item.transformer_id),
    item.fault_type,
    item.severity,
    item.fault_status,
    item.fault_description,
    userName(item.assigned_to)
  ].join(' ').toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

function matchesOperationalFilters(item: Fault, territoryId: string, serviceAreaId: string) {
  const transformer = asTransformer(item.transformer_id);
  const territory = transformer?.location_operational?.territory_id;
  const serviceArea = transformer?.location_operational?.service_area_id;
  const itemTerritoryId = typeof territory === 'string' ? territory : territory?._id;
  const itemServiceAreaId = typeof serviceArea === 'string' ? serviceArea : serviceArea?._id;
  return (!territoryId || itemTerritoryId === territoryId) && (!serviceAreaId || itemServiceAreaId === serviceAreaId);
}

function sortValue(item: Fault, sort: SortKey) {
  if (sort === 'severity') return item.severity || '';
  if (sort === 'status') return item.fault_status || '';
  if (sort === 'updated_at') return item.updated_at || '';
  return item.fault_date || item.created_at || '';
}

export function FaultsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [territoryId, setTerritoryId] = useState('');
  const [serviceAreaId, setServiceAreaId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fault_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit: pageSize };
    if (status) params.status = status;
    if (severity) params.severity = severity;
    if (assignedTo) params.assigned_to = assignedTo;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [assignedTo, endDate, page, severity, startDate, status]);

  const query = useQuery({ queryKey: ['faults', 'list', queryParams], queryFn: () => faultApi.list(queryParams) });
  const territories = useQuery({ queryKey: ['reference-data', 'territories'], queryFn: referenceDataApi.territories });
  const serviceAreas = useQuery({ queryKey: ['reference-data', 'service-areas'], queryFn: referenceDataApi.serviceAreas });

  const assignedOptions = useMemo(() => {
    const map = new Map<string, string>();
    (query.data?.data ?? []).forEach((item) => {
      if (item.assigned_to && typeof item.assigned_to === 'object') map.set(item.assigned_to._id, userName(item.assigned_to));
    });
    return Array.from(map.entries());
  }, [query.data?.data]);

  const rows = useMemo(() => {
    const filtered = (query.data?.data ?? [])
      .filter((item) => matchesSearch(item, search))
      .filter((item) => matchesOperationalFilters(item, territoryId, serviceAreaId));
    return filtered.sort((left, right) => {
      const comparison = sortValue(left, sortKey).localeCompare(sortValue(right, sortKey), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [query.data?.data, search, serviceAreaId, sortDirection, sortKey, territoryId]);

  const totalRecords = query.data?.pagination?.total ?? query.data?.data.length ?? 0;
  const totalPages = query.data?.pagination?.pages ?? Math.max(1, Math.ceil(totalRecords / pageSize));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['faults'] });
    void queryClient.invalidateQueries({ queryKey: ['transformers'] });
  };

  if (query.isLoading) return <Loading label="Loading faults" />;

  return (
    <div className="page-stack registry-page">
      <section className="section-header">
        <div>
          <span className="eyebrow">Incident response</span>
          <h1>Fault Queue</h1>
          <p>Track active incidents, assignments, severity, outage impact, and resolution progress.</p>
        </div>
        <div className="detail-action-row">
          <button className="secondary-button" type="button" onClick={refresh}><RefreshCw size={16} /><span>Refresh</span></button>
          <Link className="primary-button" to="/faults/new"><Plus size={16} /><span>Report Fault</span></Link>
        </div>
      </section>

      <section className="panel registry-panel">
        <div className="registry-toolbar fault-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search faults" aria-label="Search faults" />
          </label>
          <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label><span>Severity</span><select value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }}><option value="">All severities</option>{severityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label><span>Territory</span><select value={territoryId} onChange={(event) => setTerritoryId(event.target.value)}><option value="">{territories.isLoading ? 'Loading territories' : 'All territories'}</option>{(territories.data ?? []).map((item) => <option value={item._id} key={item._id}>{item.name || item.code || item._id}</option>)}</select></label>
          <label><span>Service Area</span><select value={serviceAreaId} onChange={(event) => setServiceAreaId(event.target.value)}><option value="">{serviceAreas.isLoading ? 'Loading service areas' : 'All service areas'}</option>{(serviceAreas.data ?? []).map((item) => <option value={item._id} key={item._id}>{item.name || item.code || item._id}</option>)}</select></label>
          <label><span>Assigned Engineer</span><select value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setPage(1); }}><option value="">All engineers</option>{assignedOptions.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
          <label><span>From</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
          <label><span>To</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
          <label><span>Sort</span><select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="fault_date">Date reported</option><option value="severity">Severity</option><option value="status">Status</option><option value="updated_at">Last updated</option></select></label>
          <label><span>Direction</span><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        </div>

        {query.error ? <ErrorState error={query.error} title="Fault queue unavailable" /> : rows.length === 0 && search ? (
          <EmptyState title="No matching faults" message="Try a different asset, site, status, severity, or engineer search." />
        ) : (
          <DataTable<Fault>
            columns={['Fault ID', 'Transformer', 'Asset ID', 'Site', 'Territory', 'Fault Type', 'Severity', 'Status', 'Date Reported', 'Assigned Engineer', 'Last Updated', 'View', 'Edit']}
            rows={rows}
            emptyTitle="No faults"
            emptyMessage="Reported transformer incidents will appear here."
            renderRow={(item) => {
              const transformer = asTransformer(item.transformer_id);
              return (
                <tr key={item._id}>
                  <td>{faultLabel(item)}</td>
                  <td>{faultTransformerName(item)}</td>
                  <td>{transformer?.asset_id || 'Not recorded'}</td>
                  <td>{transformerSite(item.transformer_id)}</td>
                  <td>{transformerTerritory(item.transformer_id)}</td>
                  <td>{item.fault_type || 'Not recorded'}</td>
                  <td><span className={severityBadgeClass(item.severity)}>{item.severity || 'Unrated'}</span></td>
                  <td><span className={faultStatusBadgeClass(item.fault_status)}>{displayFaultStatus(item.fault_status)}</span></td>
                  <td>{formatDate(item.fault_date || item.created_at)}</td>
                  <td>{userName(item.assigned_to)}</td>
                  <td>{formatDate(item.updated_at || item.created_at)}</td>
                  <td><Link className="icon-button" to={`/faults/${item._id}`} aria-label={`View ${faultLabel(item)}`}><Eye size={16} /></Link></td>
                  <td><Link className="icon-button" to={`/faults/${item._id}/edit`} aria-label={`Edit ${faultLabel(item)}`}><Pencil size={16} /></Link></td>
                </tr>
              );
            }}
          />
        )}

        <div className="pagination-row">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /><span>Previous</span></button>
          <span>Page {page} of {totalPages}</span>
          <button className="secondary-button" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><span>Next</span><ChevronRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}
