import { useQuery } from '@tanstack/react-query';
import { maintenanceApi } from '../../api/maintenanceApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { MaintenanceRecord } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

export function MaintenancePage() {
  const query = useQuery({ queryKey: ['maintenance', 'list'], queryFn: () => maintenanceApi.list({ limit: 20 }) });
  if (query.isLoading) return <Loading label="Loading maintenance" />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <section className="panel">
      <div className="panel-heading"><h2>Maintenance</h2><span>{query.data?.pagination?.total ?? query.data?.data.length ?? 0} records</span></div>
      <DataTable<MaintenanceRecord>
        columns={['Transformer', 'Type', 'Technician', 'Date', 'Next']}
        rows={query.data?.data ?? []}
        emptyTitle="No maintenance"
        emptyMessage="No maintenance records were returned by the backend."
        renderRow={(item) => (
          <tr key={item._id}>
            <td>{getTransformerName(item.transformer_id)}</td>
            <td>{item.maintenance_type || 'Not recorded'}</td>
            <td>{item.technician_name || 'Not assigned'}</td>
            <td>{formatDate(item.maintenance_date)}</td>
            <td>{formatDate(item.next_maintenance_date)}</td>
          </tr>
        )}
      />
    </section>
  );
}
