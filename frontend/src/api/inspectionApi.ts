import { apiClient } from './http';
import { Inspection, PaginatedResponse, Transformer } from '../types/api';

export const inspectionApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<PaginatedResponse<Inspection>>('/inspections', { params });
    return response.data;
  },
  async overdue() {
    const response = await apiClient.get<{ data: Transformer[] }>('/inspections/overdue');
    return response.data.data;
  }
};
