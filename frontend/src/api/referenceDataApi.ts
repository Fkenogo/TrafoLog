import { apiClient } from './http';
import { ApiResponse, ReferenceItem } from '../types/api';

type ReferenceListResponse = {
  data: ReferenceItem[] | { data?: ReferenceItem[] };
};

export type TerritoryPayload = {
  name: string;
  code: string;
  region?: string;
};

export type ServiceAreaPayload = {
  name: string;
  code?: string;
  territory_id: string;
};

export type FeederPayload = {
  name: string;
  code?: string;
  service_area_id: string;
  network_voltage_kv?: number;
};

export type RatingPayload = {
  kva: number;
  network_voltage_kv: number;
};

const getList = async (path: string) => {
  const response = await apiClient.get<ReferenceListResponse>(path);
  if (Array.isArray(response.data.data)) return response.data.data;
  return response.data.data.data ?? [];
};

const getOne = async (path: string) => {
  const response = await apiClient.get<ApiResponse<ReferenceItem>>(path);
  return response.data.data;
};

const createItem = async <Payload>(path: string, payload: Payload) => {
  const response = await apiClient.post<ApiResponse<ReferenceItem>>(path, payload);
  return response.data.data;
};

const updateItem = async <Payload>(path: string, payload: Payload) => {
  const response = await apiClient.put<ApiResponse<ReferenceItem>>(path, payload);
  return response.data.data;
};

const deleteItem = async (path: string) => {
  const response = await apiClient.delete<ApiResponse<unknown>>(path);
  return response.data;
};

export const referenceDataApi = {
  territories: () => getList('/territories'),
  territory: (id: string) => getOne(`/territories/${id}`),
  createTerritory: (payload: TerritoryPayload) => createItem('/territories', payload),
  updateTerritory: (id: string, payload: TerritoryPayload) => updateItem(`/territories/${id}`, payload),
  deleteTerritory: (id: string) => deleteItem(`/territories/${id}`),

  serviceAreas: () => getList('/service-areas'),
  serviceArea: (id: string) => getOne(`/service-areas/${id}`),
  serviceAreasByTerritory: (territoryId: string) => getList(`/service-areas/territory/${territoryId}`),
  createServiceArea: (payload: ServiceAreaPayload) => createItem('/service-areas', payload),
  updateServiceArea: (id: string, payload: ServiceAreaPayload) => updateItem(`/service-areas/${id}`, payload),
  deleteServiceArea: (id: string) => deleteItem(`/service-areas/${id}`),

  feeders: () => getList('/feeders'),
  feeder: (id: string) => getOne(`/feeders/${id}`),
  feedersByServiceArea: (serviceAreaId: string) => getList(`/feeders/service-area/${serviceAreaId}`),
  createFeeder: (payload: FeederPayload) => createItem('/feeders', payload),
  updateFeeder: (id: string, payload: FeederPayload) => updateItem(`/feeders/${id}`, payload),
  deleteFeeder: (id: string) => deleteItem(`/feeders/${id}`),

  districts: () => getList('/districts'),

  ratings: () => getList('/ratings'),
  ratingsByNetwork: (networkVoltage: number) => getList(`/ratings/network/${networkVoltage}`),
  createRating: (payload: RatingPayload) => createItem('/ratings', payload),
  updateRating: (id: string, payload: RatingPayload) => updateItem(`/ratings/${id}`, payload),
  deleteRating: (id: string) => deleteItem(`/ratings/${id}`)
};
