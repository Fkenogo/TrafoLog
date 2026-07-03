import { apiClient } from './http';
import { MaintenanceRecord, PaginatedResponse } from '../types/api';

export const maintenanceApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<PaginatedResponse<MaintenanceRecord>>('/maintenance', { params });
    return response.data;
  },
  async upcoming() {
    const response = await apiClient.get<{ data: MaintenanceRecord[] }>('/maintenance/upcoming');
    return response.data.data;
  },
  async stats() {
    const response = await apiClient.get<{ data: Record<string, unknown> }>('/maintenance/stats');
    return response.data.data;
  }
};
