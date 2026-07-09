import { apiClient } from './http';
import { ApiResponse, Inspection, NestedPaginatedData, PaginatedResponse, Transformer } from '../types/api';

type NestedInspectionListResponse = ApiResponse<NestedPaginatedData<Inspection>>;

export type InspectionMutationPayload = {
  transformer_id?: string;
  inspection_date?: string;
  visit_type?: string;
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  network_voltage_confirmed?: boolean;
  kva_rating_confirmed?: boolean;
  rating_discrepancy_details?: string;
  physical?: {
    overall_condition?: string;
    rust_corrosion?: string;
    oil_leakage?: string;
    bushing_condition?: string;
    tank_body_damage?: string;
    cooling_fins_condition?: string;
    sound_level?: string;
    temperature?: number;
  };
  oil_breather?: {
    oil_level?: string;
    silica_gel_color?: string;
    oil_test_required?: boolean;
    oil_test_notes?: string;
    oil_temperature?: number;
  };
  electrical?: {
    load_current_a?: number;
    load_current_b?: number;
    load_current_c?: number;
    voltage_hv_side?: number;
    voltage_lv_side?: number;
    load_percentage?: number;
    power_factor?: number;
    frequency?: number;
  };
  site_safety?: {
    security_fencing?: string;
    earthing?: string;
    warning_signs?: string;
    vegetation_encroachment?: string;
    unauthorised_connections?: boolean;
    safety_notes?: string;
  };
  condition_narrative?: string;
  recommended_action?: string;
  recommended_action_details?: string;
};

const normalizeInspectionList = (response: NestedInspectionListResponse | PaginatedResponse<Inspection>): PaginatedResponse<Inspection> => {
  if (Array.isArray(response.data)) return response as PaginatedResponse<Inspection>;
  return {
    success: response.success,
    message: response.message,
    timestamp: response.timestamp,
    data: response.data.data,
    pagination: response.data.pagination
  };
};

export const inspectionApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<NestedInspectionListResponse | PaginatedResponse<Inspection>>('/inspections', { params });
    return normalizeInspectionList(response.data);
  },
  async getById(id: string) {
    try {
      const response = await apiClient.get<ApiResponse<Inspection>>(`/inspections/${id}`);
      return response.data.data;
    } catch (error) {
      const fallback = await this.list({ limit: 1000 });
      const item = fallback.data.find((inspection) => inspection._id === id);
      if (item) return item;
      throw error;
    }
  },
  async create(payload: InspectionMutationPayload) {
    const response = await apiClient.post<ApiResponse<Inspection>>('/inspections', payload);
    return response.data.data;
  },
  async update(id: string, payload: InspectionMutationPayload) {
    const response = await apiClient.put<ApiResponse<Inspection>>(`/inspections/${id}`, payload);
    return response.data.data;
  },
  async overdue() {
    const response = await apiClient.get<{ data: Transformer[] }>('/inspections/overdue');
    return response.data.data;
  },
  async byTransformer(transformerId: string, params: { page?: number; limit?: number } = { limit: 20 }) {
    const response = await apiClient.get<NestedInspectionListResponse | PaginatedResponse<Inspection>>(`/inspections/transformer/${transformerId}`, { params });
    return normalizeInspectionList(response.data);
  },
  async latestForTransformer(transformerId: string) {
    try {
      const response = await apiClient.get<ApiResponse<Inspection>>(`/inspections/transformer/${transformerId}/latest`);
      return response.data.data;
    } catch (error) {
      try {
        const response = await apiClient.get<ApiResponse<Inspection>>(`/inspections/latest/${transformerId}`);
        return response.data.data;
      } catch {
        throw error;
      }
    }
  }
};
