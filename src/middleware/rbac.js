// Role-based access control middleware
const { errorResponse } = require('../utils/helpers');

// Permission matrix
const permissions = {
  'Super Admin': {
    manageUsers: true,
    manageAllTransformers: true,
    deleteTransformers: true,
    bulkImport: true,
    viewAuditLogs: true,
    manageAllFaults: true,
    exportReports: true
  },
  'Territory Manager': {
    manageOwnTerritory: true,
    verifyTransformers: true,
    assignFaults: true,
    viewDashboard: true,
    viewOwnTerritory: true,
    exportReports: true
  },
  'Engineer': {
    viewAssignedArea: true,
    verifyTransformers: true,
    assignFaults: true,
    viewDashboard: true,
    resolveFaults: true
  },
  'Field Technician': {
    viewAssignedArea: true,
    logInspections: true,
    logMaintenance: true,
    reportFaults: true,
    viewNearbyTransformers: true
  },
  'Viewer': {
    viewAllTransformers: true,
    viewDashboard: true,
    viewReports: true
  }
};

const checkPermission = (user, action, resource) => {
  const userPermissions = permissions[user.role] || {};
  return userPermissions[action] || false;
};

const canAccessTransformer = (user, transformer) => {
  if (user.role === 'Super Admin') return true;
  if (user.role === 'Viewer') return true;
  
  const transformerTerritory = transformer.location_operational?.territory_id;
  const transformerServiceArea = transformer.location_operational?.service_area_id;
  
  if (user.role === 'Territory Manager') {
    return transformerTerritory?.toString() === user.territory_id?.toString();
  }
  
  if (user.role === 'Engineer' || user.role === 'Field Technician') {
    return transformerServiceArea?.toString() === user.service_area_id?.toString();
  }
  
  return false;
};

module.exports = { checkPermission, canAccessTransformer };