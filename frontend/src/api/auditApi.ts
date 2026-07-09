import { AuditActions, AuditLog, AuditLogFilters, PaginatedResponse } from '../types/api';
import { apiClient } from './http';

const cleanParams = (params: Record<string, unknown>) => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') cleaned[key] = value;
  });
  return cleaned;
};

export const auditApi = {
  async list(filters: AuditLogFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/audit', {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async forUser(userId: string, filters: AuditLogFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>(`/audit/user/${userId}`, {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async forTransformer(transformerId: string, filters: AuditLogFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>(`/audit/transformers/${transformerId}`, {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async actions() {
    const response = await apiClient.get<{ success: boolean; message?: string; data: AuditActions }>('/audit/actions');
    return response.data.data;
  }
};
