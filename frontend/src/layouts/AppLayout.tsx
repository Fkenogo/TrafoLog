import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CircuitBoard, ClipboardCheck, FileText, Gauge, Home, LogOut, MapPinned, Menu, RefreshCw, Settings, ShieldAlert, ShieldCheck, Trash2, UserCircle, Wrench, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { notifyApiError } from '../api/http';
import { notificationApi } from '../api/notificationApi';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { Notification } from '../types/api';
import { formatDate } from '../utils/format';
import { toast } from 'sonner';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home },
  { label: 'Transformers', to: '/transformers', icon: CircuitBoard },
  { label: 'Inspections', to: '/inspections', icon: ClipboardCheck },
  { label: 'Faults', to: '/faults', icon: ShieldAlert },
  { label: 'Asset Map', to: '/map', icon: MapPinned },
  { label: 'Maintenance', to: '/maintenance', icon: Wrench },
  { label: 'Reports', to: '/reports', icon: FileText },
  { label: 'Reference Data', to: '/reference-data', icon: Gauge },
  { label: 'Admin', to: '/admin', icon: ShieldCheck, superAdminOnly: true },
  { label: 'Settings', to: '/settings', icon: Settings }
];

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  transformers: 'Transformers',
  inspections: 'Inspections',
  faults: 'Faults',
  map: 'Asset Location Map',
  maintenance: 'Maintenance',
  reports: 'Reports',
  'reference-data': 'Reference Data',
  admin: 'Admin',
  settings: 'Settings'
};

const notificationTypeLabels: Record<string, string> = {
  FAULT_ALERT: 'Fault alert',
  FAULT_ASSIGNED: 'Fault assigned',
  FAULT_RESOLVED: 'Fault resolved',
  FAULT_ESCALATED: 'Fault escalated',
  FAULT_REOPENED: 'Fault reopened',
  INSPECTION_ALERT: 'Inspection alert',
  OVERLOAD_ALERT: 'Overload alert',
  OVERDUE_INSPECTION: 'Overdue inspection',
  MAINTENANCE_ALERT: 'Maintenance alert',
  MAINTENANCE_SCHEDULED: 'Maintenance scheduled',
  SYSTEM_ALERT: 'System alert',
  USER_ACTION_REQUIRED: 'Action required',
  TRANSFORMER_VERIFIED: 'Transformer verified',
  TRANSFORMER_DECOMMISSIONED: 'Transformer decommissioned',
  IMPORT_COMPLETED: 'Import completed',
  REPORT_READY: 'Report ready'
};

