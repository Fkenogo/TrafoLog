import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { transformerApi } from '../../api/transformerApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { getTransformerName } from '../../utils/format';

export function TransformerDetailPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['transformers', id],
    queryFn: () => transformerApi.getById(id ?? ''),
    enabled: Boolean(id)
  });

  if (query.isLoading) return <Loading label="Loading transformer" />;
  if (query.error) return <ErrorState error={query.error} title="Transformer unavailable" />;
  const item = query.data;

  return (
    <section className="panel detail-panel">
      <div className="panel-heading">
        <h2>{getTransformerName(item)}</h2>
        <span className="badge">{item?.operational_status || 'Unknown'}</span>
      </div>
      <dl className="detail-grid">
        <div><dt>Manufacturer</dt><dd>{item?.manufacturer || 'Not recorded'}</dd></div>
        <div><dt>Serial Number</dt><dd>{item?.serial_number || 'Not recorded'}</dd></div>
        <div><dt>Rating</dt><dd>{item?.kva_rating || '-'} kVA</dd></div>
        <div><dt>Network Voltage</dt><dd>{item?.network_voltage_kv || '-'} kV</dd></div>
      </dl>
    </section>
  );
}
