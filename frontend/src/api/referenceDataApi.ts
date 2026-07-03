import { apiClient } from './http';
import { ReferenceItem } from '../types/api';

const getList = async (path: string) => {
  const response = await apiClient.get<{ data: ReferenceItem[] }>(path);
  return response.data.data;
};

export const referenceDataApi = {
  territories: () => getList('/territories'),
  serviceAreas: () => getList('/service-areas'),
  feeders: () => getList('/feeders'),
  districts: () => getList('/districts'),
  ratings: () => getList('/ratings')
};
