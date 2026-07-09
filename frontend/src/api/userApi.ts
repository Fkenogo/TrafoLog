import {
  ActivateUserPayload,
  ChangeUserRolePayload,
  CreateUserPayload,
  DeactivateUserPayload,
  PaginatedResponse,
  UpdateUserPayload,
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

type UserResponse = {
  success: boolean;
  message?: string;
  data: User;
};

export const userApi = {
  async list(filters: UserListFilters = {}) {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', {
      params: cleanParams(filters as Record<string, unknown>)
    });
    return {
      data: response.data.data ?? [],
      pagination: response.data.pagination
    };
  },

  async get(id: string) {
    const response = await apiClient.get<UserResponse>(`/users/${id}`);
    return response.data.data;
  },

  async create(payload: CreateUserPayload) {
    const response = await apiClient.post<UserResponse>('/users', payload);
    return response.data.data;
  },

  async update(id: string, payload: UpdateUserPayload) {
    const response = await apiClient.put<UserResponse>(`/users/${id}`, payload);
    return response.data.data;
  },

  async changeRole(id: string, payload: ChangeUserRolePayload) {
    const response = await apiClient.post<UserResponse>(`/users/${id}/role`, payload);
    return response.data.data;
  },

  async activate(id: string, payload: ActivateUserPayload = {}) {
    const response = await apiClient.post<UserResponse>(`/users/${id}/activate`, payload);
    return response.data.data;
  },

  async deactivate(id: string, payload: DeactivateUserPayload) {
    const response = await apiClient.post<UserResponse>(`/users/${id}/deactivate`, payload);
    return response.data.data;
  }
};
