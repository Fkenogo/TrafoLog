export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages?: number;
    totalPages?: number;
  };
}

export interface ApiErrorPayload {
  success: false;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
  timestamp?: string;
}

export type UserRole = 'Super Admin' | 'Territory Manager' | 'Engineer' | 'Field Technician' | 'Viewer';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  territory_id?: string | { _id?: string; name?: string; code?: string };
  service_area_id?: string | { _id?: string; name?: string };
  is_active?: boolean;
  is_email_verified?: boolean;
  created_at?: string;
}

export interface AuthPayload {
  user: User;
  accessToken: string;
  sessionToken?: string;
}

export interface Transformer {
  _id: string;
  asset_id?: string;
  manufacturer?: string;
  serial_number?: string;
  kva_rating?: number;
  network_voltage_kv?: number;
  operational_status?: string;
  site_name?: string;
  location_administrative?: {
    site_name?: string;
    district_id?: string;
  };
  location_operational?: {
    territory_id?: string;
    service_area_id?: string;
    feeder_name?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface Fault {
  _id: string;
  transformer_id?: string | Transformer;
  fault_type?: string;
  fault_status?: string;
  severity?: string;
  fault_description?: string;
  fault_date?: string;
  created_at?: string;
}

export interface Inspection {
  _id: string;
  transformer_id?: string | Transformer;
  overall_condition?: string;
  inspection_date?: string;
  inspected_by?: string | User;
  created_at?: string;
}

export interface MaintenanceRecord {
  _id: string;
  transformer_id?: string | Transformer;
  maintenance_type?: string;
  maintenance_date?: string;
  next_maintenance_date?: string;
  technician_name?: string;
  status?: string;
  created_at?: string;
}

export interface ReferenceItem {
  _id: string;
  name?: string;
  code?: string;
  region?: string;
  kva?: number;
  network_voltage_kv?: number;
  [key: string]: unknown;
}

export interface TransformerStats {
  total?: number;
  by_status?: Record<string, number>;
  by_territory?: Record<string, number>;
  [key: string]: unknown;
}

export interface FaultStats {
  total?: number;
  by_type?: Record<string, number>;
  by_status?: Record<string, number>;
  [key: string]: unknown;
}
