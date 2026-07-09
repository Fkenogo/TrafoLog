import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, ChevronLeft, ChevronRight, Eye, Filter, Pencil, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { transformerApi, TransformerSearchParams } from '../../api/transformerApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Transformer } from '../../types/api';
import { asCount, formatDate, getTransformerName } from '../../utils/format';

const statusOptions = ['Active', 'Faulty', 'Under Maintenance', 'Decommissioned', 'Unverified'];
const conditionOptions = ['Good', 'Fair', 'Poor', 'Critical'];
const voltageOptions = [11, 33];
const ratingOptions = [50, 100, 160, 200, 250, 315, 500, 630, 1000];
const limitOptions = [10, 20, 50];

type SortKey = 'newest' | 'asset' | 'status' | 'rating';

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

function getRefName(value?: string | { name?: string; code?: string }) {
  if (!value || typeof value === 'string') return undefined;
  return value.name || value.code;
}

function getLocationLabel(item: Transformer) {
  const territory = item.location_operational?.territory_name || getRefName(item.location_operational?.territory_id);
  const serviceArea = item.location_operational?.service_area_name || getRefName(item.location_operational?.service_area_id);
  const feeder = item.location_operational?.feeder_name || item.location_operational?.feeder_code || getRefName(item.location_operational?.feeder_id);
  const parts = [territory, serviceArea, feeder].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Not recorded';
}

function getCondition(item: Transformer) {
  return (
    item.condition ||
    item.overall_condition ||
    item.latest_inspection?.physical?.overall_condition ||
    item.latest_inspection?.overall_condition ||
    undefined
  );
}

function getConditionBadgeClass(condition?: string) {
  if (condition === 'Critical' || condition === 'Poor') return 'badge danger';
  if (condition === 'Fair') return 'badge amber';
  if (condition === 'Good') return 'badge green';
  return 'badge muted-badge';
}

function getStatusBadgeClass(status?: string) {
  if (status === 'Faulty') return 'badge danger';
  if (status === 'Under Maintenance') return 'badge amber';
  if (status === 'Active') return 'badge green';
  return 'badge';
}

function getSiteLabel(item: Transformer) {
  return item.location_administrative?.site_name || item.site_name || getTransformerName(item);
}

function sortTransformers(rows: Transformer[], sort: SortKey) {
  return [...rows].sort((left, right) => {
    if (sort === 'asset') return getTransformerName(left).localeCompare(getTransformerName(right));
    if (sort === 'status') return notRecorded(left.operational_status).localeCompare(notRecorded(right.operational_status));
    if (sort === 'rating') return asCount(right.kva_rating) - asCount(left.kva_rating);
    return new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime();
  });
}

