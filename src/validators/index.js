/**
 * Validators Index
 * Exports all validation schemas for the kVAssetTracker API
 */

// Auth Validators
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema
} = require('./authValidator');

// User Validators
const {
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  changeUserRoleSchema,
  activateUserSchema,
  deactivateUserSchema
} = require('./userValidator');

// Transformer Validators
const {
  createTransformerSchema,
  updateTransformerSchema,
  searchTransformerSchema,
  bulkCreateTransformerSchema,
  verifyTransformerSchema,
  decommissionTransformerSchema
} = require('./transformerValidator');

// Inspection Validators
const {
  createInspectionSchema,
  updateInspectionSchema,
  inspectionQuerySchema
} = require('./inspectionValidator');

// Maintenance Validators
const {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  maintenanceQuerySchema,
  scheduleMaintenanceSchema,
  reviewMaintenanceSchema
} = require('./maintenanceValidator');

// Fault Validators
const {
  createFaultSchema,
  updateFaultSchema,
  assignFaultSchema,
  resolveFaultSchema,
  closeFaultSchema,
  escalateFaultSchema,
  faultQuerySchema
} = require('./faultValidator');

// Installation Validators
const {
  createInstallationSchema,
  updateInstallationSchema,
  installationQuerySchema
} = require('./installationValidator');

// Import Validators
const {
  importTransformersSchema,
  importInspectionsSchema,
  importValidationSchema,
  transformerImportRowSchema,
  inspectionImportRowSchema,
  importQuerySchema
} = require('./importValidator');

// Export all validators
module.exports = {
  // Auth Validators
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshTokenSchema,

  // User Validators
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  changeUserRoleSchema,
  activateUserSchema,
  deactivateUserSchema,

  // Transformer Validators
  createTransformerSchema,
  updateTransformerSchema,
  searchTransformerSchema,
  bulkCreateTransformerSchema,
  verifyTransformerSchema,
  decommissionTransformerSchema,

  // Inspection Validators
  createInspectionSchema,
  updateInspectionSchema,
  inspectionQuerySchema,

  // Maintenance Validators
  createMaintenanceSchema,
  updateMaintenanceSchema,
  maintenanceQuerySchema,
  scheduleMaintenanceSchema,
  reviewMaintenanceSchema,

  // Fault Validators
  createFaultSchema,
  updateFaultSchema,
  assignFaultSchema,
  resolveFaultSchema,
  closeFaultSchema,
  escalateFaultSchema,
  faultQuerySchema,

  // Installation Validators
  createInstallationSchema,
  updateInstallationSchema,
  installationQuerySchema,

  // Import Validators
  importTransformersSchema,
  importInspectionsSchema,
  importValidationSchema,
  transformerImportRowSchema,
  inspectionImportRowSchema,
  importQuerySchema
};