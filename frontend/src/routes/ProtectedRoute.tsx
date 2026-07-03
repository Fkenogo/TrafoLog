import { Navigate, Outlet } from 'react-router-dom';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loading label="Checking session" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
