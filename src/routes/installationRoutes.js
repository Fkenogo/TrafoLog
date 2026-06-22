const express = require('express');
const router = express.Router();
const InstallationController = require('../controllers/installationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { uploadPhotos } = require('../middleware/fileUpload');
const {
  createInstallationSchema,
  installationQuerySchema
} = require('../validators/installationValidator');

/**
 * @route GET /api/installations
 * @desc Get all installations
 * @access Private
 */
router.get(
  '/',
  authenticate,
  validate(installationQuerySchema, 'query'),
  InstallationController.getAll
);

/**
 * @route GET /api/installations/transformer/:transformerId
 * @desc Get installations for a transformer
 * @access Private
 */
router.get(
  '/transformer/:transformerId',
  authenticate,
  InstallationController.getByTransformer
);

/**
 * @route GET /api/installations/:id
 * @desc Get installation by ID
 * @access Private
 */
router.get(
  '/:id',
  authenticate,
  InstallationController.getById
);

/**
 * @route POST /api/installations
 * @desc Create a new installation record
 * @access Private
 */
router.post(
  '/',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer', 'Field Technician'),
  uploadPhotos.fields([
    { name: 'photosBefore', maxCount: 10 },
    { name: 'photosDuring', maxCount: 10 },
    { name: 'photosAfter', maxCount: 10 }
  ]),
  validate(createInstallationSchema),
  InstallationController.create
);

/**
 * @route PUT /api/installations/:id
 * @desc Update installation record
 * @access Private
 */
router.put(
  '/:id',
  authenticate,
  authorize('Super Admin', 'Territory Manager', 'Engineer'),
  uploadPhotos.fields([
    { name: 'photosBefore', maxCount: 10 },
    { name: 'photosDuring', maxCount: 10 },
    { name: 'photosAfter', maxCount: 10 }
  ]),
  validate(createInstallationSchema),
  InstallationController.update
);

/**
 * @route DELETE /api/installations/:id
 * @desc Delete installation record
 * @access Private (Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('Super Admin'),
  InstallationController.delete
);

module.exports = router;