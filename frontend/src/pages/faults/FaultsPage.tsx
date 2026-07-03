import { useQuery } from '@tanstack/react-query';
import { faultApi } from '../../api/faultApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Fault } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

export function FaultsPage() {
  const query = useQuery({ queryKey: ['faults', 'list'], queryFn: () => faultApi.list({ limit: 20 }) });
  if (query.isLoading) return <Loading label="Loading faults" />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <section className="panel">
      <div className="panel-heading"><h2>Fault Management</h2><span>{query.data?.pagination?.total ?? query.data?.data.length ?? 0} records</span></div>
      <DataTable<Fault>
        columns={['Transformer', 'Type', 'Severity', 'Status', 'Date']}
        rows={query.data?.data ?? []}
        emptyTitle="No faults"
        emptyMessage="No fault records were returned by the backend."
        renderRow={(item) => (
          <tr key={item._id}>
            <td>{getTransformerName(item.transformer_id)}</td>
            <td>{item.fault_type || 'Not recorded'}</td>
            <td><span className="badge danger">{item.severity || 'Unknown'}</span></td>
            <td>{item.fault_status || 'Unknown'}</td>
            <td>{formatDate(item.fault_date || item.created_at)}</td>
          </tr>
        )}
      />
    </section>
  );
}
