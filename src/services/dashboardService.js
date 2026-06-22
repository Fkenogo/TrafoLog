const Transformer = require('../models/Transformer');
const Fault = require('../models/Fault');
const Inspection = require('../models/Inspection');
const Maintenance = require('../models/Maintenance');
const Notification = require('../models/Notification');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class DashboardService {
  /**
   * Get manager dashboard data
   */
  async getManagerDashboard(userId, userRole, territoryId = null) {
    try {
      const filters = {};
      if (territoryId) {
        filters['location_operational.territory_id'] = territoryId;
      }

      const [
        kpi,
        alerts,
        charts,
        decisionTables,
        mapData
      ] = await Promise.all([
        this.getKPI(filters),
        this.getAlerts(filters),
        this.getCharts(filters),
        this.getDecisionTables(filters),
        this.getMapData(filters)
      ]);

      return {
        kpi,
        alerts,
        charts,
        decisionTables,
        mapData,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error in DashboardService.getManagerDashboard:', error);
      throw new ApiError(500, 'Failed to get manager dashboard data');
    }
  }

  /**
   * Get field technician dashboard
   */
  async getFieldDashboard(userId, userRole, serviceAreaId = null) {
    try {
      const filters = {};
      if (serviceAreaId) {
        filters['location_operational.service_area_id'] = serviceAreaId;
      }

      // Get assigned faults
      const assignedFaults = await Fault.find({
        assigned_to: userId,
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
      }).populate('transformer_id');

      // Get nearby transformers
      // This would use the user's last known location
      const nearbyTransformers = await this.getNearbyTransformers(userId);

      // Get recent submissions
      const recentSubmissions = await this.getRecentSubmissions(userId);

      return {
        serviceArea: serviceAreaId,
        assignedFaults: assignedFaults,
        nearbyTransformers: nearbyTransformers,
        recentSubmissions: recentSubmissions,
        quickActions: [
          { label: 'Log Visit', icon: 'clipboard', action: '/inspections/new' },
          { label: 'Report Fault', icon: 'alert-triangle', action: '/faults/new' },
          { label: 'Register Asset', icon: 'plus', action: '/transformers/new' }
        ],
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error in DashboardService.getFieldDashboard:', error);
      throw new ApiError(500, 'Failed to get field dashboard data');
    }
  }

  /**
   * Get KPI data
   */
  async getKPI(filters = {}) {
    try {
      const match = { is_deleted: false };
      
      if (filters['location_operational.territory_id']) {
        match['location_operational.territory_id'] = filters['location_operational.territory_id'];
      }

      const stats = await Transformer.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$operational_status', 'Active'] }, 1, 0] }
            },
            faulty: {
              $sum: { $cond: [{ $eq: ['$has_open_fault', true] }, 1, 0] }
            },
            underMaintenance: {
              $sum: { $cond: [{ $eq: ['$operational_status', 'Under Maintenance'] }, 1, 0] }
            },
            decommissioned: {
              $sum: { $cond: [{ $eq: ['$operational_status', 'Decommissioned'] }, 1, 0] }
            },
            total11kV: {
              $sum: { $cond: [{ $eq: ['$network_voltage_kv', 11] }, 1, 0] }
            },
            total33kV: {
              $sum: { $cond: [{ $eq: ['$network_voltage_kv', 33] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        active: 0,
        faulty: 0,
        underMaintenance: 0,
        decommissioned: 0,
        '11kV': 0,
        '33kV': 0
      };
    } catch (error) {
      logger.error('Error in DashboardService.getKPI:', error);
      throw error;
    }
  }

  /**
   * Get alerts
   */
  async getAlerts(filters = {}) {
    try {
      const alerts = {
        criticalFaults: [],
        unresolvedFaults: [],
        overloadedTransformers: [],
        overdueInspections: [],
        pendingVerification: []
      };

      // Get critical faults
      const criticalFaults = await Fault.find({
        severity: { $in: ['Critical', 'Complete Outage'] },
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
      }).populate('transformer_id');

      alerts.criticalFaults = criticalFaults.map(f => ({
        id: f._id,
        transformerId: f.transformer_id?.asset_id || 'Unknown',
        severity: f.severity,
        faultType: f.fault_type,
        site: f.transformer_id?.location_administrative?.site_name || 'Unknown',
        reportedAt: f.fault_date
      }));

      // Get unresolved faults > 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const unresolvedFaults = await Fault.find({
        fault_status: { $in: ['Open', 'Assigned', 'In Progress'] },
        fault_date: { $lt: sevenDaysAgo }
      }).populate('transformer_id');

      alerts.unresolvedFaults = unresolvedFaults.map(f => ({
        id: f._id,
        transformerId: f.transformer_id?.asset_id || 'Unknown',
        daysOpen: Math.floor((new Date() - f.fault_date) / (1000 * 60 * 60 * 24)),
        faultType: f.fault_type,
        site: f.transformer_id?.location_administrative?.site_name || 'Unknown'
      }));

      // Get overloaded transformers
      const overloaded = await Inspection.aggregate([
        {
          $sort: { transformer_id: 1, inspection_date: -1 }
        },
        {
          $group: {
            _id: '$transformer_id',
            latest: { $first: '$$ROOT' }
          }
        },
        {
          $match: {
            'latest.electrical.overload_flag': true
          }
        },
        {
          $lookup: {
            from: 'transformers',
            localField: '_id',
            foreignField: '_id',
            as: 'transformer'
          }
        },
        {
          $unwind: '$transformer'
        }
      ]);

      alerts.overloadedTransformers = overloaded.map(item => ({
        transformerId: item.transformer.asset_id,
        rating: item.transformer.display_rating,
        loadPercentage: item.latest.electrical.load_percentage,
        site: item.transformer.location_administrative?.site_name || 'Unknown'
      }));

      // Get overdue inspections
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const overdue = await Transformer.find({
        $or: [
          { last_inspection_date: { $lt: ninetyDaysAgo } },
          { last_inspection_date: { $exists: false } }
        ],
        operational_status: { $ne: 'Decommissioned' }
      });

      alerts.overdueInspections = overdue.map(t => ({
        transformerId: t.asset_id,
        site: t.location_administrative?.site_name || 'Unknown',
        daysOverdue: t.last_inspection_date ? 
          Math.floor((new Date() - t.last_inspection_date) / (1000 * 60 * 60 * 24)) : 
          999,
        lastInspection: t.last_inspection_date
      }));

      // Get pending verification
      const pending = await Transformer.find({
        record_status: 'Draft'
      });

      alerts.pendingVerification = pending.map(t => ({
        transformerId: t.asset_id,
        site: t.location_administrative?.site_name || 'Unknown',
        created: t.created_at,
        submittedBy: t.created_by
      }));

      return alerts;
    } catch (error) {
      logger.error('Error in DashboardService.getAlerts:', error);
      throw error;
    }
  }

  /**
   * Get charts data
   */
  async getCharts(filters = {}) {
    try {
      const match = {};
      if (filters['location_operational.territory_id']) {
        match['location_operational.territory_id'] = filters['location_operational.territory_id'];
      }

      // Transformers by territory
      const byTerritory = await Transformer.aggregate([
        { $match: { is_deleted: false } },
        {
          $group: {
            _id: '$location_operational.territory_name',
            count: { $sum: 1 }
          }
        }
      ]);

      // Transformers by network voltage
      const byNetwork = await Transformer.aggregate([
        { $match: { is_deleted: false } },
        {
          $group: {
            _id: '$network_voltage_kv',
            count: { $sum: 1 }
          }
        }
      ]);

      // Transformers by kVA rating
      const byKVA = await Transformer.aggregate([
        { $match: { is_deleted: false } },
        {
          $group: {
            _id: {
              kva: '$kva_rating',
              voltage: '$network_voltage_kv'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      // Fault trends (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const faultTrends = await Fault.aggregate([
        {
          $match: {
            fault_date: { $gte: twelveMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$fault_date' },
              month: { $month: '$fault_date' },
              voltage: '$network_voltage_kv'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Inspections comparison
      const currentMonth = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const currentMonthInspections = await Inspection.countDocuments({
        inspection_date: {
          $gte: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
          $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
        }
      });

      const lastMonthInspections = await Inspection.countDocuments({
        inspection_date: {
          $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
          $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1)
        }
      });

      // Average fault resolution time by territory
      const resolutionTime = await Fault.aggregate([
        {
          $match: {
            resolved_date: { $exists: true },
            downtime_hours: { $exists: true }
          }
        },
        {
          $lookup: {
            from: 'transformers',
            localField: 'transformer_id',
            foreignField: '_id',
            as: 'transformer'
          }
        },
        {
          $unwind: '$transformer'
        },
        {
          $group: {
            _id: '$transformer.location_operational.territory_name',
            averageHours: { $avg: '$downtime_hours' }
          }
        }
      ]);

      return {
        byTerritory,
        byNetwork,
        byKVA,
        faultTrends,
        inspectionsComparison: {
          currentMonth: currentMonthInspections,
          lastMonth: lastMonthInspections,
          change: currentMonthInspections - lastMonthInspections
        },
        resolutionTime
      };
    } catch (error) {
      logger.error('Error in DashboardService.getCharts:', error);
      throw error;
    }
  }

  /**
   * Get decision support tables
   */
  async getDecisionTables(filters = {}) {
    try {
      const match = {};
      if (filters['location_operational.territory_id']) {
        match['location_operational.territory_id'] = filters['location_operational.territory_id'];
      }

      // Repair candidates
      const repairCandidates = await Fault.aggregate([
        {
          $match: {
            fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
          }
        },
        {
          $lookup: {
            from: 'transformers',
            localField: 'transformer_id',
            foreignField: '_id',
            as: 'transformer'
          }
        },
        {
          $unwind: '$transformer'
        },
        {
          $project: {
            assetId: '$transformer.asset_id',
            rating: '$transformer.display_rating',
            site: '$transformer.location_administrative.site_name',
            territory: '$transformer.location_operational.territory_name',
            faultType: '$fault_type',
            severity: '$severity',
            daysOpen: {
              $floor: {
                $divide: [
                  { $subtract: [new Date(), '$fault_date'] },
                  1000 * 60 * 60 * 24
                ]
              }
            },
            faultId: '$_id'
          }
        },
        { $sort: { severity: 1, daysOpen: -1 } }
      ]);

      // Replacement candidates (age > 20 years OR > 3 faults in 24 months)
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);

      const replacementCandidates = await Transformer.aggregate([
        {
          $match: {
            ...match,
            $or: [
              { year_manufactured: { $lte: twentyYearsAgo.getFullYear() } }
            ]
          }
        },
        {
          $lookup: {
            from: 'faults',
            localField: '_id',
            foreignField: 'transformer_id',
            as: 'faults'
          }
        },
        {
          $addFields: {
            faultCount: { $size: '$faults' }
          }
        },
        {
          $match: {
            $or: [
              { year_manufactured: { $lte: twentyYearsAgo.getFullYear() } },
              { faultCount: { $gt: 3 } }
            ]
          }
        },
        {
          $project: {
            assetId: '$asset_id',
            rating: '$display_rating',
            age: {
              $cond: [
                { $eq: ['$year_manufactured', null] },
                'Unknown',
                { $subtract: [new Date().getFullYear(), '$year_manufactured'] }
              ]
            },
            faultCount: 1,
            lastCondition: '$last_inspection_date',
            site: '$location_administrative.site_name'
          }
        }
      ]);

      // Load split candidates (> 80% load)
      const loadSplitCandidates = await Inspection.aggregate([
        {
          $sort: { transformer_id: 1, inspection_date: -1 }
        },
        {
          $group: {
            _id: '$transformer_id',
            latest: { $first: '$$ROOT' }
          }
        },
        {
          $match: {
            'latest.electrical.load_percentage': { $gt: 80 }
          }
        },
        {
          $lookup: {
            from: 'transformers',
            localField: '_id',
            foreignField: '_id',
            as: 'transformer'
          }
        },
        {
          $unwind: '$transformer'
        },
        {
          $project: {
            assetId: '$transformer.asset_id',
            rating: '$transformer.display_rating',
            loadPercentage: '$latest.electrical.load_percentage',
            site: '$transformer.location_administrative.site_name',
            feeder: '$transformer.location_operational.feeder_name',
            lastReading: '$latest.inspection_date'
          }
        }
      ]);

      return {
        repairCandidates,
        replacementCandidates,
        loadSplitCandidates
      };
    } catch (error) {
      logger.error('Error in DashboardService.getDecisionTables:', error);
      throw error;
    }
  }

  /**
   * Get map data
   */
  async getMapData(filters = {}) {
    try {
      const match = { is_deleted: false };
      
      if (filters['location_operational.territory_id']) {
        match['location_operational.territory_id'] = filters['location_operational.territory_id'];
      }

      const transformers = await Transformer.find(match)
        .select('asset_id display_rating operational_status gps location_administrative.site_name last_inspection_date has_open_fault');

      const mapData = transformers.map(t => {
        let status = 'active';
        if (t.operational_status === 'Decommissioned') status = 'decommissioned';
        else if (t.has_open_fault) status = 'faulty';
        else if (t.operational_status === 'Under Maintenance') status = 'maintenance';

        return {
          id: t.asset_id,
          location: t.gps ? [t.gps.coordinates[1], t.gps.coordinates[0]] : null,
          status: status,
          rating: t.display_rating,
          site: t.location_administrative?.site_name || 'Unknown',
          lastInspection: t.last_inspection_date,
          hasOpenFault: t.has_open_fault
        };
      }).filter(t => t.location);

      return mapData;
    } catch (error) {
      logger.error('Error in DashboardService.getMapData:', error);
      throw error;
    }
  }

  /**
   * Get nearby transformers (for field tech)
   */
  async getNearbyTransformers(userId) {
    // This would use the user's last known location
    // For now, return empty array
    return [];
  }

  /**
   * Get recent submissions (for field tech)
   */
  async getRecentSubmissions(userId) {
    try {
      const recent = [];

      // Recent inspections
      const inspections = await Inspection.find({
        inspector_id: userId
      })
      .sort({ created_at: -1 })
      .limit(5)
      .populate('transformer_id', 'asset_id');

      // Recent faults
      const faults = await Fault.find({
        reported_by: userId
      })
      .sort({ created_at: -1 })
      .limit(5)
      .populate('transformer_id', 'asset_id');

      // Recent maintenance
      const maintenance = await Maintenance.find({
        technician_id: userId
      })
      .sort({ created_at: -1 })
      .limit(5)
      .populate('transformer_id', 'asset_id');

      recent.push(
        ...inspections.map(i => ({
          type: 'inspection',
          id: i._id,
          transformerId: i.transformer_id?.asset_id || 'Unknown',
          date: i.inspection_date,
          details: `Inspection: ${i.physical?.overall_condition || 'N/A'}`
        })),
        ...faults.map(f => ({
          type: 'fault',
          id: f._id,
          transformerId: f.transformer_id?.asset_id || 'Unknown',
          date: f.fault_date,
          details: `Fault: ${f.fault_type} (${f.severity})`
        })),
        ...maintenance.map(m => ({
          type: 'maintenance',
          id: m._id,
          transformerId: m.transformer_id?.asset_id || 'Unknown',
          date: m.maintenance_date,
          details: `Maintenance: ${m.maintenance_type}`
        }))
      );

      // Sort by date and limit
      recent.sort((a, b) => new Date(b.date) - new Date(a.date));
      return recent.slice(0, 10);
    } catch (error) {
      logger.error('Error in DashboardService.getRecentSubmissions:', error);
      return [];
    }
  }
}

module.exports = new DashboardService();