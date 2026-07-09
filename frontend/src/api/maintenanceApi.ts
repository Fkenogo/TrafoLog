import { apiClient } from './http';
import { ApiResponse, MaintenanceRecord, NestedPaginatedData, PaginatedResponse } from '../types/api';

type NestedMaintenanceListResponse = ApiResponse<NestedPaginatedData<MaintenanceRecord>>;

const normalizeMaintenanceList = (response: NestedMaintenanceListResponse | PaginatedResponse<MaintenanceRecord>): PaginatedResponse<MaintenanceRecord> => {
  if (Array.isArray(response.data)) return response as PaginatedResponse<MaintenanceRecord>;
  if (response.data && Array.isArray(response.data.data)) return {
    success: response.success,
    message: response.message,
    timestamp: response.timestamp,
    data: response.data.data,
    pagination: response.data.pagination
  };
  return {
    success: response.success ?? true,
    message: response.message,
    timestamp: response.timestamp,
    data: [],
    pagination: { page: 1, limit: 20, total: 0, pages: 1 }
  };
};

export const maintenanceApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<NestedMaintenanceListResponse | PaginatedResponse<MaintenanceRecord>>('/maintenance', { params });
    return normalizeMaintenanceList(response.data);
  },
  async upcoming() {
    const response = await apiClient.get<{ data: MaintenanceRecord[] }>('/maintenance/upcoming');
    return response.data.data;
  },
  async stats() {
    const response = await apiClient.get<{ data: Record<string, unknown> }>('/maintenance/stats');
    return response.data.data;
  },
  async byTransformer(transformerId: string, params: { page?: number; limit?: number } = { limit: 20 }) {
    const response = await apiClient.get<NestedMaintenanceListResponse | PaginatedResponse<MaintenanceRecord>>(`/maintenance/transformer/${transformerId}`, { params });
    return normalizeMaintenanceList(response.data);
  }
};
