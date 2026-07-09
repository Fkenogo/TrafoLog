import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AdminPage } from '../pages/admin/AdminPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { FaultDetailPage } from '../pages/faults/FaultDetailPage';
import { FaultFormPage } from '../pages/faults/FaultFormPage';
import { FaultsPage } from '../pages/faults/FaultsPage';
import { InspectionDetailPage } from '../pages/inspections/InspectionDetailPage';
import { InspectionFormPage } from '../pages/inspections/InspectionFormPage';
import { InspectionsPage } from '../pages/inspections/InspectionsPage';
import { AssetMapPage } from '../pages/map/AssetMapPage';
import { MaintenancePage } from '../pages/maintenance/MaintenancePage';
import { ReferenceDataPage } from '../pages/reference-data/ReferenceDataPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { TransformerDetailPage } from '../pages/transformers/TransformerDetailPage';
import { TransformerFormPage } from '../pages/transformers/TransformerFormPage';
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
          <Route path="/transformers/new" element={<TransformerFormPage mode="create" />} />
          <Route path="/transformers/:id/edit" element={<TransformerFormPage mode="edit" />} />
          <Route path="/transformers/:id" element={<TransformerDetailPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/inspections/new" element={<InspectionFormPage mode="create" />} />
          <Route path="/inspections/:id/edit" element={<InspectionFormPage mode="edit" />} />
          <Route path="/inspections/:id" element={<InspectionDetailPage />} />
          <Route path="/faults" element={<FaultsPage />} />
          <Route path="/faults/new" element={<FaultFormPage mode="create" />} />
          <Route path="/faults/:id/edit" element={<FaultFormPage mode="edit" />} />
          <Route path="/faults/:id" element={<FaultDetailPage />} />
          <Route path="/map" element={<AssetMapPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reference-data" element={<ReferenceDataPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
