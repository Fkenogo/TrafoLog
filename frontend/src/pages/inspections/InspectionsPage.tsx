import { useQuery } from '@tanstack/react-query';
import { inspectionApi } from '../../api/inspectionApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Inspection } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

export function InspectionsPage() {
  const query = useQuery({ queryKey: ['inspections', 'list'], queryFn: () => inspectionApi.list({ limit: 20 }) });
  if (query.isLoading) return <Loading label="Loading inspections" />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <section className="panel">
      <div className="panel-heading"><h2>Inspections</h2><span>{query.data?.pagination?.total ?? query.data?.data.length ?? 0} records</span></div>
      <DataTable<Inspection>
        columns={['Transformer', 'Condition', 'Inspection Date', 'Inspector']}
        rows={query.data?.data ?? []}
        emptyTitle="No inspections"
        emptyMessage="No inspection records were returned by the backend."
        renderRow={(item) => (
          <tr key={item._id}>
            <td>{getTransformerName(item.transformer_id)}</td>
            <td><span className="badge">{item.overall_condition || 'Not recorded'}</span></td>
            <td>{formatDate(item.inspection_date)}</td>
            <td>{typeof item.inspected_by === 'object' ? item.inspected_by.name : 'Not recorded'}</td>
          </tr>
        )}
      />
    </section>
  );
}
