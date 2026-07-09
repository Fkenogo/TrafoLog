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

export interface NestedPaginatedData<T> {
  data: T[];
  pagination?: PaginatedResponse<T>['pagination'];
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
  last_login?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdminSystemStats {
  users?: {
    total?: number;
    active?: number;
    by_role?: Record<string, number>;
  };
  transformers?: {
    total?: number;
    by_status?: Record<string, number>;
  };
  faults?: {
    open?: number;
  };
  inspections?: {
    overdue?: number;
  };
  maintenance?: {
    upcoming?: number;
  };
  audit?: {
    recent_activity_count?: number;
  };
  generated_at?: string;
}

export interface AdminMaintenanceState {
  enabled: boolean;
  message?: string;
  reason?: string | null;
  enabled_by?: string | User | null;
  enabled_at?: string | null;
  disabled_by?: string | User | null;
  disabled_at?: string | null;
  updated_at?: string | null;
}

export type BackupStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type BackupOperationType = 'BACKUP' | 'RESTORE';

export interface BackupCollectionSummary {
  name: string;
  document_count?: number;
}

export interface BackupJob {
  _id?: string;
  backup_id: string;
  filename?: string;
  status?: BackupStatus;
  operation_type?: BackupOperationType;
  started_at?: string;
  completed_at?: string;
  created_by?: string | User;
  checksum?: string;
  compression?: string;
  encryption?: boolean;
  size_bytes?: number;
  collections?: BackupCollectionSummary[];
  schema_version?: string;
  app_version?: string;
  retention_until?: string;
  metadata?: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BackupListFilters {
  page?: number;
  limit?: number;
  status?: BackupStatus | '';
}

export interface CreateBackupPayload {
  backup_name?: string;
  retention_until?: string;
  collections?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateMaintenancePayload {
  enabled: boolean;
  message?: string;
  reason?: string;
}

export interface RestoreRequestPayload {
  confirmation: string;
  dryRun: boolean;
  collections?: string[];
}

export interface RestoreDryRunResult {
  dryRun: true;
  backup_id: string;
  verified: boolean;
  collections: string[];
  plan?: {
    collections?: BackupCollectionSummary[];
    total_documents?: number;
  };
  warnings?: string[];
}

export interface RestoreExecutionResult {
  dryRun: false;
  backup_id: string;
  pre_restore_backup_id: string;
  restored_collections: string[];
  restored_counts: Record<string, number>;
  completed_at: string;
}

export type RestoreResult = RestoreDryRunResult | RestoreExecutionResult;

export interface UserListFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | '';
  territory_id?: string;
  service_area_id?: string;
  is_active?: boolean | '';
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  territory_id?: string;
  service_area_id?: string;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  territory_id?: string;
  service_area_id?: string;
}

export interface ChangeUserRolePayload {
  role: UserRole;
  territory_id?: string;
  service_area_id?: string;
}

export interface ActivateUserPayload {
  notes?: string;
}

export interface DeactivateUserPayload {
  reason: string;
}

export interface AuditLog {
  _id: string;
  user_id?: string | User;
  action?: string;
  action_category?: string;
  target_user_id?: string | User;
  target_transformer_id?: string | Transformer;
  target_record_type?: string;
  target_record_id?: string;
  details?: string;
  request_method?: string;
  request_path?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  is_sensitive?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  action_category?: string;
  user_id?: string;
  target_type?: string;
  target_id?: string;
  startDate?: string;
  endDate?: string;
  is_sensitive?: boolean | '';
}

export interface AuditActions {
  categories: string[];
  actions: string[];
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
  year_manufactured?: number;
  uedcl_reference?: string;
  record_status?: string;
  kva_rating?: number;
  network_voltage_kv?: number;
  display_rating?: string;
  voltage_secondary?: string;
  phase_type?: string;
  cooling_type?: string;
  mounting_type?: string;
  vector_group?: string;
  operational_status?: string;
  site_name?: string;
  location_administrative?: {
    site_name?: string;
    district_id?: string;
    district_name?: string;
    sub_county?: string;
    parish?: string;
    village?: string;
  };
  gps?: {
    coordinates?: number[];
    method?: string;
    accuracy_metres?: number;
    captured_at?: string;
  };
  installation?: {
    install_date?: string;
    installing_contractor?: string;
    commissioned_by?: string;
    commissioning_date?: string;
    warranty_expiry?: string;
  };
  location_operational?: {
    territory_id?: string | { _id?: string; name?: string; code?: string };
    territory_name?: string;
    service_area_id?: string | { _id?: string; name?: string };
    service_area_name?: string;
    feeder_id?: string | { _id?: string; name?: string; code?: string };
    feeder_name?: string;
    feeder_code?: string;
    substation_name?: string;
  };
  condition?: string;
  overall_condition?: string;
  latest_inspection?: {
    inspection_date?: string;
    physical?: {
      overall_condition?: string;
    };
    overall_condition?: string;
  };
  last_inspection_date?: string;
  last_maintenance_date?: string;
  last_load_reading_date?: string;
  last_load_percentage?: number;
  has_open_fault?: boolean;
  overdue_inspection_flag?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Fault {
  _id: string;
  transformer_id?: string | Transformer;
  inspection_id?: string | Inspection;
  fault_type?: string;
  fault_status?: string;
  severity?: string;
  fault_source?: string;
  fault_description?: string;
  fault_date?: string;
  network_voltage_kv?: number;
  customers_affected?: number;
  area_affected?: string;
  assigned_to?: string | User;
  date_assigned?: string;
  target_resolution_date?: string;
  reported_by?: string | User;
  resolved_by?: string | User;
  resolved_date?: string;
  resolution_description?: string;
  root_cause?: string;
  parts_replaced?: string;
  downtime_hours?: number;
  photos?: string[];
  photos_after_repair?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Inspection {
  _id: string;
  transformer_id?: string | Transformer;
  overall_condition?: string;
  inspection_date?: string;
  visit_type?: string;
  inspected_by?: string | User;
  inspector_id?: string | User;
  gps_at_inspection?: {
    type?: string;
    coordinates?: number[];
  };
  gps_accuracy?: number;
  network_voltage_confirmed?: boolean;
  kva_rating_confirmed?: boolean;
  rating_discrepancy_flag?: boolean;
  rating_discrepancy_details?: string;
  physical?: {
    overall_condition?: string;
    rust_corrosion?: string;
    oil_leakage?: string;
    bushing_condition?: string;
    tank_body_damage?: string;
    cooling_fins_condition?: string;
    sound_level?: string;
    temperature?: number;
  };
  oil_breather?: {
    oil_level?: string;
    silica_gel_color?: string;
    oil_test_required?: boolean;
    oil_test_notes?: string;
    oil_temperature?: number;
  };
  electrical?: {
    load_current_a?: number;
    load_current_b?: number;
    load_current_c?: number;
    voltage_hv_side?: number;
    voltage_lv_side?: number;
    load_percentage?: number;
    overload_flag?: boolean;
    power_factor?: number;
    frequency?: number;
  };
  site_safety?: {
    security_fencing?: string;
    earthing?: string;
    warning_signs?: string;
    vegetation_encroachment?: string;
    unauthorised_connections?: boolean;
    safety_notes?: string;
  };
  photos?: string[];
  sync_status?: string;
  condition_narrative?: string;
  recommended_action?: string;
  recommended_action_details?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MaintenanceRecord {
  _id: string;
  transformer_id?: string | Transformer;
  maintenance_type?: string;
  maintenance_date?: string;
  next_maintenance_date?: string;
  technician_id?: string | User;
  technician_name?: string;
  team_contractor?: string;
  supervised_by?: string;
  work_order_number?: string;
  completed_by?: string;
  reviewed_by?: string;
  post_condition_narrative?: string;
  next_maintenance_notes?: string;
  status?: string;
  sync_status?: string;
  created_at?: string;
}

export type NotificationType =
  | 'FAULT_ALERT'
  | 'FAULT_ASSIGNED'
  | 'FAULT_RESOLVED'
  | 'FAULT_ESCALATED'
  | 'FAULT_REOPENED'
  | 'INSPECTION_ALERT'
  | 'OVERLOAD_ALERT'
  | 'OVERDUE_INSPECTION'
  | 'MAINTENANCE_ALERT'
  | 'MAINTENANCE_SCHEDULED'
  | 'SYSTEM_ALERT'
  | 'USER_ACTION_REQUIRED'
  | 'TRANSFORMER_VERIFIED'
  | 'TRANSFORMER_DECOMMISSIONED'
  | 'IMPORT_COMPLETED'
  | 'REPORT_READY';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface Notification {
  _id: string;
  user_id?: string | User;
  type?: NotificationType | string;
  priority?: NotificationPriority | string;
  title?: string;
  message?: string;
  data?: Record<string, unknown>;
  linked_record_type?: string;
  linked_record_id?: string | Record<string, unknown>;
  is_read?: boolean;
  read_at?: string;
  delivered_at?: string;
  delivery_methods?: string[];
  delivery_status?: NotificationDeliveryStatus | string;
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationUnreadCount {
  count: number;
}

export interface TimelineEvent {
  _id: string;
  event_type?: string;
  event_summary?: string;
  event_date?: string;
  event_details?: string;
  linked_record_type?: string;
  display_data?: {
    user_name?: string;
    user_role?: string;
    location?: string;
    rating?: string;
    status?: string;
  };
  created_by?: string | User;
  created_at?: string;
}

export interface TransformerQrCode {
  _id?: string;
  transformer_id?: string | Transformer;
  qr_code_string?: string;
  qr_code_image?: string;
  qr_code_image_thumbnail?: string;
  version?: number;
  format?: string;
  status?: string;
  generated_at?: string;
  expires_at?: string;
  scan_count?: number;
  last_scanned_at?: string;
  qr_data?: Record<string, unknown>;
}

export interface ReferenceItem {
  _id: string;
  name?: string;
  code?: string;
  description?: string;
  region?: string;
  location_town?: string;
  territory_id?: string | { _id?: string; name?: string; code?: string };
  service_area_id?: string | { _id?: string; name?: string; code?: string };
  kva?: number;
  network_voltage_kv?: number;
  display_label?: string;
  is_standard?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TransformerStats {
  total?: number;
  active?: number;
  faulty?: number;
  underMaintenance?: number;
  decommissioned?: number;
  unverified?: number;
  '11kV'?: number;
  '33kV'?: number;
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
