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

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

let refreshPromise: Promise<string> | null = null;
let hasNotifiedSessionExpired = false;

const isAuthEndpoint = (url?: string) => {
  if (!url) return false;
  return url.includes('/auth/');
};

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiResponse<{ accessToken: string }>>('/auth/refresh', {})
      .then((response) => {
        const nextToken = response.data.data.accessToken;
        tokenStore.setAccessToken(nextToken);
        hasNotifiedSessionExpired = false;
        return nextToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const expireSession = () => {
  tokenStore.clearAccessToken();
  if (!hasNotifiedSessionExpired) {
    hasNotifiedSessionExpired = true;
    window.dispatchEvent(new Event(sessionEvents.expired));
  }
};

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

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      originalRequest._retry = true;
      try {
        const nextToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return apiClient(originalRequest);
      } catch {
        expireSession();
      }
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const validation = error.response?.data.errors?.[0]?.message;
    const message = validation || error.response?.data.message;
    const unsafeBackendMessage = message && (
      message.toLowerCase().includes('axios') ||
      message.includes('Service.') ||
      message.includes(' is not a function') ||
      message.toLowerCase().includes('stack')
    );
    if (message && !unsafeBackendMessage) return message;
    if (error.response?.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.response?.status === 403) return 'You do not have permission to complete this action.';
    if (error.response?.status === 404) return 'The requested record could not be found.';
    if (error.response?.status && error.response.status >= 500) return 'The server could not complete the request. Please try again.';
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
    return 'The request could not be completed.';
  }
  return 'The request could not be completed.';
};

export const notifyApiError = (error: unknown) => {
  toast.error(getApiErrorMessage(error));
};
