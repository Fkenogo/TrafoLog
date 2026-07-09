import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, DatabaseBackup, PlayCircle, Power, RefreshCw, RotateCcw, Search, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { adminApi } from '../../api/adminApi';
import { auditApi } from '../../api/auditApi';
import { getApiErrorMessage, notifyApiError } from '../../api/http';
import { referenceDataApi } from '../../api/referenceDataApi';
import { userApi } from '../../api/userApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { DataTable } from '../../components/tables/DataTable';
import { useAuth } from '../../hooks/useAuth';
import { AdminMaintenanceState, AuditLog, BackupJob, BackupStatus, ReferenceItem, RestoreResult, User, UserRole } from '../../types/api';
import { asCount, formatDate, getTransformerName } from '../../utils/format';

type AdminTab = 'overview' | 'users' | 'audit' | 'operations';
type UserPanel = 'create' | 'edit' | 'role' | 'deactivate' | undefined;

const roles: UserRole[] = ['Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer'];
const targetTypes = ['User', 'Transformer', 'Inspection', 'Fault', 'Maintenance', 'Installation', 'Report'];
const restoreCollections = ['transformers', 'inspections', 'faults', 'maintenances'] as const;
const backupStatuses: BackupStatus[] = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'];

const userFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters.').max(100, 'Name must be 100 characters or less.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    role: z.enum(['Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer']),
    territory_id: z.string().optional(),
    service_area_id: z.string().optional(),
    is_active: z.boolean().default(true)
  })
  .superRefine((values, ctx) => {
    const creating = values.password !== undefined;
    if (creating) {
      if (!values.password || values.password.length < 8) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Password must be at least 8 characters.' });
      }
      if (values.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(values.password)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'Use uppercase, lowercase, number, and special character.' });
      }
      if (values.password !== values.confirmPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match.' });
      }
    }
    if (['Territory Manager', 'Engineer', 'Field Technician'].includes(values.role) && !values.territory_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['territory_id'], message: 'Territory is required for this role.' });
    }
    if (['Engineer', 'Field Technician'].includes(values.role) && !values.service_area_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['service_area_id'], message: 'Service area is required for this role.' });
    }
  });

const roleSchema = z.object({
  role: z.enum(['Super Admin', 'Territory Manager', 'Engineer', 'Field Technician', 'Viewer']),
  territory_id: z.string().optional(),
  service_area_id: z.string().optional()
}).superRefine((values, ctx) => {
  if (['Territory Manager', 'Engineer', 'Field Technician'].includes(values.role) && !values.territory_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['territory_id'], message: 'Territory is required for this role.' });
  }
  if (['Engineer', 'Field Technician'].includes(values.role) && !values.service_area_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['service_area_id'], message: 'Service area is required for this role.' });
  }
});

const deactivateSchema = z.object({
  reason: z.string().min(3, 'Enter a reason before deactivating this user.').max(500, 'Reason must be 500 characters or less.')
});

const maintenanceSchema = z.object({
  message: z.string().max(500, 'Message must be 500 characters or less.').optional(),
  reason: z.string().min(3, 'Enter a reason for changing maintenance mode.').max(500, 'Reason must be 500 characters or less.')
});

const backupSchema = z.object({
  backup_name: z.string()
    .min(3, 'Backup name must be at least 3 characters.')
    .max(80, 'Backup name must be 80 characters or less.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Use letters, numbers, hyphens, or underscores. Start with a letter or number.'),
  retention_until: z.string().optional(),
  collections: z.array(z.string()).min(1, 'Select at least one collection.')
}).superRefine((values, ctx) => {
  if (values.retention_until && new Date(values.retention_until) <= new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['retention_until'], message: 'Retention date must be in the future.' });
  }
});

const restoreSchema = z.object({
  confirmation: z.string().optional(),
  collections: z.array(z.string()).min(1, 'Select at least one collection.')
});

type UserFormValues = z.infer<typeof userFormSchema>;
type RoleFormValues = z.infer<typeof roleSchema>;
type DeactivateFormValues = z.infer<typeof deactivateSchema>;
type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;
type BackupFormValues = z.infer<typeof backupSchema>;
type RestoreFormValues = z.infer<typeof restoreSchema>;

function refLabel(value?: string | { _id?: string; name?: string; code?: string }) {
  if (!value) return 'Not assigned';
  if (typeof value === 'string') return value;
  return value.name || value.code || value._id || 'Not assigned';
}

function userLabel(value?: string | User) {
  if (!value) return 'System';
  if (typeof value === 'string') return value;
  return value.name || value.email || 'System';
}

function optionLabel(item: ReferenceItem) {
  return item.name || item.display_label || item.code || item._id;
}

function statusBadge(user: User) {
  return user.is_active === false ? <span className="badge danger">Deactivated</span> : <span className="badge green">Active</span>;
}

function backupStatusBadge(status?: string) {
  if (status === 'COMPLETED') return 'badge green';
  if (status === 'FAILED') return 'badge danger';
  if (status === 'RUNNING') return 'badge amber';
  return 'badge muted-badge';
}

function roleBadge(role?: string) {
  if (role === 'Super Admin') return 'badge danger';
  if (role === 'Territory Manager') return 'badge amber';
  if (role === 'Engineer' || role === 'Field Technician') return 'badge green';
  return 'badge muted-badge';
}

function categoryBadge(category?: string) {
  if (category === 'USER_MANAGEMENT' || category === 'SYSTEM') return 'badge danger';
  if (category === 'FAULT_MANAGEMENT' || category === 'MAINTENANCE') return 'badge amber';
  return 'badge muted-badge';
}

function statNumber(value: unknown) {
  return asCount(value).toLocaleString();
}

function bytesLabel(value?: number) {
  if (!value && value !== 0) return 'Not recorded';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(value?: string) {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : 'Not recorded';
}

function backupCreator(value?: string | User) {
  return userLabel(value);
}

function maintenanceUser(value?: string | User | null) {
  if (!value) return 'Not recorded';
  return userLabel(value);
}

function collectionLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/s$/, '')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function allowedBackupCollections(job?: BackupJob) {
  const names = job?.collections?.map((collection) => collection.name).filter(Boolean) ?? [];
  const allowed = names.filter((name) => restoreCollections.some((collection) => collection === name));
  return allowed.length > 0 ? allowed : [...restoreCollections];
}

