import { useQueries } from '@tanstack/react-query';
import { referenceDataApi } from '../../api/referenceDataApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';

const groups = [
  { key: 'territories', label: 'Territories', queryFn: referenceDataApi.territories },
  { key: 'serviceAreas', label: 'Service Areas', queryFn: referenceDataApi.serviceAreas },
  { key: 'feeders', label: 'Feeders', queryFn: referenceDataApi.feeders },
  { key: 'districts', label: 'Districts', queryFn: referenceDataApi.districts },
  { key: 'ratings', label: 'Transformer Ratings', queryFn: referenceDataApi.ratings }
];

export function ReferenceDataPage() {
  const queries = useQueries({
    queries: groups.map((group) => ({ queryKey: ['reference-data', group.key], queryFn: group.queryFn }))
  });

  if (queries.some((query) => query.isLoading)) return <Loading label="Loading reference data" />;
  const error = queries.find((query) => query.error)?.error;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="reference-grid">
      {groups.map((group, index) => {
        const rows = queries[index].data ?? [];
        return (
          <section className="panel" key={group.key}>
            <div className="panel-heading">
              <h2>{group.label}</h2>
              <span>{rows.length} records</span>
            </div>
            <div className="reference-list">
              {rows.length === 0 ? (
                <span className="muted">No records returned.</span>
              ) : (
                rows.slice(0, 8).map((row) => (
                  <div key={row._id} className="reference-row">
                    <strong>{row.name || row.code || row.kva || row._id}</strong>
                    <span>{row.code || row.region || row.network_voltage_kv || 'Reference item'}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
