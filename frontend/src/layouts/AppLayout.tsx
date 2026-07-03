import { Bell, ChevronDown, CircuitBoard, ClipboardCheck, Gauge, Home, Menu, Settings, ShieldAlert, Wrench } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home },
  { label: 'Transformers', to: '/transformers', icon: CircuitBoard },
  { label: 'Inspections', to: '/inspections', icon: ClipboardCheck },
  { label: 'Faults', to: '/faults', icon: ShieldAlert },
  { label: 'Maintenance', to: '/maintenance', icon: Wrench },
  { label: 'Reference Data', to: '/reference-data', icon: Gauge },
  { label: 'Settings', to: '/settings', icon: Settings }
];

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  transformers: 'Transformers',
  inspections: 'Inspections',
  faults: 'Faults',
  maintenance: 'Maintenance',
  'reference-data': 'Reference Data',
  settings: 'Settings'
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentSegment = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const title = pageTitles[currentSegment] ?? 'Workspace';

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
          {navItems.map((item) => (
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
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="profile-menu" onClick={() => void logout()}>
              <span className="avatar">{user?.name?.slice(0, 2).toUpperCase() || 'KV'}</span>
              <span>
                <strong>{user?.name || 'Operator'}</strong>
                <small>{user?.role || 'Viewer'}</small>
              </span>
              <ChevronDown size={16} />
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
