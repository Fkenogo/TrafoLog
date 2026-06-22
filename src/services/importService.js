const XLSX = require('xlsx');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const ImportLog = require('../models/ImportLog');
const Transformer = require('../models/Transformer');
const Inspection = require('../models/Inspection');
const TransformerService = require('./transformerService');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class ImportService {
  /**
   * Import transformers from file
   */
  async importTransformers(filePath, fileName, userId) {
    try {
      // Parse file
      const data = await this.parseFile(filePath);
      
      // Create import log
      const importLog = new ImportLog({
        imported_by: userId,
        file_name: fileName,
        total_rows: data.length,
        import_type: 'transformers',
        status: 'processing',
        started_at: new Date()
      });
      await importLog.save();

      const results = {
        success: 0,
        skipped: 0,
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const validation = this.validateTransformerRow(row);
          
          if (!validation.valid) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              message: validation.error,
              data: row
            });
            continue;
          }

          // Check for duplicate
          const exists = await TransformerService.exists({
            serial_number: row.serial_number
          });

          if (exists) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              message: 'Duplicate serial number',
              data: row
            });
            continue;
          }

          // Create transformer
          await TransformerService.createTransformer(row, userId);
          results.success++;
        } catch (error) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            message: error.message,
            data: data[i]
          });
        }
      }

      // Update import log
      importLog.success_count = results.success;
      importLog.skip_count = results.skipped;
      importLog.error_count = results.errors.length;
      importLog.errors = results.errors.slice(0, 100); // Limit errors
      importLog.status = 'completed';
      importLog.completed_at = new Date();
      await importLog.save();

      return {
        importId: importLog._id,
        ...results
      };
    } catch (error) {
      logger.error('Error importing transformers:', error);
      throw new ApiError(500, 'Failed to import transformers');
    } finally {
      // Clean up file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Import inspections from file
   */
  async importInspections(filePath, fileName, userId) {
    try {
      const data = await this.parseFile(filePath);
      
      const importLog = new ImportLog({
        imported_by: userId,
        file_name: fileName,
        total_rows: data.length,
        import_type: 'inspections',
        status: 'processing',
        started_at: new Date()
      });
      await importLog.save();

      const results = {
        success: 0,
        skipped: 0,
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const validation = this.validateInspectionRow(row);
          
          if (!validation.valid) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              message: validation.error,
              data: row
            });
            continue;
          }

          // Find transformer by asset_id
          const transformer = await Transformer.findOne({ asset_id: row.asset_id });
          if (!transformer) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              message: 'Transformer not found',
              data: row
            });
            continue;
          }

          // Create inspection
          await Inspection.create({
            transformer_id: transformer._id,
            inspector_id: userId,
            inspection_date: row.inspection_date || new Date(),
            ...row
          });
          results.success++;
        } catch (error) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            message: error.message,
            data: data[i]
          });
        }
      }

      importLog.success_count = results.success;
      importLog.skip_count = results.skipped;
      importLog.error_count = results.errors.length;
      importLog.errors = results.errors.slice(0, 100);
      importLog.status = 'completed';
      importLog.completed_at = new Date();
      await importLog.save();

      return {
        importId: importLog._id,
        ...results
      };
    } catch (error) {
      logger.error('Error importing inspections:', error);
      throw new ApiError(500, 'Failed to import inspections');
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Parse file (Excel or CSV)
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.xlsx' || ext === '.xls') {
      return this.parseExcel(filePath);
    } else if (ext === '.csv') {
      return this.parseCSV(filePath);
    } else {
      throw new ApiError(400, 'Unsupported file format. Please use Excel (.xlsx) or CSV (.csv)');
    }
  }

  /**
   * Parse Excel file
   */
  async parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet);
  }

  /**
   * Parse CSV file
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Validate transformer row
   */
  validateTransformerRow(row) {
    const required = [
      'manufacturer',
      'kva_rating',
      'network_voltage_kv',
      'site_name',
      'district_name',
      'territory_name',
      'latitude',
      'longitude'
    ];

    for (const field of required) {
      if (!row[field]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate kVA rating
    const validKVA = [50, 100, 160, 200, 250, 315, 500, 630, 1000];
    if (!validKVA.includes(Number(row.kva_rating))) {
      return { valid: false, error: 'Invalid kVA rating' };
    }

    // Validate network voltage
    if (![11, 33].includes(Number(row.network_voltage_kv))) {
      return { valid: false, error: 'Network voltage must be 11 or 33' };
    }

    // Validate coordinates
    if (isNaN(Number(row.latitude)) || isNaN(Number(row.longitude))) {
      return { valid: false, error: 'Invalid coordinates' };
    }

    return { valid: true };
  }

  /**
   * Validate inspection row
   */
  validateInspectionRow(row) {
    if (!row.asset_id) {
      return { valid: false, error: 'asset_id is required' };
    }

    if (!row.inspection_date) {
      return { valid: false, error: 'inspection_date is required' };
    }

    return { valid: true };
  }

  /**
   * Generate import template
   */
  async generateTemplate() {
    const headers = {
      manufacturer: 'ABB',
      serial_number: 'SN-2024-001',
      kva_rating: 315,
      network_voltage_kv: 11,
      voltage_secondary: '415V',
      phase_type: 'Three Phase',
      cooling_type: 'ONAN',
      mounting_type: 'Pole Mounted',
      territory_name: 'Central',
      service_area_name: 'Kampala East',
      feeder_name: 'F04-Nakawa',
      district_name: 'Kampala',
      sub_county: 'Nakawa',
      parish: 'Nakawa East',
      village: 'Kiwatule',
      site_name: 'Kiwatule Trading Centre',
      latitude: 0.3214,
      longitude: 32.5823,
      install_date: '2024-01-15',
      installing_contractor: 'UGET Power Ltd'
    };

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transformers');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generate inspection template
   */
  async generateInspectionTemplate() {
    const headers = {
      asset_id: 'TRF-000001',
      inspection_date: '2024-06-15',
      visit_type: 'Routine Inspection',
      network_voltage_confirmed: true,
      kva_rating_confirmed: true,
      overall_condition: 'Good',
      rust_corrosion: 'None',
      oil_leakage: 'None',
      load_percentage: 68,
      recommended_action: 'Monitor'
    };

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspections');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Validate import file
   */
  async validateImportFile(filePath) {
    try {
      const data = await this.parseFile(filePath);
      
      const validation = {
        totalRows: data.length,
        validRows: 0,
        invalidRows: 0,
        errors: []
      };

      for (let i = 0; i < data.length; i++) {
        const rowValidation = this.validateTransformerRow(data[i]);
        if (rowValidation.valid) {
          validation.validRows++;
        } else {
          validation.invalidRows++;
          validation.errors.push({
            row: i + 1,
            error: rowValidation.error,
            data: data[i]
          });
        }
      }

      return validation;
    } catch (error) {
      logger.error('Error validating import file:', error);
      throw new ApiError(500, 'Failed to validate import file');
    }
  }

  /**
   * Get import history
   */
  async getImportHistory(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const [data, total] = await Promise.all([
        ImportLog.find({ imported_by: userId })
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit),
        ImportLog.countDocuments({ imported_by: userId })
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting import history:', error);
      throw new ApiError(500, 'Failed to get import history');
    }
  }

  /**
   * Get import details
   */
  async getImportDetails(importId) {
    try {
      const importLog = await ImportLog.findById(importId);
      if (!importLog) {
        throw new ApiError(404, 'Import not found');
      }
      return importLog;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting import details:', error);
      throw new ApiError(500, 'Failed to get import details');
    }
  }

  /**
   * Get import errors
   */
  async getImportErrors(importId, page = 1, limit = 50) {
    try {
      const importLog = await ImportLog.findById(importId);
      if (!importLog) {
        throw new ApiError(404, 'Import not found');
      }

      const start = (page - 1) * limit;
      const end = start + limit;
      
      return {
        errors: importLog.errors.slice(start, end),
        total: importLog.errors.length,
        page,
        limit,
        pages: Math.ceil(importLog.errors.length / limit)
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error getting import errors:', error);
      throw new ApiError(500, 'Failed to get import errors');
    }
  }

  /**
   * Cancel import
   */
  async cancelImport(importId) {
    try {
      const importLog = await ImportLog.findById(importId);
      if (!importLog) {
        throw new ApiError(404, 'Import not found');
      }

      if (importLog.status === 'completed') {
        throw new ApiError(400, 'Import already completed');
      }

      importLog.status = 'failed';
      importLog.completed_at = new Date();
      await importLog.save();

      return { success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error cancelling import:', error);
      throw new ApiError(500, 'Failed to cancel import');
    }
  }

  /**
   * Retry failed import
   */
  async retryImport(importId, userId) {
    try {
      const importLog = await ImportLog.findById(importId);
      if (!importLog) {
        throw new ApiError(404, 'Import not found');
      }

      // Get failed rows
      const failedRows = importLog.errors;
      if (failedRows.length === 0) {
        throw new ApiError(400, 'No failed rows to retry');
      }

      // Create new import for retry
      const newImport = new ImportLog({
        imported_by: userId,
        file_name: `retry_${importLog.file_name}`,
        total_rows: failedRows.length,
        import_type: importLog.import_type,
        status: 'processing',
        started_at: new Date()
      });
      await newImport.save();

      const results = {
        success: 0,
        skipped: 0,
        errors: []
      };

      for (let i = 0; i < failedRows.length; i++) {
        try {
          const row = failedRows[i].data;
          const validation = this.validateTransformerRow(row);
          
          if (!validation.valid) {
            results.skipped++;
            results.errors.push({
              row: i + 1,
              message: validation.error,
              data: row
            });
            continue;
          }

          await TransformerService.createTransformer(row, userId);
          results.success++;
        } catch (error) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            message: error.message,
            data: failedRows[i].data
          });
        }
      }

      newImport.success_count = results.success;
      newImport.skip_count = results.skipped;
      newImport.error_count = results.errors.length;
      newImport.errors = results.errors.slice(0, 100);
      newImport.status = 'completed';
      newImport.completed_at = new Date();
      await newImport.save();

      return {
        importId: newImport._id,
        ...results
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error retrying import:', error);
      throw new ApiError(500, 'Failed to retry import');
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats(userId) {
    try {
      const stats = await ImportLog.aggregate([
        { $match: { imported_by: userId } },
        {
          $group: {
            _id: null,
            totalImports: { $sum: 1 },
            totalRows: { $sum: '$total_rows' },
            totalSuccess: { $sum: '$success_count' },
            totalSkipped: { $sum: '$skip_count' },
            totalErrors: { $sum: '$error_count' }
          }
        }
      ]);

      const byStatus = await ImportLog.aggregate([
        { $match: { imported_by: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        ...(stats[0] || {
          totalImports: 0,
          totalRows: 0,
          totalSuccess: 0,
          totalSkipped: 0,
          totalErrors: 0
        }),
        byStatus
      };
    } catch (error) {
      logger.error('Error getting import stats:', error);
      throw new ApiError(500, 'Failed to get import statistics');
    }
  }
}

module.exports = new ImportService();