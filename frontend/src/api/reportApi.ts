import { apiClient } from './http';

export type ReportKind = 'transformers' | 'inspections' | 'faults' | 'maintenance' | 'asset-register';

export type ReportFilters = {
  startDate?: string;
  endDate?: string;
  territory_id?: string;
  service_area_id?: string;
  feeder_id?: string;
  district_id?: string;
  network_voltage_kv?: 11 | 33;
  kva_rating?: number;
  operational_status?: string;
  transformer_id?: string;
  condition?: string;
  fault_status?: string;
  severity?: string;
  fault_type?: string;
  maintenance_type?: string;
};

export type ReportSummary = {
  title?: string;
  total?: number;
  [key: string]: unknown;
};

export type ReportResult<Row = Record<string, unknown>> = {
  rows: Row[];
  summary: ReportSummary;
  filters: Record<string, unknown>;
  generatedAt: string;
};

type ReportEnvelope<Row> = {
  success: boolean;
  data: Row[];
  summary?: ReportSummary;
  filters?: Record<string, unknown>;
  generated_at?: string;
};

type ReportApiResponse<Row> = {
  success: boolean;
  message?: string;
  data: ReportEnvelope<Row>;
};

const reportPaths: Record<ReportKind, string> = {
  transformers: '/reports/transformers',
  inspections: '/reports/inspections',
  faults: '/reports/faults',
  maintenance: '/reports/maintenance',
  'asset-register': '/reports/asset-register'
};

const normalizeFilters = (filters: ReportFilters) => {
  const params: Record<string, unknown> = { format: 'json' };
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value;
    }
  });
  return params;
};

const normalizeReport = <Row>(payload: ReportEnvelope<Row>): ReportResult<Row> => ({
  rows: Array.isArray(payload.data) ? payload.data : [],
  summary: payload.summary ?? { total: Array.isArray(payload.data) ? payload.data.length : 0 },
  filters: payload.filters ?? {},
  generatedAt: payload.generated_at ?? new Date().toISOString()
});

export const reportApi = {
  async generate<Row = Record<string, unknown>>(kind: ReportKind, filters: ReportFilters = {}) {
    const response = await apiClient.get<ReportApiResponse<Row>>(reportPaths[kind], {
      params: normalizeFilters(filters)
    });

    return normalizeReport(response.data.data);
  }
};
