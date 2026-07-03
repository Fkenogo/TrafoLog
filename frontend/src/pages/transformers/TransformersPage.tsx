import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { transformerApi } from '../../api/transformerApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { Transformer } from '../../types/api';
import { getTransformerName } from '../../utils/format';

export function TransformersPage() {
  const query = useQuery({ queryKey: ['transformers', 'list'], queryFn: () => transformerApi.list({ limit: 20 }) });

  if (query.isLoading) return <Loading label="Loading transformers" />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Transformer Registry</h2>
        <span>{query.data?.pagination?.total ?? query.data?.data.length ?? 0} records</span>
      </div>
      <DataTable<Transformer>
        columns={['Asset', 'Manufacturer', 'Rating', 'Status', '']}
        rows={query.data?.data ?? []}
        emptyTitle="No transformers"
        emptyMessage="No transformer records were returned by the backend."
        renderRow={(item) => (
          <tr key={item._id}>
            <td>{getTransformerName(item)}</td>
            <td>{item.manufacturer || 'Not recorded'}</td>
            <td>{item.kva_rating || '-'} kVA / {item.network_voltage_kv || '-'} kV</td>
            <td><span className="badge">{item.operational_status || 'Unknown'}</span></td>
            <td><Link to={`/transformers/${item._id}`}>View</Link></td>
          </tr>
        )}
      />
    </section>
  );
}
