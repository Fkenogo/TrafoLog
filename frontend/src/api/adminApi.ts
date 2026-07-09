import {
  AdminMaintenanceState,
  AdminSystemStats,
  AuditLog,
  AuditLogFilters,
  BackupJob,
  BackupListFilters,
  CreateBackupPayload,
  PaginatedResponse,
  RestoreRequestPayload,
  RestoreResult,
  UpdateMaintenancePayload,
  User,
  UserListFilters
} from '../types/api';
import { apiClient } from './http';

const cleanParams = (params: Record<string, unknown>) => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') cleaned[key] = value;
  });
  return cleaned;
};

export const adminApi = {
  async systemStats() {
    const response = await apiClient.get<{ success: boolean; message?: string; data: AdminSystemStats }>('/admin/system-stats');
    return response.data.data;
  },

  async users(filters: UserListFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<User>>('/admin/users', {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async auditLogs(filters: AuditLogFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async maintenance() {
    const response = await apiClient.get<{ success: boolean; message?: string; data: AdminMaintenanceState }>('/admin/maintenance');
    return response.data.data;
  },

  async updateMaintenance(payload: UpdateMaintenancePayload) {
    const response = await apiClient.post<{ success: boolean; message?: string; data: AdminMaintenanceState }>('/admin/maintenance', payload);
    return response.data.data;
  },

  async createBackup(payload: CreateBackupPayload) {
    const response = await apiClient.post<{ success: boolean; message?: string; data: BackupJob }>('/admin/backup', payload);
    return response.data.data;
  },

  async backups(filters: BackupListFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<BackupJob>>('/admin/backups', {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async restore(backupId: string, payload: RestoreRequestPayload) {
    const restoreBase = '/admin/restore';
    const response = await apiClient.post<{ success: boolean; message?: string; data: RestoreResult }>(`${restoreBase}/${backupId}`, payload);
    return response.data.data;
  }
};
