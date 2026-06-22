const Joi = require('joi');

/**
 * Create maintenance schema
 */
const createMaintenanceSchema = Joi.object({
  transformer_id: Joi.string()
    .required()
    .messages({
      'any.required': 'Transformer ID is required',
      'string.empty': 'Transformer ID cannot be empty'
    }),
  
  maintenance_date: Joi.date()
    .default(Date.now)
    .max('now')
    .messages({
      'date.max': 'Maintenance date cannot be in the future'
    }),
  
  maintenance_type: Joi.string()
    .required()
    .valid('Preventive', 'Corrective', 'Emergency')
    .messages({
      'any.required': 'Maintenance type is required',
      'any.only': 'Invalid maintenance type'
    }),
  
  team_contractor: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Team/contractor cannot exceed 100 characters'
    }),
  
  supervised_by: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Supervised by cannot exceed 100 characters'
    }),
  
  work_order_number: Joi.string()
    .optional()
    .max(50)
    .trim()
    .messages({
      'string.max': 'Work order number cannot exceed 50 characters'
    }),
  
  work_performed: Joi.object({
    oil_top_up: Joi.object({
      performed: Joi.boolean().default(false),
      litres_added: Joi.number()
        .optional()
        .min(0)
        .when('performed', {
          is: true,
          then: Joi.required()
        })
        .messages({
          'number.min': 'Litres added cannot be negative',
          'any.required': 'Litres added is required when oil top-up is performed'
        })
    }).default({
      performed: false,
      litres_added: 0
    }),
    
    oil_replacement: Joi.boolean().default(false),
    oil_filtration: Joi.boolean().default(false),
    silica_gel_replaced: Joi.boolean().default(false),
    bushing_replacement: Joi.boolean().default(false),
    tap_changer_service: Joi.boolean().default(false),
    cooling_system_service: Joi.boolean().default(false),
    physical_cleaning: Joi.boolean().default(false),
    painting: Joi.boolean().default(false),
    earthing_repair: Joi.boolean().default(false),
    other_work: Joi.string()
      .optional()
      .max(500)
      .trim()
      .messages({
        'string.max': 'Other work description cannot exceed 500 characters'
      })
  }).optional(),
  
  parts_used: Joi.array()
    .items(
      Joi.object({
        part: Joi.string()
          .required()
          .max(100)
          .trim()
          .messages({
            'any.required': 'Part name is required',
            'string.empty': 'Part name cannot be empty',
            'string.max': 'Part name cannot exceed 100 characters'
          }),
        quantity: Joi.number()
          .required()
          .min(1)
          .messages({
            'any.required': 'Quantity is required',
            'number.min': 'Quantity must be at least 1'
          }),
        unit: Joi.string()
          .optional()
          .max(20)
          .trim()
          .default('piece')
          .messages({
            'string.max': 'Unit cannot exceed 20 characters'
          }),
        serial_number: Joi.string()
          .optional()
          .max(50)
          .trim()
          .messages({
            'string.max': 'Serial number cannot exceed 50 characters'
          }),
        manufacturer: Joi.string()
          .optional()
          .max(100)
          .trim()
          .messages({
            'string.max': 'Manufacturer cannot exceed 100 characters'
          }),
        cost: Joi.number()
          .optional()
          .min(0)
          .messages({
            'number.min': 'Cost cannot be negative'
          }),
        notes: Joi.string()
          .optional()
          .max(200)
          .trim()
          .messages({
            'string.max': 'Notes cannot exceed 200 characters'
          })
      })
    )
    .optional(),
  
  pre_maintenance_load: Joi.object({
    phase_a: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Phase A load cannot be negative'
      }),
    phase_b: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Phase B load cannot be negative'
      }),
    phase_c: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Phase C load cannot be negative'
      })
  }).optional(),
  
  pre_maintenance_notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Pre-maintenance notes cannot exceed 500 characters'
    }),
  
  post_condition_narrative: Joi.string()
    .optional()
    .max(2000)
    .trim()
    .messages({
      'string.max': 'Post-maintenance condition narrative cannot exceed 2000 characters'
    }),
  
  post_maintenance_load: Joi.object({
    phase_a: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Phase A load cannot be negative'
      }),
    phase_b: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Phase B load cannot be negative'
      }),
    phase_c: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'Phase C load cannot be negative'
      })
  }).optional(),
  
  post_maintenance_readings: Joi.object({
    voltage_hv: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'HV voltage cannot be negative'
      }),
    voltage_lv: Joi.number()
      .optional()
      .min(0)
      .messages({
        'number.min': 'LV voltage cannot be negative'
      }),
    oil_temperature: Joi.number()
      .optional()
      .min(-20)
      .max(150)
      .messages({
        'number.min': 'Oil temperature must be at least -20°C',
        'number.max': 'Oil temperature cannot exceed 150°C'
      }),
    ambient_temperature: Joi.number()
      .optional()
      .min(-20)
      .max(60)
      .messages({
        'number.min': 'Ambient temperature must be at least -20°C',
        'number.max': 'Ambient temperature cannot exceed 60°C'
      })
  }).optional(),
  
  completed_by: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Completed by cannot exceed 100 characters'
    }),
  
  reviewed_by: Joi.string()
    .optional()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Reviewed by cannot exceed 100 characters'
    }),
  
  reviewed_at: Joi.date()
    .optional()
    .max('now')
    .messages({
      'date.max': 'Review date cannot be in the future'
    }),
  
  review_notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Review notes cannot exceed 500 characters'
    }),
  
  next_maintenance_date: Joi.date()
    .optional()
    .greater('now')
    .messages({
      'date.greater': 'Next maintenance date must be in the future'
    }),
  
  next_maintenance_notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Next maintenance notes cannot exceed 500 characters'
    }),
  
  total_cost: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'Total cost cannot be negative'
    }),
  
  parts_cost: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'Parts cost cannot be negative'
    }),
  
  labour_cost: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'Labour cost cannot be negative'
    })
});

