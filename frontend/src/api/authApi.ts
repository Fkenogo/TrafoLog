import { apiClient } from './http';
import { ApiResponse, AuthPayload, User } from '../types/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = {
  async login(payload: LoginRequest) {
    const response = await apiClient.post<ApiResponse<AuthPayload>>('/auth/login', payload);
    return response.data.data;
  },
  async me() {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  },
  async refresh() {
    const response = await apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', {});
    return response.data.data;
  },
  async logout() {
    await apiClient.post('/auth/logout', {});
  }
};
