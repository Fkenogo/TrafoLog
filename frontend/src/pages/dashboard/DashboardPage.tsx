import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CalendarClock, CircuitBoard, ClipboardCheck } from 'lucide-react';
import { faultApi } from '../../api/faultApi';
import { inspectionApi } from '../../api/inspectionApi';
import { maintenanceApi } from '../../api/maintenanceApi';
import { transformerApi } from '../../api/transformerApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { Fault, MaintenanceRecord, Transformer } from '../../types/api';
import { asCount, formatDate, getTransformerName } from '../../utils/format';

function MetricCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof CircuitBoard }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
      </div>
      <Icon size={22} />
    </article>
  );
}

function RecentPanel<T>({ title, rows, render }: { title: string; rows: T[]; render: (row: T) => JSX.Element }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? <EmptyState title="No records" message="The backend returned an empty dataset." /> : <div className="activity-list">{rows.map(render)}</div>}
    </section>
  );
}

export function DashboardPage() {
  const transformers = useQuery({ queryKey: ['transformers', 'recent'], queryFn: () => transformerApi.list({ limit: 5 }) });
  const transformerStats = useQuery({ queryKey: ['transformers', 'stats'], queryFn: transformerApi.stats });
  const openFaults = useQuery({ queryKey: ['faults', 'open'], queryFn: faultApi.open });
  const overdueInspections = useQuery({ queryKey: ['inspections', 'overdue'], queryFn: inspectionApi.overdue });
  const upcomingMaintenance = useQuery({ queryKey: ['maintenance', 'upcoming'], queryFn: maintenanceApi.upcoming });

  const isLoading = transformers.isLoading || transformerStats.isLoading || openFaults.isLoading || overdueInspections.isLoading || upcomingMaintenance.isLoading;
  const error = transformers.error || transformerStats.error || openFaults.error || overdueInspections.error || upcomingMaintenance.error;

  if (isLoading) return <Loading label="Loading dashboard" />;
  if (error) return <ErrorState error={error} title="Dashboard data unavailable" />;

  const recentTransformers = transformers.data?.data ?? [];
  const faults = openFaults.data ?? [];
  const overdue = overdueInspections.data ?? [];
  const maintenance = upcomingMaintenance.data ?? [];

  return (
    <div className="page-stack">
      <section className="status-strip">
        <div>
          <Activity size={18} />
          <span>Live backend connection</span>
        </div>
        <small>Data shown only from documented MVP endpoints.</small>
      </section>

      <section className="metrics-grid" aria-label="Operational summary">
        <MetricCard label="Total Transformers" value={asCount(transformerStats.data?.total)} tone="steel" icon={CircuitBoard} />
        <MetricCard label="Active Faults" value={faults.length} tone="risk" icon={AlertTriangle} />
        <MetricCard label="Open Inspections" value={overdue.length} tone="amber" icon={ClipboardCheck} />
        <MetricCard label="Scheduled Maintenance" value={maintenance.length} tone="green" icon={CalendarClock} />
      </section>

      <section className="dashboard-grid">
        <RecentPanel<Transformer>
          title="Recently Added Transformers"
          rows={recentTransformers}
          render={(item) => (
            <article className="activity-row" key={item._id}>
              <strong>{getTransformerName(item)}</strong>
              <span>{item.manufacturer || 'Manufacturer not recorded'} · {item.kva_rating || '-'} kVA</span>
              <small>{formatDate(item.created_at)}</small>
            </article>
          )}
        />
        <RecentPanel<Fault>
          title="Recent Faults"
          rows={faults.slice(0, 5)}
          render={(item) => (
            <article className="activity-row" key={item._id}>
              <strong>{item.fault_type || 'Fault'}</strong>
              <span>{item.severity || 'Unrated'} · {item.fault_status || 'Open'}</span>
              <small>{formatDate(item.fault_date || item.created_at)}</small>
            </article>
          )}
        />
        <RecentPanel<MaintenanceRecord>
          title="Upcoming Maintenance"
          rows={maintenance.slice(0, 5)}
          render={(item) => (
            <article className="activity-row" key={item._id}>
              <strong>{item.maintenance_type || 'Maintenance'}</strong>
              <span>{getTransformerName(item.transformer_id)}</span>
              <small>{formatDate(item.next_maintenance_date || item.maintenance_date)}</small>
            </article>
          )}
        />
      </section>
    </div>
  );
}