function PaginationControls({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return (
    <div className="pagination-row">
      <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {Math.max(1, pages)}</span>
      <button className="secondary-button" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'green' | 'amber' | 'risk' }) {
  return (
    <article className={`registry-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="field-error">{message}</small> : null;
}

export function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [backupPage, setBackupPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [userPanel, setUserPanel] = useState<UserPanel>();
  const [selectedBackup, setSelectedBackup] = useState<BackupJob | undefined>();
  const [maintenanceAction, setMaintenanceAction] = useState<'enable' | 'disable' | undefined>();
  const [backupFilters, setBackupFilters] = useState<{ status: BackupStatus | '' }>({ status: '' });
  const [lastDryRun, setLastDryRun] = useState<RestoreResult | undefined>();
  const [lastRestore, setLastRestore] = useState<RestoreResult | undefined>();
  const [userFilters, setUserFilters] = useState({ search: '', role: '', is_active: '', territory_id: '', service_area_id: '' });
  const [auditFilters, setAuditFilters] = useState({ action: '', action_category: '', user_id: '', target_type: '', target_id: '', startDate: '', endDate: '', is_sensitive: '' });
  const [auditError, setAuditError] = useState('');

  const isSuperAdmin = user?.role === 'Super Admin';

  const statsQuery = useQuery({
    queryKey: ['admin', 'system-stats'],
    queryFn: adminApi.systemStats,
    enabled: isSuperAdmin && activeTab === 'overview',
    staleTime: 30_000
  });

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', userPage, userFilters],
    queryFn: () => adminApi.users({
      page: userPage,
      limit: 10,
      search: userFilters.search,
      role: userFilters.role as UserRole | '',
      territory_id: userFilters.territory_id,
      service_area_id: userFilters.service_area_id,
      is_active: userFilters.is_active === '' ? '' : userFilters.is_active === 'true'
    }),
    enabled: isSuperAdmin && activeTab === 'users',
    staleTime: 30_000
  });

  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-logs', auditPage, auditFilters],
    queryFn: () => adminApi.auditLogs({
      page: auditPage,
      limit: 10,
      action: auditFilters.action,
      action_category: auditFilters.action_category,
      user_id: auditFilters.user_id,
      target_type: auditFilters.target_type,
      target_id: auditFilters.target_id,
      startDate: auditFilters.startDate,
      endDate: auditFilters.endDate,
      is_sensitive: auditFilters.is_sensitive === '' ? '' : auditFilters.is_sensitive === 'true'
    }),
    enabled: isSuperAdmin && activeTab === 'audit',
    staleTime: 30_000
  });

  const auditActionsQuery = useQuery({
    queryKey: ['audit', 'actions'],
    queryFn: auditApi.actions,
    enabled: isSuperAdmin && activeTab === 'audit',
    staleTime: 5 * 60_000
  });

  const maintenanceQuery = useQuery({
    queryKey: ['admin', 'maintenance'],
    queryFn: adminApi.maintenance,
    enabled: isSuperAdmin && activeTab === 'operations',
    staleTime: 30_000
  });

  const backupsQuery = useQuery({
    queryKey: ['admin', 'backups', backupPage, backupFilters],
    queryFn: () => adminApi.backups({ page: backupPage, limit: 10, status: backupFilters.status }),
    enabled: isSuperAdmin && activeTab === 'operations',
    staleTime: 30_000
  });

  const [territoriesQuery, serviceAreasQuery] = useQueries({
    queries: [
      { queryKey: ['reference-data', 'territories'], queryFn: referenceDataApi.territories, enabled: isSuperAdmin && activeTab === 'users', staleTime: 5 * 60_000 },
      { queryKey: ['reference-data', 'service-areas'], queryFn: referenceDataApi.serviceAreas, enabled: isSuperAdmin && activeTab === 'users', staleTime: 5 * 60_000 }
    ]
  });

  const territories = territoriesQuery.data ?? [];
  const serviceAreas = serviceAreasQuery.data ?? [];

  const invalidateAdmin = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    ]);
  };

  const invalidateMaintenance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'maintenance'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-stats'] })
    ]);
  };

  const invalidateBackup = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    ]);
  };

  const invalidateRestore = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['transformers'] }),
      queryClient.invalidateQueries({ queryKey: ['transformer'] }),
      queryClient.invalidateQueries({ queryKey: ['inspections'] }),
      queryClient.invalidateQueries({ queryKey: ['inspection'] }),
      queryClient.invalidateQueries({ queryKey: ['faults'] }),
      queryClient.invalidateQueries({ queryKey: ['fault'] }),
      queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    ]);
  };

  const createForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: 'Viewer', territory_id: '', service_area_id: '', is_active: true }
  });
  const editForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', email: '', role: 'Viewer', territory_id: '', service_area_id: '', is_active: true }
  });
  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { role: 'Viewer', territory_id: '', service_area_id: '' }
  });
  const deactivateForm = useForm<DeactivateFormValues>({
    resolver: zodResolver(deactivateSchema),
    defaultValues: { reason: '' }
  });
  const maintenanceForm = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: { message: 'System is under maintenance', reason: '' }
  });
  const backupForm = useForm<BackupFormValues>({
    resolver: zodResolver(backupSchema),
    defaultValues: { backup_name: 'admin_backup', retention_until: '', collections: ['transformers', 'inspections', 'faults', 'maintenances'] }
  });
  const restoreForm = useForm<RestoreFormValues>({
    resolver: zodResolver(restoreSchema),
    defaultValues: { confirmation: '', collections: ['transformers'] }
  });

  const openPanel = (panel: UserPanel, item?: User) => {
    setSelectedUser(item);
    setUserPanel(panel);
    if (panel === 'create') {
      createForm.reset({ name: '', email: '', password: '', confirmPassword: '', role: 'Viewer', territory_id: '', service_area_id: '', is_active: true });
    }
    if (panel === 'edit' && item) {
      editForm.reset({
        name: item.name || '',
        email: item.email || '',
        role: item.role || 'Viewer',
        territory_id: typeof item.territory_id === 'string' ? item.territory_id : item.territory_id?._id || '',
        service_area_id: typeof item.service_area_id === 'string' ? item.service_area_id : item.service_area_id?._id || '',
        is_active: item.is_active !== false
      });
    }
    if (panel === 'role' && item) {
      roleForm.reset({
        role: item.role || 'Viewer',
        territory_id: typeof item.territory_id === 'string' ? item.territory_id : item.territory_id?._id || '',
        service_area_id: typeof item.service_area_id === 'string' ? item.service_area_id : item.service_area_id?._id || ''
      });
    }
    if (panel === 'deactivate') deactivateForm.reset({ reason: '' });
  };

  const closePanel = () => {
    setUserPanel(undefined);
    setSelectedUser(undefined);
  };

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) => userApi.create({
      name: values.name,
      email: values.email,
      password: values.password || '',
      confirmPassword: values.confirmPassword || '',
      role: values.role,
      territory_id: values.territory_id || undefined,
      service_area_id: values.service_area_id || undefined,
      is_active: values.is_active
    }),
    onSuccess: async () => {
      toast.success('User created');
      closePanel();
      await invalidateAdmin();
    },
    onError: notifyApiError
  });

  const editMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (!selectedUser) throw new Error('Select a user to update.');
      return userApi.update(selectedUser._id, {
        name: values.name,
        email: values.email,
        territory_id: values.territory_id || undefined,
        service_area_id: values.service_area_id || undefined
      });
    },
    onSuccess: async () => {
      toast.success('User updated');
      closePanel();
      await invalidateAdmin();
    },
    onError: notifyApiError
  });

  const roleMutation = useMutation({
    mutationFn: (values: RoleFormValues) => {
      if (!selectedUser) throw new Error('Select a user to update.');
      return userApi.changeRole(selectedUser._id, {
        role: values.role,
        territory_id: values.territory_id || undefined,
        service_area_id: values.service_area_id || undefined
      });
    },
    onSuccess: async () => {
      toast.success('Role changed');
      closePanel();
      await invalidateAdmin();
    },
    onError: notifyApiError
  });

  const activateMutation = useMutation({
    mutationFn: (item: User) => userApi.activate(item._id, { notes: 'Activated from Admin workspace' }),
    onSuccess: async () => {
      toast.success('User activated');
      await invalidateAdmin();
    },
    onError: notifyApiError
  });

  const deactivateMutation = useMutation({
    mutationFn: (values: DeactivateFormValues) => {
      if (!selectedUser) throw new Error('Select a user to deactivate.');
      return userApi.deactivate(selectedUser._id, values);
    },
    onSuccess: async () => {
      toast.success('User deactivated');
      closePanel();
      await invalidateAdmin();
    },
    onError: notifyApiError
  });

  const selectBackupForRestore = (item: BackupJob) => {
    const collections = allowedBackupCollections(item);
    setSelectedBackup(item);
    setLastDryRun(undefined);
    setLastRestore(undefined);
    restoreForm.reset({ confirmation: '', collections });
  };

  const maintenanceMutation = useMutation({
    mutationFn: (values: MaintenanceFormValues) => {
      if (!maintenanceAction) throw new Error('Choose whether to enable or disable maintenance mode.');
      return adminApi.updateMaintenance({
        enabled: maintenanceAction === 'enable',
        message: values.message || undefined,
        reason: values.reason
      });
    },
    onSuccess: async (state) => {
      toast.success(state.enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
      setMaintenanceAction(undefined);
      maintenanceForm.reset({ message: state.message || 'System is under maintenance', reason: '' });
      await invalidateMaintenance();
    },
    onError: notifyApiError
  });

  const backupMutation = useMutation({
    mutationFn: (values: BackupFormValues) => {
      if (!maintenanceQuery.data?.enabled) throw new Error('Enable maintenance mode before creating a backup.');
      return adminApi.createBackup({
        backup_name: values.backup_name,
        retention_until: values.retention_until ? new Date(values.retention_until).toISOString() : undefined,
        collections: values.collections,
        metadata: { source: 'admin-operations-ui' }
      });
    },
    onSuccess: async (job) => {
      toast.success(`Backup ${job.backup_id} created`);
      setSelectedBackup(job);
      setLastDryRun(undefined);
      setLastRestore(undefined);
      restoreForm.reset({ confirmation: '', collections: allowedBackupCollections(job) });
      await invalidateBackup();
    },
    onError: notifyApiError
  });

  const restoreDryRunMutation = useMutation({
    mutationFn: (values: RestoreFormValues) => {
      if (!selectedBackup) throw new Error('Select a completed backup first.');
      return adminApi.restore(selectedBackup.backup_id, {
        dryRun: true,
        confirmation: `RESTORE BACKUP ${selectedBackup.backup_id}`,
        collections: values.collections
      });
    },
    onSuccess: (result) => {
      setLastDryRun(result);
      setLastRestore(undefined);
      toast.success('Restore dry-run verified');
    },
    onError: notifyApiError
  });

  const restoreMutation = useMutation({
    mutationFn: (values: RestoreFormValues) => {
      if (!selectedBackup) throw new Error('Select a completed backup first.');
      return adminApi.restore(selectedBackup.backup_id, {
        dryRun: false,
        confirmation: values.confirmation || '',
        collections: values.collections
      });
    },
    onSuccess: async (result) => {
      setLastRestore(result);
      toast.success('Restore completed');
      await invalidateRestore();
    },
    onError: notifyApiError
  });

  const stats = statsQuery.data;
  const users = usersQuery.data?.data ?? [];
  const userPages = usersQuery.data?.pagination?.pages || usersQuery.data?.pagination?.totalPages || 1;
  const auditRows = auditQuery.data?.data ?? [];
  const auditPages = auditQuery.data?.pagination?.pages || auditQuery.data?.pagination?.totalPages || 1;
  const maintenanceState = maintenanceQuery.data;
  const backups = backupsQuery.data?.data ?? [];
  const backupPages = backupsQuery.data?.pagination?.pages || backupsQuery.data?.pagination?.totalPages || 1;

  const auditActions = auditActionsQuery.data?.actions ?? [];
  const auditCategories = auditActionsQuery.data?.categories ?? [];

  const userByRole = Object.entries(stats?.users?.by_role ?? {});
  const transformersByStatus = Object.entries(stats?.transformers?.by_status ?? {});
  const selectedBackupCollections = useMemo(() => allowedBackupCollections(selectedBackup), [selectedBackup]);
  const expectedRestorePhrase = selectedBackup ? `RESTORE BACKUP ${selectedBackup.backup_id}` : '';
  const restoreConfirmation = restoreForm.watch('confirmation') || '';
  const dryRunVerified = lastDryRun?.dryRun === true && lastDryRun.backup_id === selectedBackup?.backup_id && lastDryRun.verified;
  const realRestoreReady = Boolean(
    maintenanceState?.enabled &&
    selectedBackup?.status === 'COMPLETED' &&
    dryRunVerified &&
    restoreConfirmation === expectedRestorePhrase &&
    !restoreMutation.isPending
  );

  const validateAuditFilters = (event: FormEvent) => {
    event.preventDefault();
    if (auditFilters.startDate && auditFilters.endDate && new Date(auditFilters.endDate) < new Date(auditFilters.startDate)) {
      setAuditError('End date must be after the start date.');
      return;
    }
    setAuditError('');
    setAuditPage(1);
    void auditQuery.refetch();
  };

  const targetLabel = (item: AuditLog) => {
    if (item.target_user_id) return userLabel(item.target_user_id);
    if (item.target_transformer_id && typeof item.target_transformer_id === 'object') return getTransformerName(item.target_transformer_id);
    return item.target_record_id || 'Not recorded';
  };

  if (!isSuperAdmin) {
    return (
      <div className="page-stack admin-page">
        <section className="detail-hero admin-hero">
          <div>
            <span className="eyebrow">Admin</span>
            <h1>Admin workspace</h1>
            <p>This workspace is available only to Super Admin users.</p>
          </div>
        </section>
        <ErrorState error={{ response: { status: 403, data: { message: 'You do not have permission to open the Admin workspace.' } } }} title="Admin access required" />
      </div>
    );
  }

  return (
    <div className="page-stack admin-page">
      <section className="detail-hero admin-hero">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Admin workspace</h1>
          <p>Manage Super Admin operational controls, user access, and audit visibility.</p>
        </div>
        <div className="detail-action-row">
          <button className="secondary-button" type="button" onClick={() => {
            if (activeTab === 'overview') void statsQuery.refetch();
            if (activeTab === 'users') void usersQuery.refetch();
            if (activeTab === 'audit') void auditQuery.refetch();
            if (activeTab === 'operations') {
              void maintenanceQuery.refetch();
              void backupsQuery.refetch();
            }
          }}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      <section className="admin-control-strip">
        <ShieldCheck size={18} />
        <strong>Super Admin controls</strong>
        <span>Operations require maintenance windows, dry-runs, audit trails, and typed confirmation.</span>
      </section>

      <div className="report-tabs admin-tabs" role="tablist" aria-label="Admin workspace sections">
        {[
          ['overview', 'Overview'],
          ['users', 'Users'],
          ['audit', 'Audit Logs'],
          ['operations', 'Operations']
        ].map(([value, label]) => (
          <button key={value} className={activeTab === value ? 'report-tab active' : 'report-tab'} type="button" onClick={() => setActiveTab(value as AdminTab)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <section className="page-stack">
          {statsQuery.isLoading ? <Loading label="Loading admin overview" /> : null}
          {statsQuery.error ? <ErrorState error={statsQuery.error} title="Admin overview unavailable" /> : null}
          {stats ? (
            <>
              <div className="registry-summary-grid admin-summary-grid">
                <StatCard label="Total users" value={statNumber(stats.users?.total)} />
                <StatCard label="Active users" value={statNumber(stats.users?.active)} tone="green" />
                <StatCard label="Total transformers" value={statNumber(stats.transformers?.total)} />
                <StatCard label="Open faults" value={statNumber(stats.faults?.open)} tone="risk" />
                <StatCard label="Overdue inspections" value={statNumber(stats.inspections?.overdue)} tone="amber" />
                <StatCard label="Upcoming maintenance" value={statNumber(stats.maintenance?.upcoming)} />
                <StatCard label="Recent audit activity" value={statNumber(stats.audit?.recent_activity_count)} />
                <StatCard label="Generated" value={formatDate(stats.generated_at)} tone="green" />
              </div>

              <div className="admin-overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Users</span>
                      <h2>Users by role</h2>
                    </div>
                  </div>
                  {userByRole.length === 0 ? <EmptyState title="No role counts" message="User role counts will appear after the backend returns grouped stats." /> : (
                    <div className="admin-breakdown-list">
                      {userByRole.map(([role, count]) => (
                        <div key={role}><span className={roleBadge(role)}>{role}</span><strong>{Number(count).toLocaleString()}</strong></div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Assets</span>
                      <h2>Transformers by status</h2>
                    </div>
                  </div>
                  {transformersByStatus.length === 0 ? <EmptyState title="No status counts" message="Transformer status counts will appear here when records exist." /> : (
                    <div className="admin-breakdown-list">
                      {transformersByStatus.map(([status, count]) => (
                        <div key={status}><span className="badge muted-badge">{status}</span><strong>{Number(count).toLocaleString()}</strong></div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'users' ? (
        <section className="page-stack">
          <section className="panel admin-filter-panel">
            <form className="report-filter-grid admin-filter-grid" onSubmit={(event) => { event.preventDefault(); setUserPage(1); void usersQuery.refetch(); }}>
              <label>
                <span>Search users</span>
                <div className="input-shell"><Search size={16} /><input value={userFilters.search} onChange={(event) => setUserFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Name or email" /></div>
              </label>
              <label>
                <span>Role</span>
                <select value={userFilters.role} onChange={(event) => setUserFilters((current) => ({ ...current, role: event.target.value }))}>
                  <option value="">Any role</option>
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={userFilters.is_active} onChange={(event) => setUserFilters((current) => ({ ...current, is_active: event.target.value }))}>
                  <option value="">Any status</option>
                  <option value="true">Active</option>
                  <option value="false">Deactivated</option>
                </select>
              </label>
              <label>
                <span>Territory</span>
                <select value={userFilters.territory_id} onChange={(event) => setUserFilters((current) => ({ ...current, territory_id: event.target.value }))}>
                  <option value="">Any territory</option>
                  {territories.map((item) => <option key={item._id} value={item._id}>{optionLabel(item)}</option>)}
                </select>
              </label>
              <label>
                <span>Service area</span>
                <select value={userFilters.service_area_id} onChange={(event) => setUserFilters((current) => ({ ...current, service_area_id: event.target.value }))}>
                  <option value="">Any service area</option>
                  {serviceAreas.map((item) => <option key={item._id} value={item._id}>{optionLabel(item)}</option>)}
                </select>
              </label>
              <div className="report-filter-actions">
                <button className="primary-button" type="submit">Apply filters</button>
                <button className="secondary-button" type="button" onClick={() => { setUserFilters({ search: '', role: '', is_active: '', territory_id: '', service_area_id: '' }); setUserPage(1); }}>
                  Clear
                </button>
                <button className="primary-button" type="button" onClick={() => openPanel('create')}>
                  <UserPlus size={16} />
                  <span>Create user</span>
                </button>
              </div>
            </form>
          </section>

          {usersQuery.isLoading ? <Loading label="Loading users" /> : null}
          {usersQuery.error ? <ErrorState error={usersQuery.error} title="Users unavailable" /> : null}
          {!usersQuery.isLoading && !usersQuery.error ? (
            <section className="panel">
              <DataTable
                columns={['Name', 'Email', 'Role', 'Territory', 'Service Area', 'Status', 'Last login', 'Actions']}
                rows={users}
                emptyTitle="No users found"
                emptyMessage="Adjust filters or create a new user."
                renderRow={(item) => (
                  <tr key={item._id}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.email}</td>
                    <td><span className={roleBadge(item.role)}>{item.role}</span></td>
                    <td>{refLabel(item.territory_id)}</td>
                    <td>{refLabel(item.service_area_id)}</td>
                    <td>{statusBadge(item)}</td>
                    <td>{formatDate(item.last_login)}</td>
                    <td>
                      <div className="table-action-group">
                        <button className="table-action" type="button" onClick={() => openPanel('edit', item)}>Edit</button>
                        <button className="table-action warning-button" type="button" onClick={() => openPanel('role', item)}>Role</button>
                        {item.is_active === false ? (
                          <button className="table-action" type="button" onClick={() => activateMutation.mutate(item)} disabled={activateMutation.isPending}>Activate</button>
                        ) : (
                          <button className="table-action danger-button" type="button" onClick={() => openPanel('deactivate', item)}>Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              />
              <PaginationControls page={userPage} pages={userPages} onPage={setUserPage} />
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'audit' ? (
        <section className="page-stack">
          <section className="panel admin-filter-panel">
            <form className="report-filter-grid admin-filter-grid" onSubmit={validateAuditFilters}>
              <label>
                <span>Category</span>
                <select value={auditFilters.action_category} onChange={(event) => setAuditFilters((current) => ({ ...current, action_category: event.target.value }))}>
                  <option value="">Any category</option>
                  {auditCategories.map((category) => <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label>
                <span>Action</span>
                <select value={auditFilters.action} onChange={(event) => setAuditFilters((current) => ({ ...current, action: event.target.value }))}>
                  <option value="">Any action</option>
                  {auditActions.map((action) => <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label>
                <span>User ID</span>
                <input value={auditFilters.user_id} onChange={(event) => setAuditFilters((current) => ({ ...current, user_id: event.target.value }))} placeholder="MongoDB user id" />
              </label>
              <label>
                <span>Target type</span>
                <select value={auditFilters.target_type} onChange={(event) => setAuditFilters((current) => ({ ...current, target_type: event.target.value }))}>
                  <option value="">Any target</option>
                  {targetTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label>
                <span>Target ID</span>
                <input value={auditFilters.target_id} onChange={(event) => setAuditFilters((current) => ({ ...current, target_id: event.target.value }))} placeholder="Target record id" />
              </label>
              <label>
                <span>Start date</span>
                <input type="date" value={auditFilters.startDate} onChange={(event) => setAuditFilters((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label>
                <span>End date</span>
                <input type="date" value={auditFilters.endDate} onChange={(event) => setAuditFilters((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
              <label>
                <span>Sensitive</span>
                <select value={auditFilters.is_sensitive} onChange={(event) => setAuditFilters((current) => ({ ...current, is_sensitive: event.target.value }))}>
                  <option value="">Any</option>
                  <option value="true">Sensitive only</option>
                  <option value="false">Non-sensitive</option>
                </select>
              </label>
              <div className="report-filter-actions">
                <button className="primary-button" type="submit">Apply filters</button>
                <button className="secondary-button" type="button" onClick={() => { setAuditFilters({ action: '', action_category: '', user_id: '', target_type: '', target_id: '', startDate: '', endDate: '', is_sensitive: '' }); setAuditError(''); setAuditPage(1); }}>
                  Clear
                </button>
              </div>
            </form>
            {auditError ? <div className="inline-error"><AlertTriangle size={15} />{auditError}</div> : null}
          </section>

          {auditQuery.isLoading ? <Loading label="Loading audit logs" /> : null}
          {auditQuery.error ? <ErrorState error={auditQuery.error} title="Audit logs unavailable" /> : null}
          {!auditQuery.isLoading && !auditQuery.error ? (
            <section className="panel audit-ledger-panel">
              <DataTable
                columns={['Date', 'User', 'Action', 'Category', 'Target type', 'Target', 'Summary', 'Sensitive']}
                rows={auditRows}
                emptyTitle="No audit logs found"
                emptyMessage="Adjust filters or wait for new administrative activity."
                renderRow={(item) => (
                  <tr key={item._id}>
                    <td>{formatDate(item.created_at)}</td>
                    <td>{userLabel(item.user_id)}</td>
                    <td><strong>{(item.action || 'Action').replace(/_/g, ' ')}</strong></td>
                    <td><span className={categoryBadge(item.action_category)}>{(item.action_category || 'Uncategorized').replace(/_/g, ' ')}</span></td>
                    <td>{item.target_record_type || 'Not recorded'}</td>
                    <td>{targetLabel(item)}</td>
                    <td>{item.details || 'No summary recorded.'}</td>
                    <td>{item.is_sensitive ? <span className="badge danger">Sensitive</span> : <span className="badge green">Standard</span>}</td>
                  </tr>
                )}
              />
              <PaginationControls page={auditPage} pages={auditPages} onPage={setAuditPage} />
            </section>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'operations' ? (
        <section className="page-stack admin-operations">
          <div className="registry-summary-grid admin-summary-grid">
            <StatCard
              label="Maintenance mode"
              value={maintenanceState?.enabled ? 'Enabled' : 'Disabled'}
              tone={maintenanceState?.enabled ? 'amber' : 'green'}
            />
            <StatCard label="Backups listed" value={statNumber(backupsQuery.data?.pagination?.total ?? backups.length)} />
            <StatCard label="Selected backup" value={selectedBackup?.backup_id || 'None'} />
            <StatCard label="Restore dry-run" value={dryRunVerified ? 'Verified' : 'Required'} tone={dryRunVerified ? 'green' : 'amber'} />
          </div>

          <section className="panel operations-panel maintenance-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Operations</span>
                <h2>Maintenance Mode</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => void maintenanceQuery.refetch()}>
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
            </div>
            {maintenanceQuery.isLoading ? <Loading label="Loading maintenance status" /> : null}
            {maintenanceQuery.error ? <ErrorState error={maintenanceQuery.error} title="Maintenance status unavailable" /> : null}
            {maintenanceState ? (
              <>
                <div className="operations-status-grid">
                  <div>
                    <span>Status</span>
                    <strong className={maintenanceState.enabled ? 'text-amber' : 'text-green'}>{maintenanceState.enabled ? 'Enabled' : 'Disabled'}</strong>
                  </div>
                  <div><span>Message</span><strong>{maintenanceState.message || 'Not set'}</strong></div>
                  <div><span>Reason</span><strong>{maintenanceState.reason || 'Not recorded'}</strong></div>
                  <div><span>Enabled by</span><strong>{maintenanceUser(maintenanceState.enabled_by)}</strong></div>
                  <div><span>Enabled at</span><strong>{formatDate(maintenanceState.enabled_at || undefined)}</strong></div>
                  <div><span>Disabled by</span><strong>{maintenanceUser(maintenanceState.disabled_by)}</strong></div>
                  <div><span>Disabled at</span><strong>{formatDate(maintenanceState.disabled_at || undefined)}</strong></div>
                  <div><span>Updated at</span><strong>{formatDate(maintenanceState.updated_at || undefined)}</strong></div>
                </div>
                <div className="operation-action-row">
                  <button
                    className="primary-button warning-button"
                    type="button"
                    disabled={maintenanceState.enabled}
                    onClick={() => {
                      setMaintenanceAction('enable');
                      maintenanceForm.reset({ message: maintenanceState.message || 'System is under maintenance', reason: '' });
                    }}
                  >
                    <Power size={16} />
                    <span>Enable maintenance mode</span>
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!maintenanceState.enabled}
                    onClick={() => {
                      setMaintenanceAction('disable');
                      maintenanceForm.reset({ message: maintenanceState.message || 'System is under maintenance', reason: '' });
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Disable maintenance mode</span>
                  </button>
                </div>
              </>
            ) : null}
            {maintenanceAction ? (
              <form className="operation-confirmation-form" onSubmit={maintenanceForm.handleSubmit((values) => maintenanceMutation.mutate(values))}>
                <div>
                  <h3>{maintenanceAction === 'enable' ? 'Enable maintenance mode?' : 'Disable maintenance mode?'}</h3>
                  <p>{maintenanceAction === 'enable' ? 'Write requests from normal users will be blocked while maintenance is active.' : 'Normal application writes will resume after maintenance mode is disabled.'}</p>
                </div>
                <label>
                  <span>Maintenance message</span>
                  <input {...maintenanceForm.register('message')} placeholder="System is under maintenance" />
                  <FieldError message={maintenanceForm.formState.errors.message?.message} />
                </label>
                <label>
                  <span>Reason</span>
                  <textarea {...maintenanceForm.register('reason')} placeholder="Why is maintenance mode changing?" />
                  <FieldError message={maintenanceForm.formState.errors.reason?.message} />
                </label>
                <div className="confirmation-actions">
                  <button className="secondary-button" type="button" onClick={() => setMaintenanceAction(undefined)}>Cancel</button>
                  <button className={maintenanceAction === 'enable' ? 'primary-button warning-button' : 'primary-button'} type="submit" disabled={maintenanceMutation.isPending}>
                    {maintenanceMutation.isPending ? 'Saving...' : maintenanceAction === 'enable' ? 'Confirm enable' : 'Confirm disable'}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="operations-grid">
            <section className="panel operations-panel backup-create-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Backup</span>
                  <h2>Create Backup</h2>
                </div>
                <DatabaseBackup size={22} />
              </div>
              {!maintenanceState?.enabled ? (
                <div className="inline-error warning-inline"><AlertTriangle size={15} />Enable maintenance mode before creating a backup.</div>
              ) : null}
              <form className="transformer-form operations-form" onSubmit={backupForm.handleSubmit((values) => backupMutation.mutate(values))}>
                <label>
                  <span>Backup name</span>
                  <input {...backupForm.register('backup_name')} placeholder="nightly_backup" />
                  <FieldError message={backupForm.formState.errors.backup_name?.message} />
                </label>
                <label>
                  <span>Retention date</span>
                  <input type="datetime-local" {...backupForm.register('retention_until')} />
                  <FieldError message={backupForm.formState.errors.retention_until?.message} />
                </label>
                <div className="operation-checkbox-group">
                  <span>Collections</span>
                  {restoreCollections.map((collection) => (
                    <label key={collection} className="checkbox-field admin-checkbox-field">
                      <input type="checkbox" value={collection} {...backupForm.register('collections')} />
                      <span>{collectionLabel(collection)}</span>
                    </label>
                  ))}
                  <FieldError message={backupForm.formState.errors.collections?.message} />
                </div>
                <div className="form-footer">
                  <button className="primary-button" type="submit" disabled={!maintenanceState?.enabled || backupMutation.isPending}>
                    {backupMutation.isPending ? 'Creating backup...' : 'Create backup'}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel operations-panel restore-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Restore</span>
                  <h2>Dry Run & Execution</h2>
                </div>
                <RotateCcw size={22} />
              </div>
              {!selectedBackup ? (
                <EmptyState title="Select a backup" message="Choose a completed backup from history before running restore validation." />
              ) : (
                <form className="transformer-form operations-form" onSubmit={restoreForm.handleSubmit((values) => {
                  if (!realRestoreReady) {
                    restoreForm.setError('confirmation', { message: `Type ${expectedRestorePhrase} after a successful dry-run.` });
                    return;
                  }
                  restoreMutation.mutate(values);
                })}>
                  <div className="restore-selected-backup">
                    <span>Selected backup</span>
                    <strong>{selectedBackup.backup_id}</strong>
                    <small>{selectedBackup.filename || 'No filename recorded'} · {formatDate(selectedBackup.completed_at)}</small>
                  </div>
                  <div className="operation-checkbox-group">
                    <span>Restore collections</span>
                    {selectedBackupCollections.map((collection) => (
                      <label key={collection} className="checkbox-field admin-checkbox-field">
                        <input type="checkbox" value={collection} {...restoreForm.register('collections')} />
                        <span>{collectionLabel(collection)}</span>
                      </label>
                    ))}
                    <FieldError message={restoreForm.formState.errors.collections?.message} />
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={selectedBackup.status !== 'COMPLETED' || restoreDryRunMutation.isPending}
                    onClick={() => void restoreForm.handleSubmit((values) => restoreDryRunMutation.mutate(values))()}
                  >
                    <PlayCircle size={16} />
                    <span>{restoreDryRunMutation.isPending ? 'Running dry-run...' : 'Run dry-run'}</span>
                  </button>

                  {lastDryRun?.dryRun === true && lastDryRun.backup_id === selectedBackup.backup_id ? (
                    <div className="restore-result-card">
                      <div><span>Verified</span><strong>{lastDryRun.verified ? 'Yes' : 'No'}</strong></div>
                      <div><span>Collections</span><strong>{lastDryRun.collections.map(collectionLabel).join(', ')}</strong></div>
                      <div><span>Documents planned</span><strong>{statNumber(lastDryRun.plan?.total_documents)}</strong></div>
                      {lastDryRun.warnings?.length ? (
                        <div className="restore-warning-list">
                          <span>Warnings</span>
                          {lastDryRun.warnings.map((warning) => <small key={warning}>{warning}</small>)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="form-alert danger-alert">
                    Restore replaces selected collections from the backup. A pre-restore backup will be created automatically.
                  </div>
                  <label>
                    <span>Typed confirmation</span>
                    <input {...restoreForm.register('confirmation')} placeholder={expectedRestorePhrase || 'RESTORE BACKUP <backupId>'} />
                    <FieldError message={restoreForm.formState.errors.confirmation?.message} />
                  </label>
                  <button className="primary-button danger-button" type="submit" disabled={!realRestoreReady}>
                    {restoreMutation.isPending ? 'Restoring...' : 'Execute restore'}
                  </button>

                  {lastRestore?.dryRun === false ? (
                    <div className="restore-result-card restore-complete-card">
                      <div><span>Pre-restore backup</span><strong>{lastRestore.pre_restore_backup_id}</strong></div>
                      <div><span>Restored collections</span><strong>{lastRestore.restored_collections.map(collectionLabel).join(', ')}</strong></div>
                      <div><span>Completed</span><strong>{formatDate(lastRestore.completed_at)}</strong></div>
                      <div><span>Restored counts</span><strong>{Object.entries(lastRestore.restored_counts).map(([name, count]) => `${collectionLabel(name)}: ${count}`).join(', ')}</strong></div>
                    </div>
                  ) : null}
                </form>
              )}
            </section>
          </section>

          <section className="panel operations-panel backup-history-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Backup</span>
                <h2>Backup History</h2>
              </div>
              <div className="detail-action-row">
                <select value={backupFilters.status} onChange={(event) => { setBackupFilters({ status: event.target.value as BackupStatus | '' }); setBackupPage(1); }}>
                  <option value="">Any status</option>
                  {backupStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button className="secondary-button" type="button" onClick={() => void backupsQuery.refetch()}>
                  <RefreshCw size={16} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
            {backupsQuery.isLoading ? <Loading label="Loading backup history" /> : null}
            {backupsQuery.error ? <ErrorState error={backupsQuery.error} title="Backup history unavailable" /> : null}
            {!backupsQuery.isLoading && !backupsQuery.error ? (
              <>
                <DataTable
                  columns={['Backup ID', 'Status', 'Operation type', 'Filename', 'Size', 'Checksum', 'Compression', 'Encryption', 'Created by', 'Started at', 'Completed at', 'Retention until', 'Actions']}
                  rows={backups}
                  emptyTitle="No backups found"
                  emptyMessage="Create a backup during maintenance mode to populate history."
                  renderRow={(item) => (
                    <tr key={item.backup_id} className={selectedBackup?.backup_id === item.backup_id ? 'selected-row' : undefined}>
                      <td><strong>{item.backup_id}</strong></td>
                      <td><span className={backupStatusBadge(item.status)}>{item.status || 'UNKNOWN'}</span></td>
                      <td>{item.operation_type || 'BACKUP'}</td>
                      <td>{item.filename || 'Not recorded'}</td>
                      <td>{bytesLabel(item.size_bytes)}</td>
                      <td>{shortHash(item.checksum)}</td>
                      <td>{item.compression || 'Not recorded'}</td>
                      <td>{item.encryption ? 'Enabled' : 'Disabled'}</td>
                      <td>{backupCreator(item.created_by)}</td>
                      <td>{formatDate(item.started_at)}</td>
                      <td>{formatDate(item.completed_at)}</td>
                      <td>{formatDate(item.retention_until)}</td>
                      <td>
                        <div className="table-action-group">
                          <button className="table-action" type="button" disabled={item.status !== 'COMPLETED'} onClick={() => selectBackupForRestore(item)}>Dry-run restore</button>
                          <button className="table-action danger-button" type="button" disabled={item.status !== 'COMPLETED'} onClick={() => selectBackupForRestore(item)}>Restore</button>
                        </div>
                      </td>
                    </tr>
                  )}
                />
                <PaginationControls page={backupPage} pages={backupPages} onPage={setBackupPage} />
              </>
            ) : null}
          </section>
        </section>
      ) : null}

      {userPanel === 'create' ? (
        <section className="panel admin-form-panel">
          <div className="panel-heading"><div><span className="eyebrow">Users</span><h2>Create user</h2></div></div>
          <form className="transformer-form admin-user-form" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
            <UserFields form={createForm} territories={territories} serviceAreas={serviceAreas} mode="create" />
            <div className="form-footer">
              <button className="secondary-button" type="button" onClick={closePanel}>Cancel</button>
              <button className="primary-button" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create user'}</button>
            </div>
          </form>
        </section>
      ) : null}

      {userPanel === 'edit' && selectedUser ? (
        <section className="panel admin-form-panel">
          <div className="panel-heading"><div><span className="eyebrow">Users</span><h2>Edit {selectedUser.name}</h2></div></div>
          <form className="transformer-form admin-user-form" onSubmit={editForm.handleSubmit((values) => editMutation.mutate(values))}>
            <UserFields form={editForm} territories={territories} serviceAreas={serviceAreas} mode="edit" />
            <div className="form-alert">Password, role, and activation status are managed through separate protected actions.</div>
            <div className="form-footer">
              <button className="secondary-button" type="button" onClick={closePanel}>Cancel</button>
              <button className="primary-button" type="submit" disabled={editMutation.isPending}>{editMutation.isPending ? 'Saving...' : 'Save changes'}</button>
            </div>
          </form>
        </section>
      ) : null}

      {userPanel === 'role' && selectedUser ? (
        <section className="panel confirmation-panel">
          <div>
            <h2>Change role for {selectedUser.name}</h2>
            <p>Role changes affect what this user can access. Confirm the new scope before saving.</p>
          </div>
          <form className="admin-inline-form" onSubmit={roleForm.handleSubmit((values) => roleMutation.mutate(values))}>
            <label><span>Role</span><select {...roleForm.register('role')}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select><FieldError message={roleForm.formState.errors.role?.message} /></label>
            <label><span>Territory</span><select {...roleForm.register('territory_id')}><option value="">No territory</option>{territories.map((item) => <option key={item._id} value={item._id}>{optionLabel(item)}</option>)}</select><FieldError message={roleForm.formState.errors.territory_id?.message} /></label>
            <label><span>Service area</span><select {...roleForm.register('service_area_id')}><option value="">No service area</option>{serviceAreas.map((item) => <option key={item._id} value={item._id}>{optionLabel(item)}</option>)}</select><FieldError message={roleForm.formState.errors.service_area_id?.message} /></label>
            <div className="confirmation-actions">
              <button className="secondary-button" type="button" onClick={closePanel}>Cancel</button>
              <button className="primary-button warning-button" type="submit" disabled={roleMutation.isPending}>{roleMutation.isPending ? 'Saving...' : 'Change role'}</button>
            </div>
          </form>
        </section>
      ) : null}

      {userPanel === 'deactivate' && selectedUser ? (
        <section className="panel confirmation-panel danger-confirmation">
          <div>
            <h2>Deactivate {selectedUser.name}?</h2>
            <p>This blocks sign-in without deleting the user record. A reason is required for audit history.</p>
          </div>
          <form className="admin-inline-form" onSubmit={deactivateForm.handleSubmit((values) => deactivateMutation.mutate(values))}>
            <label><span>Reason</span><textarea {...deactivateForm.register('reason')} placeholder="Why is this user being deactivated?" /><FieldError message={deactivateForm.formState.errors.reason?.message} /></label>
            <div className="confirmation-actions">
              <button className="secondary-button" type="button" onClick={closePanel}>Cancel</button>
              <button className="primary-button danger-button" type="submit" disabled={deactivateMutation.isPending}>{deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate user'}</button>
            </div>
          </form>
        </section>
      ) : null}

      {(createMutation.error || editMutation.error || roleMutation.error || deactivateMutation.error || activateMutation.error || maintenanceMutation.error || backupMutation.error || restoreDryRunMutation.error || restoreMutation.error) ? (
        <div className="form-error">{getApiErrorMessage(createMutation.error || editMutation.error || roleMutation.error || deactivateMutation.error || activateMutation.error || maintenanceMutation.error || backupMutation.error || restoreDryRunMutation.error || restoreMutation.error)}</div>
      ) : null}
    </div>
  );
}

function UserFields({ form, territories, serviceAreas, mode }: { form: ReturnType<typeof useForm<UserFormValues>>; territories: ReferenceItem[]; serviceAreas: ReferenceItem[]; mode: 'create' | 'edit' }) {
  const { register, formState } = form;
  return (
    <div className="form-grid">
      <label>
        <span>Name</span>
        <input {...register('name')} />
        <FieldError message={formState.errors.name?.message} />
      </label>
      <label>
        <span>Email</span>
        <input type="email" {...register('email')} />
        <FieldError message={formState.errors.email?.message} />
      </label>
      <label>
        <span>Role</span>
        <select {...register('role')} disabled={mode === 'edit'}>
          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <FieldError message={formState.errors.role?.message} />
      </label>
      <label>
        <span>Territory</span>
        <select {...register('territory_id')}>
          <option value="">No territory</option>
          {territories.map((item) => <option key={item._id} value={item._id}>{optionLabel(item)}</option>)}
        </select>
        <FieldError message={formState.errors.territory_id?.message} />
      </label>
      <label>
        <span>Service area</span>
        <select {...register('service_area_id')}>
          <option value="">No service area</option>
          {serviceAreas.map((item) => <option key={item._id} value={item._id}>{optionLabel(item)}</option>)}
        </select>
        <FieldError message={formState.errors.service_area_id?.message} />
      </label>
      {mode === 'create' ? (
        <>
          <label>
            <span>Password</span>
            <input type="password" {...register('password')} />
            <FieldError message={formState.errors.password?.message} />
          </label>
          <label>
            <span>Confirm password</span>
            <input type="password" {...register('confirmPassword')} />
            <FieldError message={formState.errors.confirmPassword?.message} />
          </label>
          <label className="checkbox-field admin-checkbox-field">
            <input type="checkbox" {...register('is_active')} />
            <span>Active on creation</span>
          </label>
        </>
      ) : null}
    </div>
  );
}
