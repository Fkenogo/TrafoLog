const ReportService = require('./reportService');
const { ApiError } = require('../utils/error');

const reportGenerators = {
  transformers: ReportService.generateTransformerReport,
  inspections: ReportService.generateInspectionReport,
  faults: ReportService.generateFaultReport,
  maintenance: ReportService.generateMaintenanceReport,
  'asset-register': ReportService.generateAssetRegister
};

const toPlain = (value) => {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject({ virtuals: true });
  return value;
};

const userName = (value) => {
  if (!value) return 'Not assigned';
  if (typeof value === 'string') return value;
  return value.name || value.email || 'Not assigned';
};

const transformerName = (value) => {
  if (!value) return 'Transformer';
  if (typeof value === 'string') return value;
  return value.asset_id || value.location_administrative?.site_name || value.site_name || 'Transformer';
};

const siteName = (value) => {
  if (!value || typeof value === 'string') return 'Not recorded';
  return value.location_administrative?.site_name || value.site_name || 'Not recorded';
};

const refName = (value) => {
  if (!value || typeof value === 'string') return undefined;
  return value.name || value.code;
};

const transformerTerritory = (value) => value?.location_operational?.territory_name || refName(value?.location_operational?.territory_id) || 'Not recorded';
const transformerServiceArea = (value) => value?.location_operational?.service_area_name || refName(value?.location_operational?.service_area_id) || 'Not recorded';
const transformerFeeder = (value) => value?.location_operational?.feeder_name || value?.location_operational?.feeder_code || refName(value?.location_operational?.feeder_id) || 'Not recorded';
const transformerCondition = (value) => value?.condition || value?.overall_condition || value?.latest_inspection?.physical?.overall_condition || value?.latest_inspection?.overall_condition || 'Not recorded';

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toISOString();
};

const getTransformer = (value) => (value && typeof value === 'object' ? value : undefined);

const csvEscape = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (rows) => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ];
  return `${lines.join('\n')}\n`;
};

const filenameFor = (reportType, format) => {
  const safeReportType = reportType.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `${safeReportType}-export.${format}`;
};

const locationFromAssetRegister = (row) => [
  row.Territory,
  row['Service Area'],
  row.Feeder,
  row.District,
  row['Site Name']
].filter((value) => value && value !== 'N/A').join(' / ') || 'Not recorded';

const gpsAvailability = (row) => {
  const coordinates = row['GPS Coordinates'];
  return coordinates && coordinates !== 'N/A' ? 'Recorded' : 'Missing';
};

class ExportService {
  async buildExport(reportType, filters, userId, format) {
    const generator = reportGenerators[reportType];
    if (!generator) {
      throw new ApiError(400, 'Unsupported export report type');
    }

    const report = await generator(filters || {}, userId, 'json');
    const rows = this.sanitizeRows(reportType, report.data);
    const metadata = {
      report_type: reportType,
      format,
      total: rows.length,
      filters: report.filters || {},
      generated_at: report.generated_at || new Date().toISOString()
    };

    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: filenameFor(reportType, 'json'),
        metadata,
        rows
      };
    }

    if (format === 'csv') {
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: filenameFor(reportType, 'csv'),
        metadata,
        content: toCsv(rows)
      };
    }

    throw new ApiError(400, 'Unsupported export format');
  }

  sanitizeRows(reportType, rows = []) {
    if (reportType === 'transformers') {
      return rows.map((row) => {
        const item = toPlain(row);
        return {
          'Asset ID': item.asset_id || 'Not recorded',
          Site: siteName(item),
          Territory: transformerTerritory(item),
          'Service Area': transformerServiceArea(item),
          Feeder: transformerFeeder(item),
          kVA: item.kva_rating || 'Not recorded',
          Voltage: item.network_voltage_kv ? `${item.network_voltage_kv} kV` : 'Not recorded',
          Status: item.operational_status || 'Not recorded',
          Condition: transformerCondition(item)
        };
      });
    }

    if (reportType === 'inspections') {
      return rows.map((row) => {
        const item = toPlain(row);
        const transformer = getTransformer(item.transformer_id);
        return {
          'Inspection Date': formatDate(item.inspection_date),
          Transformer: transformerName(transformer || item.transformer_id),
          Site: siteName(transformer),
          Inspector: userName(item.inspector_id || item.inspected_by),
          Condition: item.physical?.overall_condition || item.overall_condition || 'Not recorded',
          'Recommended Action': item.recommended_action || item.recommended_action_details || 'Not recorded'
        };
      });
    }

    if (reportType === 'faults') {
      return rows.map((row) => {
        const item = toPlain(row);
        const transformer = getTransformer(item.transformer_id);
        return {
          'Fault Type': item.fault_type || 'Not recorded',
          Transformer: transformerName(transformer || item.transformer_id),
          Severity: item.severity || 'Not recorded',
          Status: item.fault_status || 'Not recorded',
          Date: formatDate(item.fault_date),
          'Assigned To': userName(item.assigned_to),
          Resolution: item.resolution_description || item.root_cause || 'Not recorded'
        };
      });
    }

    if (reportType === 'maintenance') {
      return rows.map((row) => {
        const item = toPlain(row);
        const transformer = getTransformer(item.transformer_id);
        return {
          'Maintenance Date': formatDate(item.maintenance_date),
          Transformer: transformerName(transformer || item.transformer_id),
          Type: item.maintenance_type || 'Not recorded',
          Status: item.status || item.sync_status || 'Not recorded',
          Technician: item.technician_name || userName(item.technician_id),
          'Next Maintenance': formatDate(item.next_maintenance_date)
        };
      });
    }

    if (reportType === 'asset-register') {
      return rows.map((row) => ({
        'Asset ID': row['Asset ID'] || 'Not recorded',
        'Serial Number': row['Serial Number'] || 'Not recorded',
        Manufacturer: row.Manufacturer || 'Not recorded',
        kVA: row.Rating || 'Not recorded',
        Voltage: row['Network Voltage'] || 'Not recorded',
        Location: locationFromAssetRegister(row),
        Status: row['Operational Status'] || 'Not recorded',
        'GPS Availability': gpsAvailability(row)
      }));
    }

    return [];
  }
}

module.exports = new ExportService();
