import { apiClient } from './http';
import { ApiResponse, Fault, FaultStats, NestedPaginatedData, PaginatedResponse } from '../types/api';

type NestedFaultListResponse = ApiResponse<NestedPaginatedData<Fault>>;

const emptyFaultList = (response: { success?: boolean; message?: string; timestamp?: string } = {}): PaginatedResponse<Fault> => ({
  success: response.success ?? true,
  message: response.message,
  timestamp: response.timestamp,
  data: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 1 }
});

const normalizeFaultList = (response: NestedFaultListResponse | PaginatedResponse<Fault> | ApiResponse<Fault[]>): PaginatedResponse<Fault> => {
  if (Array.isArray(response.data)) {
    return {
      ...response,
      data: response.data,
      pagination: 'pagination' in response && response.pagination ? response.pagination : { page: 1, limit: response.data.length, total: response.data.length, pages: 1 }
    };
  }

  if (response.data && Array.isArray(response.data.data)) {
    return {
      success: response.success,
      message: response.message,
      timestamp: response.timestamp,
      data: response.data.data,
      pagination: response.data.pagination
    };
  }

  return emptyFaultList(response);
};

export type FaultMutationPayload = {
  transformer_id?: string;
  inspection_id?: string;
  fault_date?: string;
  fault_source?: string;
  fault_description?: string;
  fault_type?: string;
  severity?: string;
  network_voltage_kv?: number;
  customers_affected?: number;
  area_affected?: string;
};

export type FaultAssignPayload = {
  assigned_to: string;
  target_resolution_date?: string;
};

export type FaultResolvePayload = {
  resolution_description: string;
  root_cause?: string;
  parts_replaced?: string;
  resolved_date?: string;
};

export const faultApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<NestedFaultListResponse | PaginatedResponse<Fault> | ApiResponse<Fault[]>>('/faults', { params });
    return normalizeFaultList(response.data);
  },
  async getById(id: string) {
    const response = await apiClient.get<ApiResponse<Fault>>(`/faults/${id}`);
    return response.data.data;
  },
  async create(payload: FaultMutationPayload) {
    const response = await apiClient.post<ApiResponse<Fault>>('/faults', payload);
    return response.data.data;
  },
  async update(id: string, payload: FaultMutationPayload) {
    const response = await apiClient.put<ApiResponse<Fault>>(`/faults/${id}`, payload);
    return response.data.data;
  },
  async assign(id: string, payload: FaultAssignPayload) {
    const response = await apiClient.put<ApiResponse<Fault>>(`/faults/${id}/assign`, payload);
    return response.data.data;
  },
  async resolve(id: string, payload: FaultResolvePayload) {
    const response = await apiClient.put<ApiResponse<Fault>>(`/faults/${id}/resolve`, payload);
    return response.data.data;
  },
  async close(id: string) {
    const response = await apiClient.put<ApiResponse<Fault>>(`/faults/${id}/close`, {});
    return response.data.data;
  },
  async escalate(id: string, reason: string) {
    const response = await apiClient.put<ApiResponse<Fault>>(`/faults/${id}/escalate`, { reason });
    return response.data.data;
  },
  async stats() {
    const response = await apiClient.get<{ data: FaultStats }>('/faults/stats');
    return response.data.data;
  },
  async open() {
    const response = await apiClient.get<{ data: Fault[] }>('/faults/open');
    return response.data.data;
  },
  async byTransformer(transformerId: string) {
    const response = await apiClient.get<{ data: Fault[] }>(`/faults/transformer/${transformerId}`);
    return response.data.data;
  }
};
