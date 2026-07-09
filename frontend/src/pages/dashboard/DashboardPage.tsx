import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircuitBoard,
  ClipboardCheck,
  LucideIcon,
  MapPinned,
  Wrench
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { faultApi } from '../../api/faultApi';
import { inspectionApi } from '../../api/inspectionApi';
import { maintenanceApi } from '../../api/maintenanceApi';
import { transformerApi } from '../../api/transformerApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { Fault, MaintenanceRecord, Transformer } from '../../types/api';
import { asCount, formatDate, getTransformerName } from '../../utils/format';

type MetricTone = 'steel' | 'risk' | 'amber' | 'green';

const quickActions = [
  { label: 'Transformer registry', to: '/transformers', icon: CircuitBoard },
  { label: 'Inspection queue', to: '/inspections', icon: ClipboardCheck },
  { label: 'Fault board', to: '/faults', icon: AlertTriangle },
  { label: 'Report fault', to: '/faults/new', icon: AlertTriangle },
  { label: 'Maintenance calendar', to: '/maintenance', icon: Wrench }
];

function getTransformerMeta(item: Transformer) {
  const rating = item.kva_rating ? `${item.kva_rating} kVA` : 'Rating not recorded';
  const voltage = item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Voltage not recorded';
  return `${item.manufacturer || 'Manufacturer not recorded'} · ${rating} · ${voltage}`;
}

function getFaultTransformerName(item: Fault) {
  return typeof item.transformer_id === 'object' ? getTransformerName(item.transformer_id) : 'Transformer not linked';
}

function getMaintenanceTransformerName(item: MaintenanceRecord) {
  return typeof item.transformer_id === 'object' ? getTransformerName(item.transformer_id) : 'Transformer not linked';
}

