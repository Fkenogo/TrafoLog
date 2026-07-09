import { apiClient } from './http';
import { ApiResponse, NestedPaginatedData, PaginatedResponse, TimelineEvent, Transformer, TransformerQrCode, TransformerStats } from '../types/api';

export interface TransformerSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  territory_id?: string;
  service_area_id?: string;
  network_voltage_kv?: number;
  kva_rating?: number;
  operational_status?: string;
  record_status?: string;
  district_id?: string;
  condition?: string;
}

export interface NearbyTransformerParams {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}

type NestedTransformerListResponse = ApiResponse<NestedPaginatedData<Transformer>>;
type NestedTimelineResponse = ApiResponse<NestedPaginatedData<TimelineEvent>>;

export interface TransformerMutationPayload {
  manufacturer: string;
  serial_number?: string;
  year_manufactured?: number;
  uedcl_reference?: string;
  kva_rating: number;
  network_voltage_kv: number;
  voltage_secondary?: string;
  phase_type?: string;
  cooling_type?: string;
  mounting_type?: string;
  vector_group?: string;
  territory_id: string;
  service_area_id?: string;
  feeder_id?: string;
  feeder_name?: string;
  feeder_code?: string;
  substation_name?: string;
  district_id: string;
  sub_county?: string;
  parish?: string;
  village?: string;
  site_name: string;
  latitude: number;
  longitude: number;
  gps_method?: string;
  gps_accuracy?: number;
  install_date?: string;
  installing_contractor?: string;
  commissioned_by?: string;
  commissioning_date?: string;
  warranty_expiry?: string;
}

export interface DecommissionPayload {
  reason: 'End of Life' | 'Damaged' | 'Theft' | 'Vandalism' | 'Replaced' | 'Other';
  notes?: string;
}

const isPaginatedTransformerResponse = (
  response: NestedTransformerListResponse | PaginatedResponse<Transformer>
): response is PaginatedResponse<Transformer> => Array.isArray(response.data);

const normalizeTransformerList = (response: NestedTransformerListResponse | PaginatedResponse<Transformer>): PaginatedResponse<Transformer> => {
  if (isPaginatedTransformerResponse(response)) return response;
  return {
    success: response.success,
    message: response.message,
    timestamp: response.timestamp,
    data: response.data.data,
    pagination: response.data.pagination
  };
};

const normalizeTimeline = (response: NestedTimelineResponse | PaginatedResponse<TimelineEvent>): PaginatedResponse<TimelineEvent> => {
  if (Array.isArray(response.data)) return response as PaginatedResponse<TimelineEvent>;
  return {
    success: response.success,
    message: response.message,
    timestamp: response.timestamp,
    data: response.data.data,
    pagination: response.data.pagination
  };
};

export const transformerApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<NestedTransformerListResponse | PaginatedResponse<Transformer>>('/transformers', { params });
    return normalizeTransformerList(response.data);
  },
  async search(params: TransformerSearchParams = { limit: 20 }) {
    const response = await apiClient.get<NestedTransformerListResponse | PaginatedResponse<Transformer>>('/transformers/search', { params });
    return normalizeTransformerList(response.data);
  },
  async getById(id: string) {
    try {
      const response = await apiClient.get<{ data: Transformer }>(`/transformers/${id}`);
      return response.data.data;
    } catch (error) {
      const fallback = await this.list({ limit: 500 });
      const transformer = fallback.data.find((item) => item._id === id);
      if (transformer) return transformer;
      throw error;
    }
  },
  async create(payload: TransformerMutationPayload) {
    const response = await apiClient.post<ApiResponse<Transformer>>('/transformers', payload);
    return response.data.data;
  },
  async update(id: string, payload: Partial<TransformerMutationPayload>) {
    const response = await apiClient.put<ApiResponse<Transformer>>(`/transformers/${id}`, payload);
    return response.data.data;
  },
  async delete(id: string) {
    const response = await apiClient.delete<ApiResponse<null>>(`/transformers/${id}`);
    return response.data;
  },
  async decommission(id: string, payload: DecommissionPayload) {
    const response = await apiClient.post<ApiResponse<Transformer>>(`/transformers/${id}/decommission`, payload);
    return response.data.data;
  },
  async stats() {
    const response = await apiClient.get<{ data: TransformerStats }>('/transformers/stats');
    return response.data.data;
  },
  async nearby(params: NearbyTransformerParams) {
    const response = await apiClient.get<ApiResponse<Transformer[]>>('/transformers/nearby', { params });
    return response.data.data;
  },
  async timeline(id: string, params: { page?: number; limit?: number } = { limit: 50 }) {
    const response = await apiClient.get<NestedTimelineResponse | PaginatedResponse<TimelineEvent>>(`/transformers/${id}/timeline`, { params });
    return normalizeTimeline(response.data);
  },
  async qr(id: string) {
    const response = await apiClient.get<ApiResponse<TransformerQrCode>>(`/transformers/${id}/qr`);
    return response.data.data;
  }
};
