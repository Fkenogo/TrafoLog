const DashboardService = require('../services/dashboardService');
const { successResponse, errorResponse, asyncHandler } = require('../utils/helpers');
const { logger } = require('../utils/logger');

class DashboardController {
  /**
   * Get manager dashboard
   * GET /api/dashboard/manager
   */
  getManagerDashboard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const territoryId = req.user.territory_id;

    const dashboardData = await DashboardService.getManagerDashboard(
      userId,
      userRole,
      territoryId
    );

    return successResponse(res, 200, 'Manager dashboard retrieved successfully', dashboardData);
  });

  /**
   * Get field technician dashboard
   * GET /api/dashboard/field
   */
  getFieldDashboard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const serviceAreaId = req.user.service_area_id;

    const dashboardData = await DashboardService.getFieldDashboard(
      userId,
      userRole,
      serviceAreaId
    );

    return successResponse(res, 200, 'Field dashboard retrieved successfully', dashboardData);
  });

  /**
   * Get KPI strip data
   * GET /api/dashboard/kpi
   */
  getKPI = asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.user.territory_id && req.user.role !== 'Super Admin') {
      filters['location_operational.territory_id'] = req.user.territory_id;
    }

    const kpiData = await DashboardService.getKPI(filters);

    return successResponse(res, 200, 'KPI data retrieved successfully', kpiData);
  });

  /**
   * Get alerts panel data
   * GET /api/dashboard/alerts
   */
  getAlerts = asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.user.territory_id && req.user.role !== 'Super Admin') {
      filters['location_operational.territory_id'] = req.user.territory_id;
    }

    const alerts = await DashboardService.getAlerts(filters);

    return successResponse(res, 200, 'Alerts retrieved successfully', alerts);
  });

  /**
   * Get chart data
   * GET /api/dashboard/charts
   */
  getCharts = asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.user.territory_id && req.user.role !== 'Super Admin') {
      filters['location_operational.territory_id'] = req.user.territory_id;
    }

    const charts = await DashboardService.getCharts(filters);

    return successResponse(res, 200, 'Chart data retrieved successfully', charts);
  });

  /**
   * Get decision support tables
   * GET /api/dashboard/decision-tables
   */
  getDecisionTables = asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.user.territory_id && req.user.role !== 'Super Admin') {
      filters['location_operational.territory_id'] = req.user.territory_id;
    }

    const decisionTables = await DashboardService.getDecisionTables(filters);

    return successResponse(res, 200, 'Decision tables retrieved successfully', decisionTables);
  });

  /**
   * Get map data
   * GET /api/dashboard/map-data
   */
  getMapData = asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.user.territory_id && req.user.role !== 'Super Admin') {
      filters['location_operational.territory_id'] = req.user.territory_id;
    }

    const mapData = await DashboardService.getMapData(filters);

    return successResponse(res, 200, 'Map data retrieved successfully', mapData);
  });

  /**
   * Get real-time updates
   * GET /api/dashboard/realtime
   */
  getRealTimeUpdates = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const territoryId = req.user.territory_id;

    // Get recent updates from the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const updates = {
      recentInspections: await Inspection.find({
        inspection_date: { $gte: twentyFourHoursAgo }
      }).countDocuments(),
      recentFaults: await Fault.find({
        fault_date: { $gte: twentyFourHoursAgo }
      }).countDocuments(),
      recentMaintenance: await Maintenance.find({
        maintenance_date: { $gte: twentyFourHoursAgo }
      }).countDocuments(),
      openFaults: await Fault.getOpenFaults(territoryId ? { territory_id: territoryId } : {}),
      timestamp: new Date()
    };

    return successResponse(res, 200, 'Real-time updates retrieved successfully', updates);
  });

  /**
   * Get dashboard widgets configuration
   * GET /api/dashboard/widgets
   */
  getWidgetsConfig = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    const widgets = {
      manager: [
        { id: 'kpi', name: 'KPI Strip', enabled: true },
        { id: 'alerts', name: 'Alert Panel', enabled: true },
        { id: 'map', name: 'Map View', enabled: true },
        { id: 'charts', name: 'Charts', enabled: true },
        { id: 'decisionTables', name: 'Decision Support Tables', enabled: true }
      ],
      field: [
        { id: 'assignedFaults', name: 'Assigned Faults', enabled: true },
        { id: 'nearbyTransformers', name: 'Nearby Transformers', enabled: true },
        { id: 'quickActions', name: 'Quick Actions', enabled: true },
        { id: 'recentSubmissions', name: 'Recent Submissions', enabled: true }
      ]
    };

    const config = userRole === 'Field Technician' || userRole === 'Engineer' 
      ? widgets.field 
      : widgets.manager;

    return successResponse(res, 200, 'Widgets configuration retrieved successfully', config);
  });
}

const _dashboardInstance = new DashboardController();
module.exports = new Proxy(_dashboardInstance, {
  get(target, prop) {
    const val = target[prop];
    if (typeof val === 'function') return val.bind(target);
    if (typeof prop === 'symbol') return val;
    return async (req, res) => res.status(501).json({ success: false, message: `dashboardController.${String(prop)} not yet implemented` });
  }
});