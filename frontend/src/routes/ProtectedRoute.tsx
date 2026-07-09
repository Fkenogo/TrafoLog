import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loading label="Restoring secure session" variant="auth" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
