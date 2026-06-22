const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');

class BaseService {
  constructor(model, modelName) {
    this.model = model;
    this.modelName = modelName;
  }

  /**
   * Get all records with pagination and filters
   */
  async getAll(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { created_at: -1 },
        populate = [],
        select = null
      } = options;

      const skip = (page - 1) * limit;

      let query = this.model.find(filters);
      
      if (select) {
        query = query.select(select);
      }
      
      if (populate.length) {
        populate.forEach(field => {
          query = query.populate(field);
        });
      }

      const [data, total] = await Promise.all([
        query.skip(skip).limit(limit).sort(sort),
        this.model.countDocuments(filters)
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
      logger.error(`Error in ${this.modelName}.getAll:`, error);
      throw new ApiError(500, `Failed to fetch ${this.modelName}s`);
    }
  }

  /**
   * Get record by ID
   */
  async getById(id, populate = []) {
    try {
      let query = this.model.findById(id);
      
      if (populate.length) {
        populate.forEach(field => {
          query = query.populate(field);
        });
      }

      const record = await query;
      
      if (!record) {
        throw new ApiError(404, `${this.modelName} not found`);
      }
      
      return record;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error(`Error in ${this.modelName}.getById:`, error);
      throw new ApiError(500, `Failed to fetch ${this.modelName}`);
    }
  }

  /**
   * Create a new record
   */
  async create(data, userId = null) {
    try {
      const record = new this.model({
        ...data,
        created_by: userId,
        updated_by: userId
      });
      
      await record.save();
      return record;
    } catch (error) {
      logger.error(`Error in ${this.modelName}.create:`, error);
      throw new ApiError(500, `Failed to create ${this.modelName}`);
    }
  }

  /**
   * Update a record
   */
  async update(id, data, userId = null) {
    try {
      const record = await this.model.findById(id);
      
      if (!record) {
        throw new ApiError(404, `${this.modelName} not found`);
      }
      
      const updated = await this.model.findByIdAndUpdate(
        id,
        {
          ...data,
          updated_by: userId,
          updated_at: new Date()
        },
        {
          new: true,
          runValidators: true
        }
      );
      
      return updated;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error(`Error in ${this.modelName}.update:`, error);
      throw new ApiError(500, `Failed to update ${this.modelName}`);
    }
  }

  /**
   * Delete a record (soft delete)
   */
  async delete(id, userId = null) {
    try {
      const record = await this.model.findById(id);
      
      if (!record) {
        throw new ApiError(404, `${this.modelName} not found`);
      }
      
      record.is_deleted = true;
      record.deleted_at = new Date();
      record.deleted_by = userId;
      
      await record.save();
      return record;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error(`Error in ${this.modelName}.delete:`, error);
      throw new ApiError(500, `Failed to delete ${this.modelName}`);
    }
  }

  /**
   * Hard delete a record
   */
  async hardDelete(id) {
    try {
      const record = await this.model.findByIdAndDelete(id);
      
      if (!record) {
        throw new ApiError(404, `${this.modelName} not found`);
      }
      
      return record;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error(`Error in ${this.modelName}.hardDelete:`, error);
      throw new ApiError(500, `Failed to permanently delete ${this.modelName}`);
    }
  }

  /**
   * Get record count
   */
  async count(filters = {}) {
    try {
      return await this.model.countDocuments(filters);
    } catch (error) {
      logger.error(`Error in ${this.modelName}.count:`, error);
      throw new ApiError(500, `Failed to count ${this.modelName}s`);
    }
  }

  /**
   * Check if record exists
   */
  async exists(filters) {
    try {
      const count = await this.model.countDocuments(filters);
      return count > 0;
    } catch (error) {
      logger.error(`Error in ${this.modelName}.exists:`, error);
      throw new ApiError(500, `Failed to check ${this.modelName} existence`);
    }
  }
}

module.exports = BaseService;