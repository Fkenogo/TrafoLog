const Transformer = require('../models/Transformer');
const Fault = require('../models/Fault');
const Inspection = require('../models/Inspection');
const Maintenance = require('../models/Maintenance');

const OPEN_FAULT_STATUSES = ['Open', 'Assigned', 'In Progress'];

const stripEmpty = (value) => Object.fromEntries(
  Object.entries(value || {}).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
);

const normalizeFilters = (filters = {}) => {
  const normalized = { ...filters };
  if (normalized.network_voltage_kv !== undefined) {
    normalized.network_voltage_kv = Number(normalized.network_voltage_kv);
  }
  if (normalized.kva_rating !== undefined) {
    normalized.kva_rating = Number(normalized.kva_rating);
  }
  return normalized;
};

const toId = (value) => value?.toString?.() || value;

const hasGps = (transformer) => Array.isArray(transformer.gps?.coordinates) && transformer.gps.coordinates.length === 2;

const groupCount = (items, getter, fallback = 'Not recorded') => items.reduce((acc, item) => {
  const rawKey = getter(item);
  const key = rawKey === undefined || rawKey === null || rawKey === '' ? fallback : String(rawKey);
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const monthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthlyTrend = (items, dateField) => Object.entries(groupCount(items, (item) => monthKey(item[dateField]), 'Unknown'))
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([month, count]) => ({ month, count }));

const latestInspectionByTransformer = (inspections) => {
  const latest = new Map();
  inspections.forEach((inspection) => {
    const transformerId = toId(inspection.transformer_id);
    const existing = latest.get(transformerId);
    if (!existing || new Date(inspection.inspection_date) > new Date(existing.inspection_date)) {
      latest.set(transformerId, inspection);
    }
  });
  return latest;
};

const topAffectedTransformers = (faults) => {
  const counts = new Map();
  faults.forEach((fault) => {
    const transformer = fault.transformer_id;
    const transformerId = toId(transformer?._id || transformer);
    const current = counts.get(transformerId) || {
      transformer_id: transformerId,
      asset_id: transformer?.asset_id || transformerId,
      site_name: transformer?.location_administrative?.site_name || 'Not recorded',
      fault_count: 0
    };
    current.fault_count += 1;
    counts.set(transformerId, current);
  });
  return Array.from(counts.values())
    .sort((left, right) => right.fault_count - left.fault_count)
    .slice(0, 10);
};

const buildTransformerMatch = (filters = {}) => {
  const match = { is_deleted: { $ne: true } };

  if (filters.territory_id) match['location_operational.territory_id'] = filters.territory_id;
  if (filters.service_area_id) match['location_operational.service_area_id'] = filters.service_area_id;
  if (filters.feeder_id) match['location_operational.feeder_id'] = filters.feeder_id;
  if (filters.district_id) match['location_administrative.district_id'] = filters.district_id;
  if (filters.network_voltage_kv) match.network_voltage_kv = filters.network_voltage_kv;
  if (filters.kva_rating) match.kva_rating = filters.kva_rating;
  if (filters.startDate || filters.endDate) {
    match.created_at = {};
    if (filters.startDate) match.created_at.$gte = filters.startDate;
    if (filters.endDate) match.created_at.$lte = filters.endDate;
  }

  return match;
};

const buildRecordMatch = (filters = {}, transformerIds = [], dateField) => {
  const match = {
    transformer_id: { $in: transformerIds }
  };

  if (filters.startDate || filters.endDate) {
    match[dateField] = {};
    if (filters.startDate) match[dateField].$gte = filters.startDate;
    if (filters.endDate) match[dateField].$lte = filters.endDate;
  }

  return match;
};

const baseResponse = (filters, payload) => ({
  summary: payload.summary || {},
  breakdowns: payload.breakdowns || {},
  trends: payload.trends || [],
  risks: payload.risks || [],
  filters: stripEmpty(filters),
  generated_at: new Date().toISOString()
});

class AnalyticsService {
  async getTransformerAnalytics(filters = {}) {
    filters = normalizeFilters(filters);
    const transformers = await Transformer.find(buildTransformerMatch(filters)).lean();
    const transformerIds = transformers.map((transformer) => transformer._id);
    const inspections = await Inspection.find({
      transformer_id: { $in: transformerIds },
      is_deleted: { $ne: true }
    }).lean();
    const latestInspections = latestInspectionByTransformer(inspections);
    const conditionDistribution = {};

    transformers.forEach((transformer) => {
      const latest = latestInspections.get(toId(transformer._id));
      const condition = latest?.physical?.overall_condition || 'Not recorded';
      conditionDistribution[condition] = (conditionDistribution[condition] || 0) + 1;
    });

    return baseResponse(filters, {
      summary: {
        total_transformers: transformers.length,
        missing_gps_count: transformers.filter((transformer) => !hasGps(transformer)).length,
        decommissioned_count: transformers.filter((transformer) => transformer.operational_status === 'Decommissioned').length
      },
      breakdowns: {
        by_operational_status: groupCount(transformers, (transformer) => transformer.operational_status),
        by_territory: groupCount(transformers, (transformer) => transformer.location_operational?.territory_name),
        by_service_area: groupCount(transformers, (transformer) => transformer.location_operational?.service_area_name),
        by_voltage: groupCount(transformers, (transformer) => transformer.network_voltage_kv),
        by_kva_rating: groupCount(transformers, (transformer) => transformer.kva_rating),
        condition_distribution: conditionDistribution
      }
    });
  }

  async getFaultAnalytics(filters = {}) {
    filters = normalizeFilters(filters);
    const transformers = await Transformer.find(buildTransformerMatch(filters)).select('_id').lean();
    const transformerIds = transformers.map((transformer) => transformer._id);
    const faults = await Fault.find(buildRecordMatch(filters, transformerIds, 'fault_date'))
      .populate('transformer_id', 'asset_id location_administrative.site_name')
      .lean();

    return baseResponse(filters, {
      summary: {
        total_faults: faults.length,
        open_faults: faults.filter((fault) => OPEN_FAULT_STATUSES.includes(fault.fault_status)).length,
        resolved_faults: faults.filter((fault) => ['Resolved', 'Closed'].includes(fault.fault_status)).length
      },
      breakdowns: {
        by_severity: groupCount(faults, (fault) => fault.severity),
        by_status: groupCount(faults, (fault) => fault.fault_status),
        by_fault_type: groupCount(faults, (fault) => fault.fault_type),
        top_affected_transformers: topAffectedTransformers(faults)
      },
      trends: monthlyTrend(faults, 'fault_date')
    });
  }

  async getMaintenanceAnalytics(filters = {}) {
    filters = normalizeFilters(filters);
    const transformers = await Transformer.find(buildTransformerMatch(filters)).select('_id').lean();
    const transformerIds = transformers.map((transformer) => transformer._id);
    const maintenanceRecords = await Maintenance.find({
      ...buildRecordMatch(filters, transformerIds, 'maintenance_date'),
      is_deleted: { $ne: true }
    }).lean();
    const now = new Date();

    return baseResponse(filters, {
      summary: {
        total_maintenance_records: maintenanceRecords.length,
        upcoming_maintenance: maintenanceRecords.filter((record) => record.next_maintenance_date && new Date(record.next_maintenance_date) >= now).length,
        overdue_maintenance: maintenanceRecords.filter((record) => record.next_maintenance_date && new Date(record.next_maintenance_date) < now).length
      },
      breakdowns: {
        by_maintenance_type: groupCount(maintenanceRecords, (record) => record.maintenance_type),
        by_status: groupCount(maintenanceRecords, (record) => record.sync_status)
      },
      trends: monthlyTrend(maintenanceRecords, 'maintenance_date')
    });
  }

  async getPredictiveAnalytics(filters = {}) {
    filters = normalizeFilters(filters);
    const transformers = await Transformer.find(buildTransformerMatch(filters)).lean();
    const transformerIds = transformers.map((transformer) => transformer._id);
    const [faults, inspections] = await Promise.all([
      Fault.find({ transformer_id: { $in: transformerIds } }).lean(),
      Inspection.find({ transformer_id: { $in: transformerIds }, is_deleted: { $ne: true } }).lean()
    ]);
    const latestInspections = latestInspectionByTransformer(inspections);
    const faultCounts = faults.reduce((acc, fault) => {
      const transformerId = toId(fault.transformer_id);
      acc[transformerId] = (acc[transformerId] || 0) + 1;
      return acc;
    }, {});
    const openCriticalFaults = new Set(faults
      .filter((fault) => OPEN_FAULT_STATUSES.includes(fault.fault_status) && ['Critical', 'Complete Outage'].includes(fault.severity))
      .map((fault) => toId(fault.transformer_id)));

    const risks = transformers.map((transformer) => {
      const transformerId = toId(transformer._id);
      const latest = latestInspections.get(transformerId);
      const condition = latest?.physical?.overall_condition;
      const reasons = [];
      let riskScore = 0;

      if (openCriticalFaults.has(transformerId)) {
        riskScore += 40;
        reasons.push('Open critical fault');
      }
      if (transformer.overdue_inspection_flag) {
        riskScore += 20;
        reasons.push('Overdue inspection');
      }
      if (condition === 'Critical') {
        riskScore += 35;
        reasons.push('Critical inspection condition');
      } else if (condition === 'Poor') {
        riskScore += 25;
        reasons.push('Poor inspection condition');
      }
      if ((faultCounts[transformerId] || 0) >= 2) {
        riskScore += 15;
        reasons.push('Repeated faults');
      }
      if (!hasGps(transformer)) {
        riskScore += 10;
        reasons.push('Missing GPS location');
      }

      if (riskScore === 0) return null;

      return {
        transformer_id: transformerId,
        asset_id: transformer.asset_id,
        site_name: transformer.location_administrative?.site_name || 'Not recorded',
        territory: transformer.location_operational?.territory_name || 'Not recorded',
        risk_score: Math.min(riskScore, 100),
        risk_level: riskScore >= 60 ? 'High' : riskScore >= 30 ? 'Medium' : 'Low',
        reasons
      };
    }).filter(Boolean).sort((left, right) => right.risk_score - left.risk_score);

    return baseResponse(filters, {
      summary: {
        risk_model: 'Rule-based operational risk',
        total_risk_transformers: risks.length,
        high_risk_transformers: risks.filter((risk) => risk.risk_level === 'High').length,
        medium_risk_transformers: risks.filter((risk) => risk.risk_level === 'Medium').length,
        low_risk_transformers: risks.filter((risk) => risk.risk_level === 'Low').length
      },
      breakdowns: {
        by_risk_level: groupCount(risks, (risk) => risk.risk_level)
      },
      risks
    });
  }
}

module.exports = new AnalyticsService();
