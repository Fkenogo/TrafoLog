const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const Fault = require('../models/Fault');
const Maintenance = require('../models/Maintenance');
const ExportJob = require('../models/ExportJob');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class ReportingService {
  /**
   * Generate transformer report
   */
  async generateTransformerReport(filters, userId, format = 'json') {
    try {
      const query = this.buildTransformerQuery(filters);
      const transformers = await Transformer.find(query)
        .populate('rating_id')
        .populate('location_operational.territory_id')
        .populate('location_administrative.district_id');

      const report = {
        title: 'Transformer Asset Report',
        generatedAt: new Date(),
        total: transformers.length,
        filters,
        data: transformers
      };

      return await this.formatReport(report, format, 'transformers', userId);
    } catch (error) {
      logger.error('Error generating transformer report:', error);
      throw new ApiError(500, 'Failed to generate transformer report');
    }
  }

  /**
   * Generate inspection report
   */
  async generateInspectionReport(filters, userId, format = 'json') {
    try {
      const query = this.buildInspectionQuery(filters);
      const inspections = await Inspection.find(query)
        .populate('transformer_id')
        .populate('inspector_id', 'name email');

      const report = {
        title: 'Inspection Report',
        generatedAt: new Date(),
        total: inspections.length,
        filters,
        data: inspections
      };

      return await this.formatReport(report, format, 'inspections', userId);
    } catch (error) {
      logger.error('Error generating inspection report:', error);
      throw new ApiError(500, 'Failed to generate inspection report');
    }
  }

  /**
   * Generate fault report
   */
  async generateFaultReport(filters, userId, format = 'json') {
    try {
      const query = this.buildFaultQuery(filters);
      const faults = await Fault.find(query)
        .populate('transformer_id')
        .populate('reported_by', 'name email')
        .populate('assigned_to', 'name email')
        .populate('resolved_by', 'name email');

      const report = {
        title: 'Fault Report',
        generatedAt: new Date(),
        total: faults.length,
        filters,
        data: faults
      };

      return await this.formatReport(report, format, 'faults', userId);
    } catch (error) {
      logger.error('Error generating fault report:', error);
      throw new ApiError(500, 'Failed to generate fault report');
    }
  }

  /**
   * Generate maintenance report
   */
  async generateMaintenanceReport(filters, userId, format = 'json') {
    try {
      const query = this.buildMaintenanceQuery(filters);
      const maintenance = await Maintenance.find(query)
        .populate('transformer_id')
        .populate('technician_id', 'name email');

      const report = {
        title: 'Maintenance Report',
        generatedAt: new Date(),
        total: maintenance.length,
        filters,
        data: maintenance
      };

      return await this.formatReport(report, format, 'maintenance', userId);
    } catch (error) {
      logger.error('Error generating maintenance report:', error);
      throw new ApiError(500, 'Failed to generate maintenance report');
    }
  }

  /**
   * Generate asset register
   */
  async generateAssetRegister(filters, userId, format = 'excel') {
    try {
      const query = this.buildTransformerQuery(filters);
      const transformers = await Transformer.find(query)
        .populate('rating_id')
        .populate('location_operational.territory_id')
        .populate('location_administrative.district_id');

      // Get latest inspection for each transformer
      const inspectionMap = {};
      const transformerIds = transformers.map(t => t._id);
      const latestInspections = await Inspection.aggregate([
        {
          $match: { transformer_id: { $in: transformerIds } }
        },
        {
          $sort: { transformer_id: 1, inspection_date: -1 }
        },
        {
          $group: {
            _id: '$transformer_id',
            latest: { $first: '$$ROOT' }
          }
        }
      ]);

      latestInspections.forEach(item => {
        inspectionMap[item._id.toString()] = item.latest;
      });

      // Get open faults count
      const faultCounts = await Fault.aggregate([
        {
          $match: {
            transformer_id: { $in: transformerIds },
            fault_status: { $in: ['Open', 'Assigned', 'In Progress'] }
          }
        },
        {
          $group: {
            _id: '$transformer_id',
            count: { $sum: 1 }
          }
        }
      ]);

      const faultMap = {};
      faultCounts.forEach(item => {
        faultMap[item._id.toString()] = item.count;
      });

      const registerData = transformers.map(t => ({
        'Asset ID': t.asset_id,
        'Serial Number': t.serial_number || 'N/A',
        'Manufacturer': t.manufacturer,
        'Rating': t.display_rating,
        'Network Voltage': `${t.network_voltage_kv}kV`,
        'Mounting Type': t.mounting_type,
        'Territory': t.location_operational?.territory_name || 'N/A',
        'Service Area': t.location_operational?.service_area_name || 'N/A',
        'Feeder': t.location_operational?.feeder_name || 'N/A',
        'District': t.location_administrative?.district_name || 'N/A',
        'Sub-county': t.location_administrative?.sub_county || 'N/A',
        'Parish': t.location_administrative?.parish || 'N/A',
        'Village': t.location_administrative?.village || 'N/A',
        'Site Name': t.location_administrative?.site_name || 'N/A',
        'Installation Date': t.installation?.install_date || 'N/A',
        'Last Inspection': t.last_inspection_date || 'N/A',
        'Last Maintenance': t.last_maintenance_date || 'N/A',
        'Operational Status': t.operational_status,
        'Open Faults': faultMap[t._id.toString()] || 0,
        'GPS Coordinates': t.gps ? `${t.gps.coordinates[1]}, ${t.gps.coordinates[0]}` : 'N/A'
      }));

      const report = {
        title: 'Asset Register',
        generatedAt: new Date(),
        total: registerData.length,
        filters,
        data: registerData
      };

      return await this.formatReport(report, format, 'asset-register', userId);
    } catch (error) {
      logger.error('Error generating asset register:', error);
      throw new ApiError(500, 'Failed to generate asset register');
    }
  }

  /**
   * Build transformer query from filters
   */
  buildTransformerQuery(filters) {
    const query = { is_deleted: false };

    if (filters.territory_id) {
      query['location_operational.territory_id'] = filters.territory_id;
    }
    if (filters.service_area_id) {
      query['location_operational.service_area_id'] = filters.service_area_id;
    }
    if (filters.network_voltage_kv) {
      query.network_voltage_kv = filters.network_voltage_kv;
    }
    if (filters.status) {
      query.operational_status = filters.status;
    }
    if (filters.district_id) {
      query['location_administrative.district_id'] = filters.district_id;
    }
    if (filters.kva_rating) {
      query.kva_rating = filters.kva_rating;
    }

    return query;
  }

  /**
   * Build inspection query from filters
   */
  buildInspectionQuery(filters) {
    const query = {};

    if (filters.startDate || filters.endDate) {
      query.inspection_date = {};
      if (filters.startDate) query.inspection_date.$gte = filters.startDate;
      if (filters.endDate) query.inspection_date.$lte = filters.endDate;
    }
    if (filters.territory_id) {
      // This would require joining with transformer
    }
    if (filters.transformer_id) {
      query.transformer_id = filters.transformer_id;
    }
    if (filters.condition) {
      query['physical.overall_condition'] = filters.condition;
    }

    return query;
  }

  /**
   * Build fault query from filters
   */
  buildFaultQuery(filters) {
    const query = {};

    if (filters.startDate || filters.endDate) {
      query.fault_date = {};
      if (filters.startDate) query.fault_date.$gte = filters.startDate;
      if (filters.endDate) query.fault_date.$lte = filters.endDate;
    }
    if (filters.severity) {
      query.severity = filters.severity;
    }
    if (filters.fault_type) {
      query.fault_type = filters.fault_type;
    }
    if (filters.status) {
      query.fault_status = filters.status;
    }
    if (filters.territory_id) {
      // This would require joining with transformer
    }

    return query;
  }

  /**
   * Build maintenance query from filters
   */
  buildMaintenanceQuery(filters) {
    const query = {};

    if (filters.startDate || filters.endDate) {
      query.maintenance_date = {};
      if (filters.startDate) query.maintenance_date.$gte = filters.startDate;
      if (filters.endDate) query.maintenance_date.$lte = filters.endDate;
    }
    if (filters.maintenance_type) {
      query.maintenance_type = filters.maintenance_type;
    }
    if (filters.territory_id) {
      // This would require joining with transformer
    }

    return query;
  }

  /**
   * Format report based on format type
   */
  async formatReport(report, format, reportType, userId) {
    if (format === 'json') {
      return report;
    }

    if (format === 'excel') {
      return await this.generateExcelReport(report, reportType, userId);
    }

    if (format === 'pdf') {
      return await this.generatePDFReport(report, reportType, userId);
    }

    throw new ApiError(400, 'Unsupported format');
  }

  /**
   * Generate Excel report
   */
  async generateExcelReport(report, reportType, userId) {
    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();
      
      // Convert data to worksheet
      let worksheetData;
      if (reportType === 'asset-register') {
        worksheetData = report.data;
      } else {
        worksheetData = report.data.map(item => item.toObject ? item.toObject() : item);
      }
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Add summary sheet
      const summaryData = [
        ['Report Title:', report.title],
        ['Generated At:', new Date().toISOString()],
        ['Total Records:', report.total],
        ['Filters:', JSON.stringify(report.filters)]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Save export job
      const exportJob = new ExportJob({
        user_id: userId,
        export_type: 'excel',
        data_type: reportType,
        filters: report.filters,
        status: 'completed',
        file_url: `exports/${reportType}_${Date.now()}.xlsx`,
        file_size: buffer.length,
        completed_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
      await exportJob.save();
      
      return buffer;
    } catch (error) {
      logger.error('Error generating Excel report:', error);
      throw new ApiError(500, 'Failed to generate Excel report');
    }
  }

  /**
   * Generate PDF report
   */
  async generatePDFReport(report, reportType, userId) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      
      // Title
      doc.fontSize(20).text(report.title, { align: 'center' });
      doc.moveDown();
      
      // Metadata
      doc.fontSize(10);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.text(`Total Records: ${report.total}`);
      doc.moveDown();
      
      // Data table
      doc.fontSize(8);
      
      // Get headers
      const data = report.data;
      if (data && data.length > 0) {
        const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
        const columnWidths = headers.map(() => 100);
        
        // Draw table
        // This is simplified - in production use a table library
        let y = doc.y;
        let x = 50;
        
        // Headers
        doc.font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, x, y, { width: 80, ellipsis: true });
          x += 80;
        });
        
        y += 20;
        doc.font('Helvetica');
        
        // Data rows
        const rowsToShow = Math.min(20, data.length);
        for (let i = 0; i < rowsToShow; i++) {
          const row = data[i].toObject ? data[i].toObject() : data[i];
          x = 50;
          
          headers.forEach(header => {
            const value = row[header] || '';
            doc.text(String(value).substring(0, 30), x, y, { width: 80, ellipsis: true });
            x += 80;
          });
          
          y += 20;
          
          if (y > 700) {
            doc.addPage();
            y = 50;
          }
        }
        
        if (data.length > 20) {
          doc.text(`... and ${data.length - 20} more records`);
        }
      }
      
      doc.end();
      
      const buffer = Buffer.concat(buffers);
      
      // Save export job
      const exportJob = new ExportJob({
        user_id: userId,
        export_type: 'pdf',
        data_type: reportType,
        filters: report.filters,
        status: 'completed',
        file_url: `exports/${reportType}_${Date.now()}.pdf`,
        file_size: buffer.length,
        completed_at: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      await exportJob.save();
      
      return buffer;
    } catch (error) {
      logger.error('Error generating PDF report:', error);
      throw new ApiError(500, 'Failed to generate PDF report');
    }
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId, userId) {
    try {
      const exportJob = await ExportJob.findOne({
        _id: exportId,
        user_id: userId
      });
      
      if (!exportJob) {
        throw new ApiError(404, 'Export job not found');
      }
      
      return exportJob;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting export status:', error);
      throw new ApiError(500, 'Failed to get export status');
    }
  }

  /**
   * Download export file
   */
  async downloadExport(exportId, userId) {
    try {
      const exportJob = await ExportJob.findOne({
        _id: exportId,
        user_id: userId,
        status: 'completed'
      });
      
      if (!exportJob) {
        throw new ApiError(404, 'Export not found or not completed');
      }
      
      // In production, retrieve file from storage
      // For now, return mock data
      return {
        filename: `export_${exportId}.${exportJob.export_type}`,
        mimeType: exportJob.export_type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: Buffer.from('Mock export data')
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error downloading export:', error);
      throw new ApiError(500, 'Failed to download export');
    }
  }

  /**
   * Get report templates
   */
  async getReportTemplates() {
    return [
      {
        id: 'transformer-report',
        name: 'Transformer Asset Report',
        description: 'Complete list of all transformers with their details',
        fields: ['Asset ID', 'Rating', 'Location', 'Status', 'Last Inspection', 'Last Maintenance']
      },
      {
        id: 'inspection-report',
        name: 'Inspection Report',
        description: 'All inspection records with findings and recommendations',
        fields: ['Transformer', 'Inspector', 'Date', 'Condition', 'Load', 'Recommendations']
      },
      {
        id: 'fault-report',
        name: 'Fault Report',
        description: 'All fault records with severity, status, and resolution details',
        fields: ['Transformer', 'Type', 'Severity', 'Status', 'Reported Date', 'Resolution Time']
      },
      {
        id: 'maintenance-report',
        name: 'Maintenance Report',
        description: 'All maintenance activities with work performed and parts used',
        fields: ['Transformer', 'Type', 'Date', 'Work Performed', 'Parts Used', 'Next Maintenance']
      }
    ];
  }

  /**
   * Get scheduled reports
   */
  async getScheduledReports(userId) {
    // In production, retrieve from database
    return [];
  }

  /**
   * Schedule report
   */
  async scheduleReport(data) {
    // In production, save to database
    return {
      id: 'sched_' + Date.now(),
      ...data,
      createdAt: new Date(),
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  /**
   * Cancel scheduled report
   */
  async cancelSchedule(scheduleId, userId) {
    return { success: true };
  }

  /**
   * Save report template
   */
  async saveTemplate(data) {
    return {
      id: 'tmpl_' + Date.now(),
      ...data,
      createdAt: new Date()
    };
  }

  /**
   * Delete report template
   */
  async deleteTemplate(templateId, userId) {
    return { success: true };
  }

  /**
   * Generate custom report
   */
  async generateCustomReport(data) {
    // In production, generate based on data_source, fields, etc.
    return {
      title: data.name || 'Custom Report',
      generatedAt: new Date(),
      data: []
    };
  }
}

module.exports = new ReportingService();