function buildSearchParams({
  page,
  limit,
  search,
  status,
  condition,
  voltage,
  rating
}: {
  page: number;
  limit: number;
  search: string;
  status: string;
  condition: string;
  voltage: string;
  rating: string;
}): TransformerSearchParams {
  return {
    page,
    limit,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { operational_status: status } : {}),
    ...(condition ? { condition } : {}),
    ...(voltage ? { network_voltage_kv: Number(voltage) } : {}),
    ...(rating ? { kva_rating: Number(rating) } : {})
  };
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'risk' | 'amber' | 'green' }) {
  return (
    <article className={`registry-summary-card ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

export function TransformersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [voltage, setVoltage] = useState('');
  const [rating, setRating] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, condition, voltage, rating, limit]);

  const listParams = useMemo(
    () => buildSearchParams({ page, limit, search: debouncedSearch, status, condition, voltage, rating }),
    [condition, debouncedSearch, limit, page, rating, status, voltage]
  );

  const transformers = useQuery({
    queryKey: ['transformers', 'registry', listParams],
    queryFn: () => transformerApi.search(listParams),
    placeholderData: (previous) => previous
  });

  const stats = useQuery({ queryKey: ['transformers', 'stats'], queryFn: transformerApi.stats });

  const rows = sortTransformers(transformers.data?.data ?? [], sort);
  const pagination = transformers.data?.pagination;
  const total = pagination?.total ?? rows.length;
  const totalPages = pagination?.pages ?? pagination?.totalPages ?? 1;
  const firstRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRecord = Math.min(page * limit, total);
  const filtersActive = Boolean(debouncedSearch || status || condition || voltage || rating);

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatus('');
    setCondition('');
    setVoltage('');
    setRating('');
    setPage(1);
  };

  const handleRowNavigation = (item: Transformer) => {
    navigate(`/transformers/${item._id}`);
  };

  return (
    <div className="page-stack registry-page">
      <section className="status-strip registry-strip">
        <div>
          <SlidersHorizontal size={18} />
          <span>Transformer Registry</span>
        </div>
        <small>{transformers.isFetching ? 'Refreshing live registry data' : `${total.toLocaleString()} matching records`}</small>
      </section>

      <section className="registry-summary-grid" aria-label="Transformer summary">
        <SummaryCard label="Total transformers" value={asCount(stats.data?.total)} />
        <SummaryCard label="Active / In service" value={asCount(stats.data?.active)} tone="green" />
        <SummaryCard label="Under maintenance" value={asCount(stats.data?.underMaintenance)} tone="amber" />
        <SummaryCard label="Decommissioned" value={asCount(stats.data?.decommissioned)} />
        <SummaryCard label="Faulty or critical" value={asCount(stats.data?.faulty)} tone="risk" />
      </section>
      {stats.error && <ErrorState error={stats.error} title="Summary unavailable" />}

      <section className="panel registry-panel">
        <div className="panel-heading registry-heading">
          <div>
            <h2>Registry list</h2>
            <span>{total === 0 ? 'No records found' : `Showing ${firstRecord.toLocaleString()}-${lastRecord.toLocaleString()} of ${total.toLocaleString()}`}</span>
          </div>
          <div className="registry-heading-actions">
            <Link className="primary-button" to="/transformers/new">
              <Plus size={16} />
              <span>New Transformer</span>
            </Link>
            {filtersActive && (
              <button className="secondary-button" type="button" onClick={clearFilters}>
                <X size={16} />
                <span>Clear filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="registry-toolbar">
          <label className="registry-search">
            <span>Search</span>
            <div className="input-shell">
              <Search size={17} />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Asset, serial, site, manufacturer"
                autoComplete="off"
              />
            </div>
          </label>

          <label>
            <span>Operational status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Condition</span>
            <select value={condition} onChange={(event) => setCondition(event.target.value)}>
              <option value="">All conditions</option>
              {conditionOptions.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Network voltage</span>
            <select value={voltage} onChange={(event) => setVoltage(event.target.value)}>
              <option value="">All voltages</option>
              {voltageOptions.map((item) => (
                <option value={item} key={item}>{item} kV</option>
              ))}
            </select>
          </label>

          <label>
            <span>kVA rating</span>
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="">All ratings</option>
              {ratingOptions.map((item) => (
                <option value={item} key={item}>{item} kVA</option>
              ))}
            </select>
          </label>

          <label>
            <span>Sort page</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="newest">Newest first</option>
              <option value="asset">Asset ID</option>
              <option value="status">Status</option>
              <option value="rating">Rating high-low</option>
            </select>
          </label>
        </div>

        <div className="active-filter-row" aria-live="polite">
          <Filter size={15} />
          <span>{filtersActive ? 'Filtered registry view' : 'All transformer records'}</span>
          {debouncedSearch && <strong>Search: {debouncedSearch}</strong>}
        </div>

        {transformers.isLoading ? (
          <Loading label="Loading transformer registry" />
        ) : transformers.error ? (
          <ErrorState error={transformers.error} title="Transformer registry unavailable" />
        ) : (
          <DataTable<Transformer>
            columns={['Asset ID', 'Site / Transformer name', 'Serial number', 'Territory / Service Area / Feeder', 'kVA Rating', 'Network Voltage', 'Operational Status', 'Condition', 'Last Inspection Date', 'Actions']}
            rows={rows}
            emptyTitle={filtersActive ? 'No transformers match these filters' : 'No transformers found'}
            emptyMessage={filtersActive ? 'Adjust search or filters to broaden the registry view.' : 'Registered transformers will appear here after they are added.'}
            renderRow={(item) => {
              const conditionValue = getCondition(item);
              return (
                <tr
                  className="clickable-table-row"
                  key={item._id}
                  tabIndex={0}
                  onClick={() => handleRowNavigation(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleRowNavigation(item);
                  }}
                >
                  <td><strong>{getTransformerName(item)}</strong></td>
                  <td>{getSiteLabel(item)}</td>
                  <td>{notRecorded(item.serial_number)}</td>
                  <td>{getLocationLabel(item)}</td>
                  <td>{item.kva_rating ? `${item.kva_rating.toLocaleString()} kVA` : 'Not recorded'}</td>
                  <td>{item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded'}</td>
                  <td><span className={getStatusBadgeClass(item.operational_status)}>{readableLabel(item.operational_status)}</span></td>
                  <td><span className={getConditionBadgeClass(conditionValue)}>{readableLabel(conditionValue)}</span></td>
                  <td>{formatDate(item.last_inspection_date || item.latest_inspection?.inspection_date)}</td>
                  <td>
                    <div className="table-action-group">
                      <Link
                        className="table-action"
                        to={`/transformers/${item._id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Eye size={15} />
                        <span>View</span>
                      </Link>
                      <Link
                        className="table-action"
                        to={`/transformers/${item._id}/edit`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Pencil size={15} />
                        <span>Edit</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            }}
          />
        )}

        <div className="pagination-bar">
          <div>
            <span>Rows per page</span>
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              {limitOptions.map((item) => (
                <option value={item} key={item}>{item}</option>
              ))}
            </select>
          </div>
          <span>Page {page.toLocaleString()} of {Math.max(totalPages, 1).toLocaleString()}</span>
          <div className="pagination-actions">
            <button className="icon-text-button" type="button" disabled={page <= 1 || transformers.isFetching} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <button className="icon-text-button" type="button" disabled={page >= totalPages || transformers.isFetching} onClick={() => setPage((current) => current + 1)}>
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {transformers.isFetching && !transformers.isLoading && (
          <div className="refresh-note">
            <ArrowDownUp size={15} />
            <span>Updating registry results</span>
          </div>
        )}
      </section>
    </div>
  );
}