function toFriendlyStatusLabel(status: string) {
  return status
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatusCounts(stats: Awaited<ReturnType<typeof transformerApi.stats>> | undefined) {
  const direct = stats?.by_status;
  const alternate = stats?.['status_distribution'] || stats?.['statusDistribution'] || stats?.['statuses'];
  const source = direct && Object.keys(direct).length > 0
    ? direct
    : alternate && typeof alternate === 'object' && !Array.isArray(alternate)
      ? alternate as Record<string, unknown>
      : {};

  const semanticCounts = {
    Active: stats?.active,
    Faulty: stats?.faulty,
    'Under Maintenance': stats?.underMaintenance,
    Decommissioned: stats?.decommissioned,
    Unverified: stats?.unverified
  };

  return Object.entries({ ...semanticCounts, ...source })
    .map(([status, count]) => [toFriendlyStatusLabel(status), asCount(count)] as const)
    .filter(([, count]) => count > 0)
    .sort(([, left], [, right]) => right - left);
}

function WidgetShell({
  title,
  action,
  query,
  children
}: {
  title: string;
  action?: { label: string; to: string };
  query?: Pick<UseQueryResult<unknown>, 'isLoading' | 'error'>;
  children: JSX.Element;
}) {
  return (
    <section className="panel dashboard-widget">
      <div className="panel-heading">
        <h2>{title}</h2>
        {action && (
          <Link className="panel-link" to={action.to}>
            {action.label}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
      {query?.isLoading ? <Loading label={`Loading ${title.toLowerCase()}`} /> : query?.error ? <ErrorState error={query.error} title={`${title} unavailable`} /> : children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
  to,
  isLoading,
  error
}: {
  label: string;
  value: number;
  detail: string;
  tone: MetricTone;
  icon: LucideIcon;
  to: string;
  isLoading?: boolean;
  error?: unknown;
}) {
  return (
    <Link className={`metric-card ${tone}`} to={to} aria-label={`${label}: ${value.toLocaleString()}`}>
      <div>
        <span>{label}</span>
        {isLoading ? <strong className="metric-loading">...</strong> : error ? <strong className="metric-error">!</strong> : <strong>{value.toLocaleString()}</strong>}
        <small>{error ? 'Unable to load this value' : detail}</small>
      </div>
      <Icon size={22} />
    </Link>
  );
}

function TransformersByStatus({ query }: { query: UseQueryResult<Awaited<ReturnType<typeof transformerApi.stats>>, Error> }) {
  const statuses = normalizeStatusCounts(query.data);
  const total = asCount(query.data?.total);

  return (
    <WidgetShell title="Transformers by Status" action={{ label: 'View all', to: '/transformers' }} query={query}>
      {statuses.length === 0 ? (
        <EmptyState title="No transformer status data" message="Transformer status counts are not available yet." />
      ) : (
        <div className="status-breakdown">
          {statuses.map(([status, safeCount]) => {
            const width = total > 0 ? Math.max((safeCount / total) * 100, 4) : 4;
            return (
              <Link className="status-row" to="/transformers" key={status}>
                <div>
                  <strong>{status}</strong>
                  <span>{safeCount.toLocaleString()} transformers</span>
                </div>
                <div className="status-meter" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

function RecentTransformers({ query }: { query: UseQueryResult<Awaited<ReturnType<typeof transformerApi.list>>, Error> }) {
  const rows = query.data?.data ?? [];

  return (
    <WidgetShell title="Recent Transformers" action={{ label: 'Registry', to: '/transformers' }} query={query}>
      {rows.length === 0 ? (
        <EmptyState title="No transformers found" message="Registered transformers will appear here after they are added." />
      ) : (
        <div className="activity-list">
          {rows.map((item) => (
            <Link className="activity-row clickable-row" to={`/transformers/${item._id}`} key={item._id}>
              <strong>{getTransformerName(item)}</strong>
              <span>{getTransformerMeta(item)}</span>
              <small>{formatDate(item.created_at)}</small>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function OpenFaults({ query }: { query: UseQueryResult<Fault[], Error> }) {
  const rows = query.data ?? [];

  return (
    <WidgetShell title="Recent / Open Faults" action={{ label: 'Faults', to: '/faults' }} query={query}>
      {rows.length === 0 ? (
        <EmptyState title="No open faults" message="Active grid faults will appear here when reported." />
      ) : (
        <div className="activity-list">
          {rows.slice(0, 5).map((item) => (
            <Link className="activity-row clickable-row" to={`/faults/${item._id}`} key={item._id}>
              <div className="row-title-line">
                <strong>{item.fault_type || 'Fault'}</strong>
                <span className={item.severity === 'Critical' ? 'badge danger' : 'badge'}>{item.severity || 'Unrated'}</span>
              </div>
              <span>{getFaultTransformerName(item)} · {item.fault_status || 'Open'}</span>
              <small>{formatDate(item.fault_date || item.created_at)}</small>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function UpcomingMaintenance({ query }: { query: UseQueryResult<MaintenanceRecord[], Error> }) {
  const rows = query.data ?? [];

  return (
    <WidgetShell title="Upcoming Maintenance" action={{ label: 'Maintenance', to: '/maintenance' }} query={query}>
      {rows.length === 0 ? (
        <EmptyState title="No upcoming maintenance" message="Scheduled maintenance due in the next window will appear here." />
      ) : (
        <div className="activity-list">
          {rows.slice(0, 5).map((item) => (
            <Link className="activity-row clickable-row" to="/maintenance" key={item._id}>
              <div className="row-title-line">
                <strong>{item.maintenance_type || 'Maintenance'}</strong>
                <span className="badge">{item.status || 'Scheduled'}</span>
              </div>
              <span>{getMaintenanceTransformerName(item)}</span>
              <small>{formatDate(item.next_maintenance_date || item.maintenance_date)}</small>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function OverdueInspections({ query }: { query: UseQueryResult<Transformer[], Error> }) {
  const rows = query.data ?? [];

  return (
    <WidgetShell title="Overdue Inspections" action={{ label: 'Inspections', to: '/inspections' }} query={query}>
      {rows.length === 0 ? (
        <EmptyState title="No overdue inspections" message="Transformers due for inspection will appear here." />
      ) : (
        <div className="activity-list">
          {rows.slice(0, 5).map((item) => (
            <Link className="activity-row clickable-row" to={`/transformers/${item._id}`} key={item._id}>
              <strong>{getTransformerName(item)}</strong>
              <span>{item.operational_status || 'Status not recorded'} · {item.location_operational?.feeder_name || 'Feeder not recorded'}</span>
              <small>{formatDate(item.updated_at || item.created_at)}</small>
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function QuickActions() {
  return (
    <section className="panel dashboard-widget">
      <div className="panel-heading">
        <h2>Quick Navigation</h2>
      </div>
      <div className="quick-action-grid">
        {quickActions.map((item) => (
          <Link className="quick-action" to={item.to} key={item.to}>
            <item.icon size={18} />
            <span>{item.label}</span>
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function MobileWidgetGroup({
  title,
  children,
  defaultOpen = false
}: {
  title: string;
  children: JSX.Element;
  defaultOpen?: boolean;
}) {
  return (
    <details className="mobile-dashboard-group" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="mobile-dashboard-group-body">{children}</div>
    </details>
  );
}

export function DashboardPage() {
  const transformerStats = useQuery({ queryKey: ['transformers', 'stats'], queryFn: transformerApi.stats });
  const recentTransformers = useQuery({ queryKey: ['transformers', 'recent'], queryFn: () => transformerApi.list({ limit: 5 }) });
  const openFaults = useQuery({ queryKey: ['faults', 'open'], queryFn: faultApi.open });
  const overdueInspections = useQuery({ queryKey: ['inspections', 'overdue'], queryFn: inspectionApi.overdue });
  const upcomingMaintenance = useQuery({ queryKey: ['maintenance', 'upcoming'], queryFn: maintenanceApi.upcoming });

  return (
    <div className="page-stack">
      <section className="status-strip">
        <div>
          <Activity size={18} />
          <span>Live operations dashboard</span>
        </div>
        <small>Widgets use documented MVP endpoints only.</small>
      </section>

      <section className="metrics-grid" aria-label="Operational summary">
        <MetricCard
          label="Total Transformers"
          value={asCount(transformerStats.data?.total)}
          detail="Registered assets"
          tone="steel"
          icon={CircuitBoard}
          to="/transformers"
          isLoading={transformerStats.isLoading}
          error={transformerStats.error}
        />
        <MetricCard
          label="Active / Open Faults"
          value={(openFaults.data ?? []).length}
          detail="Require operational attention"
          tone="risk"
          icon={AlertTriangle}
          to="/faults"
          isLoading={openFaults.isLoading}
          error={openFaults.error}
        />
        <MetricCard
          label="Overdue Inspections"
          value={(overdueInspections.data ?? []).length}
          detail="Transformers needing review"
          tone="amber"
          icon={ClipboardCheck}
          to="/inspections"
          isLoading={overdueInspections.isLoading}
          error={overdueInspections.error}
        />
        <MetricCard
          label="Upcoming Maintenance"
          value={(upcomingMaintenance.data ?? []).length}
          detail="Scheduled in the next window"
          tone="green"
          icon={CalendarClock}
          to="/maintenance"
          isLoading={upcomingMaintenance.isLoading}
          error={upcomingMaintenance.error}
        />
      </section>

      <section className="dashboard-grid wide">
        <TransformersByStatus query={transformerStats} />
        <QuickActions />
      </section>

      <section className="dashboard-grid dashboard-operational-grid">
        <RecentTransformers query={recentTransformers} />
        <OpenFaults query={openFaults} />
        <UpcomingMaintenance query={upcomingMaintenance} />
      </section>

      <section className="dashboard-grid single dashboard-followup-grid">
        <OverdueInspections query={overdueInspections} />
        <section className="panel dashboard-widget">
          <div className="panel-heading">
            <h2>Operational Scope</h2>
          </div>
          <div className="scope-summary">
            <MapPinned size={20} />
            <div>
              <strong>Live MVP modules</strong>
              <span>Transformer registry, inspections, faults, and maintenance are available from the current backend contract.</span>
            </div>
          </div>
        </section>
      </section>

      <section className="mobile-dashboard-sections" aria-label="Additional dashboard sections">
        <MobileWidgetGroup title="Recent assets">
          <RecentTransformers query={recentTransformers} />
        </MobileWidgetGroup>
        <MobileWidgetGroup title="Open faults" defaultOpen>
          <OpenFaults query={openFaults} />
        </MobileWidgetGroup>
        <MobileWidgetGroup title="Maintenance">
          <UpcomingMaintenance query={upcomingMaintenance} />
        </MobileWidgetGroup>
        <MobileWidgetGroup title="Inspection follow-up">
          <OverdueInspections query={overdueInspections} />
        </MobileWidgetGroup>
      </section>
    </div>
  );
}
