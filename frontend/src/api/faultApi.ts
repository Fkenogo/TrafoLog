import { apiClient } from './http';
import { Fault, FaultStats, PaginatedResponse } from '../types/api';

export const faultApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<PaginatedResponse<Fault>>('/faults', { params });
    return response.data;
  },
  async stats() {
    const response = await apiClient.get<{ data: FaultStats }>('/faults/stats');
    return response.data.data;
  },
  async open() {
    const response = await apiClient.get<{ data: Fault[] }>('/faults/open');
    return response.data.data;
  }
};
