import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { ApiErrorPayload, ApiResponse } from '../types/api';
import { sessionEvents, tokenStore } from '../utils/session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

interface RetryRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config as RetryRequestConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true;
      try {
        const refreshResponse = await apiClient.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', {});
        tokenStore.setAccessToken(refreshResponse.data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch {
        tokenStore.clearAccessToken();
        window.dispatchEvent(new Event(sessionEvents.expired));
      }
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const validation = error.response?.data.errors?.[0]?.message;
    return validation || error.response?.data.message || 'The request could not be completed.';
  }
  if (error instanceof Error) return error.message;
  return 'The request could not be completed.';
};

export const notifyApiError = (error: unknown) => {
  toast.error(getApiErrorMessage(error));
};
