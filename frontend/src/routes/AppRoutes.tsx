import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { FaultsPage } from '../pages/faults/FaultsPage';
import { InspectionsPage } from '../pages/inspections/InspectionsPage';
import { MaintenancePage } from '../pages/maintenance/MaintenancePage';
import { ReferenceDataPage } from '../pages/reference-data/ReferenceDataPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { TransformerDetailPage } from '../pages/transformers/TransformerDetailPage';
import { TransformersPage } from '../pages/transformers/TransformersPage';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transformers" element={<TransformersPage />} />
          <Route path="/transformers/:id" element={<TransformerDetailPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/faults" element={<FaultsPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/reference-data" element={<ReferenceDataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
