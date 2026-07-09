import { apiClient } from './http';
import { ApiResponse, NestedPaginatedData, Notification, NotificationUnreadCount } from '../types/api';

export type NotificationListParams = {
  page?: number;
  limit?: number;
};

export const notificationApi = {
  async list(params: NotificationListParams = { limit: 20 }) {
    const response = await apiClient.get<ApiResponse<NestedPaginatedData<Notification>>>('/notifications', { params });
    return response.data.data;
  },
  async unreadCount() {
    const response = await apiClient.get<ApiResponse<NotificationUnreadCount>>('/notifications/unread/count');
    return response.data.data;
  },
  async markRead(id: string) {
    const response = await apiClient.put<ApiResponse<Notification>>(`/notifications/${id}/read`, {});
    return response.data.data;
  },
  async markAllRead() {
    const response = await apiClient.put<ApiResponse<{ success: boolean }>>('/notifications/read-all', {});
    return response.data.data;
  },
  async delete(id: string) {
    const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/notifications/${id}`);
    return response.data.data;
  }
};