/**
 * Update maintenance schema
 */
const updateMaintenanceSchema = Joi.object({
  maintenance_date: Joi.date()
    .max('now')
    .messages({
      'date.max': 'Maintenance date cannot be in the future'
    }),
  
  maintenance_type: Joi.string()
    .valid('Preventive', 'Corrective', 'Emergency')
    .messages({
      'any.only': 'Invalid maintenance type'
    }),
  
  team_contractor: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Team/contractor cannot exceed 100 characters'
    }),
  
  supervised_by: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Supervised by cannot exceed 100 characters'
    }),
  
  work_performed: Joi.object({
    oil_top_up: Joi.object({
      performed: Joi.boolean(),
      litres_added: Joi.number()
        .optional()
        .min(0)
        .messages({
          'number.min': 'Litres added cannot be negative'
        })
    }),
    oil_replacement: Joi.boolean(),
    oil_filtration: Joi.boolean(),
    silica_gel_replaced: Joi.boolean(),
    bushing_replacement: Joi.boolean(),
    tap_changer_service: Joi.boolean(),
    cooling_system_service: Joi.boolean(),
    physical_cleaning: Joi.boolean(),
    painting: Joi.boolean(),
    earthing_repair: Joi.boolean(),
    other_work: Joi.string()
      .max(500)
      .trim()
      .messages({
        'string.max': 'Other work description cannot exceed 500 characters'
      })
  }).optional(),
  
  parts_used: Joi.array()
    .items(
      Joi.object({
        part: Joi.string()
          .max(100)
          .trim()
          .messages({
            'string.max': 'Part name cannot exceed 100 characters'
          }),
        quantity: Joi.number()
          .min(1)
          .messages({
            'number.min': 'Quantity must be at least 1'
          }),
        unit: Joi.string()
          .max(20)
          .trim()
          .messages({
            'string.max': 'Unit cannot exceed 20 characters'
          }),
        serial_number: Joi.string()
          .max(50)
          .trim()
          .messages({
            'string.max': 'Serial number cannot exceed 50 characters'
          }),
        manufacturer: Joi.string()
          .max(100)
          .trim()
          .messages({
            'string.max': 'Manufacturer cannot exceed 100 characters'
          }),
        cost: Joi.number()
          .min(0)
          .messages({
            'number.min': 'Cost cannot be negative'
          }),
        notes: Joi.string()
          .max(200)
          .trim()
          .messages({
            'string.max': 'Notes cannot exceed 200 characters'
          })
      })
    )
    .optional(),
  
  post_condition_narrative: Joi.string()
    .max(2000)
    .trim()
    .messages({
      'string.max': 'Post-maintenance condition narrative cannot exceed 2000 characters'
    }),
  
  post_maintenance_load: Joi.object({
    phase_a: Joi.number()
      .min(0)
      .messages({
        'number.min': 'Phase A load cannot be negative'
      }),
    phase_b: Joi.number()
      .min(0)
      .messages({
        'number.min': 'Phase B load cannot be negative'
      }),
    phase_c: Joi.number()
      .min(0)
      .messages({
        'number.min': 'Phase C load cannot be negative'
      })
  }).optional(),
  
  reviewed_by: Joi.string()
    .max(100)
    .trim()
    .messages({
      'string.max': 'Reviewed by cannot exceed 100 characters'
    }),
  
  review_notes: Joi.string()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Review notes cannot exceed 500 characters'
    }),
  
  next_maintenance_date: Joi.date()
    .greater('now')
    .messages({
      'date.greater': 'Next maintenance date must be in the future'
    }),
  
  next_maintenance_notes: Joi.string()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Next maintenance notes cannot exceed 500 characters'
    }),
  
  total_cost: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Total cost cannot be negative'
    }),
  
  parts_cost: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Parts cost cannot be negative'
    }),
  
  labour_cost: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Labour cost cannot be negative'
    })
});

/**
 * Maintenance query schema
 */
const maintenanceQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Page must be at least 1',
      'number.integer': 'Page must be a whole number'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
      'number.integer': 'Limit must be a whole number'
    }),
  
  transformer_id: Joi.string()
    .optional(),
  
  maintenance_type: Joi.string()
    .valid('Preventive', 'Corrective', 'Emergency')
    .optional()
    .messages({
      'any.only': 'Invalid maintenance type'
    }),
  
  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Invalid start date'
    }),
  
  endDate: Joi.date()
    .optional()
    .min(Joi.ref('startDate'))
    .messages({
      'date.min': 'End date must be after start date'
    }),
  
  reviewed: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Reviewed must be a boolean'
    })
});

/**
 * Schedule maintenance schema
 */
const scheduleMaintenanceSchema = Joi.object({
  next_maintenance_date: Joi.date()
    .required()
    .greater('now')
    .messages({
      'any.required': 'Next maintenance date is required',
      'date.greater': 'Next maintenance date must be in the future'
    }),
  
  notes: Joi.string()
    .optional()
    .max(500)
    .trim()
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
});

/**
 * Review maintenance schema
 */
const reviewMaintenanceSchema = Joi.object({
  review_notes: Joi.string()
    .required()
    .max(500)
    .trim()
    .messages({
      'any.required': 'Review notes are required',
      'string.empty': 'Review notes cannot be empty',
      'string.max': 'Review notes cannot exceed 500 characters'
    })
});

module.exports = {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  maintenanceQuerySchema,
  scheduleMaintenanceSchema,
  reviewMaintenanceSchema
};