function readableNotificationType(type?: string) {
  if (!type) return 'Notification';
  return notificationTypeLabels[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function priorityBadgeClass(priority?: string) {
  if (priority === 'critical') return 'badge danger';
  if (priority === 'high') return 'badge amber';
  if (priority === 'low') return 'badge muted-badge';
  return 'badge';
}

function relatedRecordLabel(notification: Notification) {
  const linkedType = notification.linked_record_type;
  const linkedId = typeof notification.linked_record_id === 'string'
    ? notification.linked_record_id
    : notification.linked_record_id && typeof notification.linked_record_id === 'object' && '_id' in notification.linked_record_id
      ? String(notification.linked_record_id._id)
      : '';
  const data = notification.data ?? {};
  const dataId = ['fault_id', 'transformer_id', 'inspection_id', 'maintenance_id', 'report_id']
    .map((key) => data[key])
    .find((value) => typeof value === 'string');
  const id = linkedId || (typeof dataId === 'string' ? dataId : '');
  if (linkedType && id) return `${linkedType}: ${id}`;
  if (linkedType) return linkedType;
  if (id) return `Linked record: ${id}`;
  return 'No linked record';
}

function NotificationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.list({ limit: 20 }),
    enabled: isOpen,
    retry: 1
  });
  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationApi.unreadCount,
    retry: 1
  });

  useEffect(() => {
    if (isOpen) {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    }
  }, [isOpen, queryClient]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const invalidateNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    ]);
  };

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: async () => {
      toast.success('Notification marked as read');
      await invalidateNotifications();
    },
    onError: notifyApiError
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: async () => {
      toast.success('All notifications marked as read');
      await invalidateNotifications();
    },
    onError: notifyApiError
  });

  const deleteMutation = useMutation({
    mutationFn: notificationApi.delete,
    onSuccess: async () => {
      toast.success('Notification deleted');
      await invalidateNotifications();
    },
    onError: notifyApiError
  });

  const notifications = listQuery.data?.data ?? [];
  const rows = useMemo(
    () => notifications.filter((item) => !showUnreadOnly || !item.is_read),
    [notifications, showUnreadOnly]
  );
  const unreadCount = unreadCountQuery.data?.count ?? notifications.filter((item) => !item.is_read).length;

  if (!isOpen) return null;

  return (
    <div className="notification-panel" role="dialog" aria-label="Notifications">
      <div className="notification-panel-header">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Operations alerts</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close notifications"><X size={16} /></button>
      </div>

      <div className="notification-summary">
        <strong>{unreadCount.toLocaleString()}</strong>
        <span>Unread notifications</span>
      </div>

      <div className="notification-toolbar">
        <button className={showUnreadOnly ? 'secondary-button active' : 'secondary-button'} type="button" onClick={() => setShowUnreadOnly((current) => !current)}>
          {showUnreadOnly ? 'Showing unread' : 'Show unread'}
        </button>
        <button className="secondary-button" type="button" onClick={() => void listQuery.refetch()} disabled={listQuery.isFetching}>
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
        <button className="secondary-button" type="button" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending || unreadCount === 0}>
          <CheckCheck size={15} />
          <span>Mark all read</span>
        </button>
      </div>

      {listQuery.isLoading ? <Loading label="Loading notifications" /> : null}
      {listQuery.error ? <ErrorState error={listQuery.error} title="Notifications unavailable" /> : null}
      {!listQuery.isLoading && !listQuery.error ? (
        rows.length === 0 ? (
          <EmptyState
            title={showUnreadOnly ? 'No unread notifications' : 'No notifications'}
            message={showUnreadOnly ? 'Everything in your notification queue has been read.' : 'Operational alerts assigned to you will appear here.'}
          />
        ) : (
          <div className="notification-list">
            {rows.map((item) => (
              <article className={item.is_read ? 'notification-card' : 'notification-card unread'} key={item._id}>
                <div className="notification-card-main">
                  <div className="notification-card-title">
                    <strong>{item.title || readableNotificationType(item.type)}</strong>
                    <span className={item.is_read ? 'badge muted-badge' : 'badge green'}>{item.is_read ? 'Read' : 'Unread'}</span>
                  </div>
                  <p>{item.message || 'No message was recorded.'}</p>
                  <div className="notification-meta">
                    <span className="badge">{readableNotificationType(item.type)}</span>
                    <span className={priorityBadgeClass(item.priority)}>{item.priority || 'normal'}</span>
                    <span>{formatDate(item.created_at)}</span>
                    <span>{relatedRecordLabel(item)}</span>
                  </div>
                </div>
                <div className="notification-actions">
                  <button className="icon-button" type="button" onClick={() => markReadMutation.mutate(item._id)} disabled={item.is_read || markReadMutation.isPending} aria-label="Mark notification as read">
                    <CheckCheck size={15} />
                  </button>
                  <button className="icon-button danger-icon" type="button" onClick={() => deleteMutation.mutate(item._id)} disabled={deleteMutation.isPending} aria-label="Delete notification">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const unreadCountQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationApi.unreadCount,
    retry: 1
  });
  const location = useLocation();
  const currentSegment = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const title = pageTitles[currentSegment] ?? 'Workspace';
  const displayName = user?.name || user?.email || 'Signed-in user';
  const roleLabel = user?.role || 'Profile unavailable';
  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  const unreadCount = unreadCountQuery.data?.count ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">kV</div>
          <div>
            <strong>kVAssetTracker</strong>
            <span>Utility Operations</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.filter((item) => !item.superAdminOnly || user?.role === 'Super Admin').map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-only" aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div>
              <div className="breadcrumb">Operations / {title}</div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="notification-shell">
              <button
                className="icon-button"
                aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                aria-expanded={isNotificationPanelOpen}
                onClick={() => setIsNotificationPanelOpen((current) => !current)}
                type="button"
              >
                <Bell size={18} />
                {unreadCount > 0 ? <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span> : unreadCountQuery.error ? <span className="notification-dot muted-dot" /> : null}
              </button>
              <NotificationPanel isOpen={isNotificationPanelOpen} onClose={() => setIsNotificationPanelOpen(false)} />
            </div>
            <button className="profile-menu" onClick={() => void handleLogout()} disabled={isLoggingOut} aria-label="Sign out">
              <span className="avatar">
                {initials || <UserCircle size={18} aria-hidden="true" />}
              </span>
              <span>
                <strong>{displayName}</strong>
                <small>{isLoggingOut ? 'Signing out' : roleLabel}</small>
              </span>
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
