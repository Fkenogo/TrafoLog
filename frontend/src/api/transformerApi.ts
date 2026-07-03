import { apiClient } from './http';
import { PaginatedResponse, Transformer, TransformerStats } from '../types/api';

export const transformerApi = {
  async list(params: Record<string, unknown> = { limit: 20 }) {
    const response = await apiClient.get<PaginatedResponse<Transformer>>('/transformers', { params });
    return response.data;
  },
  async getById(id: string) {
    const response = await apiClient.get<{ data: Transformer }>(`/transformers/${id}`);
    return response.data.data;
  },
  async stats() {
    const response = await apiClient.get<{ data: TransformerStats }>('/transformers/stats');
    return response.data.data;
  }
};
