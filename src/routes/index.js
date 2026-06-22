const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const transformerRoutes = require('./transformerRoutes');
const inspectionRoutes = require('./inspectionRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');
const faultRoutes = require('./faultRoutes');
const installationRoutes = require('./installationRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reportRoutes = require('./reportRoutes');
const importRoutes = require('./importRoutes');
const notificationRoutes = require('./notificationRoutes');
const timelineRoutes = require('./timelineRoutes');
const syncRoutes = require('./syncRoutes');
const adminRoutes = require('./adminRoutes');
const territoryRoutes = require('./territoryRoutes');
const serviceAreaRoutes = require('./serviceAreaRoutes');
const feederRoutes = require('./feederRoutes');
const districtRoutes = require('./districtRoutes');
const ratingRoutes = require('./ratingRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const exportRoutes = require('./exportRoutes');
const auditRoutes = require('./auditRoutes');
const qrRoutes = require('./qrRoutes');
const geoRoutes = require('./geoRoutes');

/**
 * @route GET /api/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../../package.json').version
  });
});

/**
 * @route GET /api/version
 * @desc API version information
 * @access Public
 */
router.get('/version', (req, res) => {
  res.status(200).json({
    success: true,
    version: '2.0.0',
    build: process.env.BUILD_NUMBER || 'development',
    release_date: '2024-01-15',
    api: {
      name: 'kVAssetTracker API',
      description: 'Transformer Asset Management Platform'
    }
  });
});

// Mount all route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/transformers', transformerRoutes);
router.use('/inspections', inspectionRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/faults', faultRoutes);
router.use('/installations', installationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/import', importRoutes);
router.use('/notifications', notificationRoutes);
router.use('/timeline', timelineRoutes);
router.use('/sync', syncRoutes);
router.use('/admin', adminRoutes);
router.use('/territories', territoryRoutes);
router.use('/service-areas', serviceAreaRoutes);
router.use('/feeders', feederRoutes);
router.use('/districts', districtRoutes);
router.use('/ratings', ratingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/exports', exportRoutes);
router.use('/audit', auditRoutes);
router.use('/qr', qrRoutes);
router.use('/geo', geoRoutes);

/**
 * @route GET /api
 * @desc API root with available endpoints
 * @access Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'kVAssetTracker API v2.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      transformers: '/api/transformers',
      inspections: '/api/inspections',
      maintenance: '/api/maintenance',
      faults: '/api/faults',
      installations: '/api/installations',
      dashboard: '/api/dashboard',
      reports: '/api/reports',
      import: '/api/import',
      notifications: '/api/notifications',
      timeline: '/api/timeline',
      sync: '/api/sync',
      admin: '/api/admin',
      territories: '/api/territories',
      serviceAreas: '/api/service-areas',
      feeders: '/api/feeders',
      districts: '/api/districts',
      ratings: '/api/ratings',
      analytics: '/api/analytics',
      exports: '/api/exports',
      audit: '/api/audit',
      qr: '/api/qr',
      geo: '/api/geo'
    },
    documentation: `${req.protocol}://${req.get('host')}/api-docs`,
    health: `${req.protocol}://${req.get('host')}/api/health`
  });
});

// 404 handler for any routes not matched above
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    timestamp: new Date().toISOString(),
    available_endpoints: '/api for list of all endpoints'
  });
});

module.exports = router;