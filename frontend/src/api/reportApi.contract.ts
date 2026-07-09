import { reportApi, ReportFilters, ReportKind, ReportResult } from './reportApi';

const acceptsKind = (_kind: ReportKind) => undefined;
const acceptsFilters = (_filters: ReportFilters) => undefined;
const acceptsResult = <Row>(_result: ReportResult<Row>) => undefined;

acceptsKind('transformers');
acceptsKind('inspections');
acceptsKind('faults');
acceptsKind('maintenance');
acceptsKind('asset-register');

acceptsFilters({
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  territory_id: 'territory-id',
  service_area_id: 'service-area-id',
  feeder_id: 'feeder-id',
  district_id: 'district-id',
  network_voltage_kv: 11,
  kva_rating: 100,
  operational_status: 'Active',
  transformer_id: 'transformer-id',
  condition: 'Good',
  fault_status: 'Open',
  severity: 'Minor',
  fault_type: 'Overload',
  maintenance_type: 'Preventive'
});

void reportApi.generate('transformers', {}).then((result) => acceptsResult(result));
