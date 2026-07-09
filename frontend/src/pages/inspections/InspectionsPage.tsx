import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { inspectionApi } from '../../api/inspectionApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Inspection, Transformer, User } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

type SortKey = 'inspection_date' | 'transformer' | 'condition' | 'visit_type' | 'recommended_action' | 'status';
type SortDirection = 'asc' | 'desc';

const pageSize = 20;

function asTransformer(value?: string | Transformer) {
  return typeof value === 'object' ? value : undefined;
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

function transformerSite(item: Inspection) {
  const transformer = asTransformer(item.transformer_id);
  return transformer?.location_administrative?.site_name || transformer?.site_name || 'Not recorded';
}

function transformerTerritory(item: Inspection) {
  const transformer = asTransformer(item.transformer_id);
  const territory = transformer?.location_operational?.territory_id;
  if (!territory) return 'Not recorded';
  return typeof territory === 'string' ? territory : territory.name || territory.code || 'Not recorded';
}

function conditionValue(item: Inspection) {
  return item.physical?.overall_condition || item.overall_condition || 'Not recorded';
}

function conditionBadgeClass(condition?: string) {
  const value = condition?.toLowerCase();
  if (value === 'good') return 'condition-badge condition-good';
  if (value === 'fair') return 'condition-badge condition-fair';
  if (value === 'poor') return 'condition-badge condition-poor';
  if (value === 'critical') return 'condition-badge condition-critical';
  return 'badge';
}

function sortValue(item: Inspection, key: SortKey) {
  if (key === 'inspection_date') return item.inspection_date || '';
  if (key === 'transformer') return getTransformerName(item.transformer_id);
  if (key === 'condition') return conditionValue(item);
  if (key === 'visit_type') return item.visit_type || '';
  if (key === 'recommended_action') return item.recommended_action || '';
  return item.sync_status || 'Saved';
}

function matchesSearch(item: Inspection, search: string) {
  if (!search.trim()) return true;
  const transformer = asTransformer(item.transformer_id);
  const haystack = [
    item._id,
    formatDate(item.inspection_date),
    getTransformerName(item.transformer_id),
    transformer?.asset_id,
    transformerSite(item),
    transformerTerritory(item),
    conditionValue(item),
    item.visit_type,
    userName(item.inspector_id || item.inspected_by),
    item.recommended_action,
    item.sync_status
  ].join(' ').toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

export function InspectionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('inspection_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const query = useQuery({
    queryKey: ['inspections', 'list', page, pageSize],
    queryFn: () => inspectionApi.list({ page, limit: pageSize })
  });

  const rows = useMemo(() => {
    const filtered = (query.data?.data ?? []).filter((item) => matchesSearch(item, search));
    return filtered.sort((left, right) => {
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [query.data?.data, search, sortDirection, sortKey]);

  const pagination = query.data?.pagination;
  const totalRecords = pagination?.total ?? query.data?.data.length ?? 0;
  const totalPages = pagination?.pages ?? Math.max(1, Math.ceil(totalRecords / pageSize));
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'inspection_date' ? 'desc' : 'asc');
  };

  if (query.isLoading) return <Loading label="Loading inspections" />;

  return (
    <div className="page-stack registry-page">
      <section className="section-header">
        <div>
          <span className="eyebrow">Field workflow</span>
          <h1>Inspection Queue</h1>
          <p>Review transformer inspection activity, open operational records, and start new field visits.</p>
        </div>
        <Link className="primary-button" to="/inspections/new">
          <Plus size={16} />
          <span>New Inspection</span>
        </Link>
      </section>

      <section className="panel">
        <div className="registry-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search inspections"
              aria-label="Search inspections"
            />
          </label>
          <div className="toolbar-actions">
            <button className="secondary-button" type="button" onClick={() => setSort('inspection_date')}>
              <ArrowDownUp size={16} />
              <span>Date {sortKey === 'inspection_date' ? sortDirection : ''}</span>
            </button>
            <span className="badge">{totalRecords} records</span>
          </div>
        </div>

        {query.error ? (
          <ErrorState error={query.error} title="Inspections unavailable" />
        ) : rows.length === 0 && search ? (
          <EmptyState title="No matching inspections" message="Try a different asset, site, condition, or inspector search." />
        ) : (
          <DataTable<Inspection>
            columns={['Inspection Date', 'Transformer', 'Asset ID', 'Site', 'Territory', 'Condition', 'Visit Type', 'Inspector', 'Recommended Action', 'Status', 'Actions']}
            rows={rows}
            emptyTitle="No inspections"
            emptyMessage="Inspection records will appear here after field visits are saved."
            renderRow={(item) => {
              const transformer = asTransformer(item.transformer_id);
              return (
                <tr key={item._id}>
                  <td>{formatDate(item.inspection_date)}</td>
                  <td>{getTransformerName(item.transformer_id)}</td>
                  <td>{transformer?.asset_id || 'Not recorded'}</td>
                  <td>{transformerSite(item)}</td>
                  <td>{transformerTerritory(item)}</td>
                  <td><span className={conditionBadgeClass(conditionValue(item))}>{conditionValue(item)}</span></td>
                  <td>{readable(item.visit_type)}</td>
                  <td>{userName(item.inspector_id || item.inspected_by)}</td>
                  <td>{readable(item.recommended_action)}</td>
                  <td><span className="badge">{readable(item.sync_status || 'Saved')}</span></td>
                  <td>
                    <div className="table-actions">
                      <Link className="icon-button" to={`/inspections/${item._id}`} aria-label="View inspection">
                        <Eye size={16} />
                      </Link>
                      <Link className="icon-button" to={`/inspections/${item._id}/edit`} aria-label="Edit inspection">
                        <Pencil size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        )}

        <div className="pagination-row">
          <button className="secondary-button" type="button" disabled={isFirstPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="secondary-button" type="button" disabled={isLastPage} onClick={() => setPage((current) => current + 1)}>
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
