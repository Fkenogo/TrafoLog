kVAssetTracker - Backend API Documentation
Transformer Asset Registry & Field Maintenance Platform
📋 Table of Contents
Project Overview

Technology Stack

Architecture

Authentication & Authorization

API Endpoints

Data Models

WebSocket Events

Offline-First Strategy

File Uploads

Error Handling

Environment Variables

Getting Started

Testing

Deployment

1. Project Overview
1.1 Product Vision
kVAssetTracker is a web-based transformer asset management platform that gives UEDCL (Uganda Electricity Distribution Company Ltd) complete digital visibility over every transformer in their distribution network — where it is, what condition it is in, and what has been done to it — in real time, without waiting for paper reports.

1.2 Core Design Principle
Every field action automatically creates a digital record. The manager sees everything the moment it happens. No report submission is required — the act of using the app is the report.

1.3 Key Features
✅ Transformer asset registration with GPS mapping

✅ Network voltage classification (11kV and 33kV)

✅ QR code generation for each transformer

✅ Real-time inspection logging

✅ Fault reporting and resolution workflow

✅ Maintenance tracking

✅ Installation and replacement records

✅ Manager dashboard with KPIs and analytics

✅ Offline-first capability for field technicians

✅ Role-based access control (5 user roles)

✅ Bulk data import from Excel/CSV

✅ Report generation (Excel/PDF)

✅ Real-time notifications via WebSocket

2. Technology Stack
2.1 Backend
text
┌─────────────────────────────────────────────────────────┐
│                    TECHNOLOGY STACK                      │
├─────────────────────────────────────────────────────────┤
│  Runtime          │  Node.js 18+                        │
│  Framework        │  Express.js 4.18                   │
│  Database         │  MongoDB 6.0 (Primary)             │
│  Cache            │  Redis 7.2                         │
│  ORM/ODM          │  Mongoose 7.6                      │
│  Authentication   │  JWT + bcryptjs                    │
│  Validation       │  Joi                               │
│  WebSocket        │  Socket.io 4.7                     │
│  File Storage     │  MinIO / AWS S3                    │
│  Logging          │  Winston + Morgan                  │
│  Testing          │  Jest + Supertest                  │
│  Documentation    │  Swagger/OpenAPI 3.0               │
│  Containerization │  Docker + Docker Compose           │
└─────────────────────────────────────────────────────────┘
2.2 Key Dependencies
json
{
  "express": "^4.18.2",
  "mongoose": "^7.6.3",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "joi": "^17.11.0",
  "socket.io": "^4.7.2",
  "multer": "^1.4.5-lts.1",
  "qrcode": "^1.5.3",
  "xlsx": "^0.18.5",
  "pdfkit": "^0.14.0",
  "winston": "^3.11.0",
  "redis": "^4.6.10"
}
3. Architecture
3.1 High-Level Architecture
text
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React PWA)                        │
│  - Offline-First with IndexedDB                                 │
│  - Mapbox GL for mapping                                        │
│  - QR Code scanning                                             │
│  - Push notifications                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY                                │
├─────────────────────────────────────────────────────────────────┤
│  Express.js REST API                                           │
│  - JWT Authentication                                          │
│  - Role-Based Access Control                                   │
│  - Rate Limiting                                               │
│  - Request Validation                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Services:                                                      │
│  - Auth Service                                                │
│  - Transformer Service                                         │
│  - Inspection Service                                          │
│  - Fault Service                                               │
│  - Maintenance Service                                         │
│  - Installation Service                                        │
│  - Notification Service                                        │
│  - Sync Service (Offline)                                      │
│  - Report Service                                              │
│  - Dashboard Service                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  MongoDB (Primary Database)                                    │
│  Redis (Cache Layer)                                          │
│  MinIO/S3 (File Storage)                                      │
└─────────────────────────────────────────────────────────────────┘
3.2 Folder Structure
text
kVAssetTracker-Backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # MongoDB connection
│   │   ├── redis.js         # Redis connection
│   │   └── constants.js     # App constants
│   │
│   ├── models/              # Mongoose models (22 models)
│   │   ├── User.js
│   │   ├── Transformer.js
│   │   ├── Inspection.js
│   │   ├── Fault.js
│   │   ├── Maintenance.js
│   │   ├── Installation.js
│   │   ├── AssetTimeline.js
│   │   ├── AssetPhoto.js
│   │   ├── QRCode.js
│   │   ├── Notification.js
│   │   ├── AuditLog.js
│   │   └── ...
│   │
│   ├── controllers/         # Request handlers (24 controllers)
│   │   ├── authController.js
│   │   ├── transformerController.js
│   │   ├── inspectionController.js
│   │   ├── faultController.js
│   │   ├── dashboardController.js
│   │   └── ...
│   │
│   ├── services/            # Business logic (22 services)
│   │   ├── authService.js
│   │   ├── transformerService.js
│   │   ├── inspectionService.js
│   │   ├── faultService.js
│   │   ├── syncService.js
│   │   └── ...
│   │
│   ├── routes/              # API routes (25 route files)
│   │   ├── authRoutes.js
│   │   ├── transformerRoutes.js
│   │   ├── faultRoutes.js
│   │   └── ...
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # JWT verification
│   │   ├── rbac.js          # Role-based access
│   │   ├── validation.js    # Request validation
│   │   ├── fileUpload.js    # Multer config
│   │   └── errorHandler.js  # Global error handler
│   │
│   ├── validators/          # Joi validation schemas
│   │   ├── authValidator.js
│   │   ├── transformerValidator.js
│   │   └── ...
│   │
│   ├── websocket/           # WebSocket handlers
│   │   ├── index.js         # Main WebSocket manager
│   │   ├── notificationHandler.js
│   │   └── syncHandler.js
│   │
│   ├── utils/               # Utility functions
│   │   ├── helpers.js
│   │   ├── logger.js
│   │   ├── email.js
│   │   ├── qrGenerator.js
│   │   └── ...
│   │
│   ├── jobs/                # Scheduled jobs
│   │   ├── overdueInspectionCheck.js
│   │   └── overloadDetection.js
│   │
│   └── app.js               # Express app entry point
│
├── scripts/                 # Database scripts
│   ├── seed.js              # Seed database
│   ├── migration.js         # Run migrations
│   └── createIndexes.js     # Create database indexes
│
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── uploads/                 # Uploaded files
├── logs/                    # Application logs
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── package.json
4. Authentication & Authorization
4.1 Authentication Flow
text
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User submits email/password                                │
│  2. Server validates credentials                               │
│  3. Server generates:                                          │
│     - Access Token (JWT) - expires in 7 days                  │
│     - Refresh Token - expires in 30 days                      │
│     - Session Token - expires in 7 days                       │
│  4. Tokens stored in HTTP-only cookies                         │
│  5. User receives tokens in response                           │
│                                                                 │
│  Token Refresh:                                                 │
│  1. Client sends Refresh Token                                 │
│  2. Server validates                                           │
│  3. Server generates new Access Token                          │
│  4. Optional: Rotate Refresh Token                             │
│                                                                 │
│  Logout:                                                        │
│  1. Client sends logout request                                │
│  2. Server invalidates session and refresh token               │
│  3. Server clears cookies                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
4.2 User Roles & Permissions
Capability	Super Admin	Territory Manager	Engineer	Field Technician	Viewer
View all transformers	✅	Own Territory	Assigned Area	Assigned Area	✅
Add transformer	✅	✅	✅	✅	❌
Edit transformer	✅	Own Territory	❌	❌	❌
Delete transformer	✅	❌	❌	❌	❌
Log inspection	✅	✅	✅	✅	❌
Log maintenance	✅	✅	✅	✅	❌
Report fault	✅	✅	✅	✅	❌
Assign fault	✅	Own Territory	✅	❌	❌
Resolve fault	✅	✅	✅	✅	❌
Verify transformer	✅	Own Territory	✅	❌	❌
Decommission asset	✅	❌	✅	❌	❌
View manager dashboard	✅	Own Territory	✅	❌	✅
View field dashboard	✅	✅	✅	✅	❌
Manage users	✅	❌	❌	❌	❌
Export reports	✅	Own Territory	❌	❌	✅
Bulk data import	✅	❌	❌	❌	❌
View audit logs	✅	❌	❌	❌	❌
4.3 Authentication Headers
javascript
// Include in all API requests (except auth endpoints)
headers: {
  'Authorization': 'Bearer <access_token>',
  'Content-Type': 'application/json'
}

// Cookies (automatically sent)
// - accessToken (HTTP-only, 7 days)
// - refreshToken (HTTP-only, 30 days)
// - sessionToken (HTTP-only, 7 days)
4.4 Auth Endpoints
Method	Endpoint	Description	Access
POST	/api/auth/register	Register new user	Public
POST	/api/auth/login	Login user	Public
POST	/api/auth/refresh	Refresh access token	Public
POST	/api/auth/logout	Logout user	Private
POST	/api/auth/logout-all	Logout all devices	Private
POST	/api/auth/forgot-password	Request password reset	Public
POST	/api/auth/reset-password	Reset password	Public
POST	/api/auth/verify-email	Verify email	Public
POST	/api/auth/resend-verification	Resend verification email	Public
POST	/api/auth/change-password	Change password	Private
GET	/api/auth/me	Get current user	Private
PUT	/api/auth/me	Update current user	Private
GET	/api/auth/sessions	Get user sessions	Private
DELETE	/api/auth/sessions/:token	Revoke session	Private
5. API Endpoints
5.1 Base URL
text
Development: http://localhost:3000/api
Production: https://api.kVAssetTracker.com/api
5.2 Transformer Management
Method	Endpoint	Description
GET	/transformers	Get all transformers (paginated)
GET	/transformers/:id	Get transformer by ID
GET	/transformers/asset/:assetId	Get transformer by asset ID
GET	/transformers/search	Search transformers
GET	/transformers/nearby	Get nearby transformers (GPS)
GET	/transformers/stats	Get transformer statistics
POST	/transformers	Create transformer
PUT	/transformers/:id	Update transformer
DELETE	/transformers/:id	Delete transformer
POST	/transformers/:id/verify	Verify transformer
POST	/transformers/:id/decommission	Decommission transformer
POST	/transformers/bulk	Bulk create transformers
GET	/transformers/:id/timeline	Get transformer timeline
GET	/transformers/:id/qr	Get transformer QR code
Create Transformer Request Body:

json
{
  "manufacturer": "ABB",
  "serial_number": "SN-2024-001",
  "kva_rating": 315,
  "network_voltage_kv": 11,
  "voltage_secondary": "415V",
  "phase_type": "Three Phase",
  "cooling_type": "ONAN",
  "mounting_type": "Pole Mounted",
  "territory_id": "507f1f77bcf86cd799439011",
  "service_area_id": "507f1f77bcf86cd799439012",
  "district_id": "507f1f77bcf86cd799439013",
  "site_name": "Kiwatule Trading Centre",
  "latitude": 0.3214,
  "longitude": 32.5823,
  "install_date": "2024-01-15",
  "installing_contractor": "UGET Power Ltd"
}
Response:

json
{
  "success": true,
  "message": "Transformer created successfully",
  "data": {
    "asset_id": "TRF-000001",
    "display_rating": "315kVA/11kV",
    "qr_code": "data:image/png;base64,...",
    "operational_status": "Unverified",
    "record_status": "Draft",
    "gps": {
      "type": "Point",
      "coordinates": [32.5823, 0.3214],
      "method": "Field Captured"
    },
    // ... full transformer object
  }
}
5.3 Inspection Management
Method	Endpoint	Description
GET	/inspections	Get all inspections
GET	/inspections/:id	Get inspection by ID
GET	/inspections/transformer/:id	Get inspections for transformer
GET	/inspections/latest/:id	Get latest inspection
GET	/inspections/overdue	Get overdue inspections
POST	/inspections	Create inspection
PUT	/inspections/:id	Update inspection
DELETE	/inspections/:id	Delete inspection
Create Inspection Request Body:

json
{
  "transformer_id": "507f1f77bcf86cd799439011",
  "inspection_date": "2024-06-15T10:30:00Z",
  "visit_type": "Routine Inspection",
  "network_voltage_confirmed": true,
  "kva_rating_confirmed": true,
  "physical": {
    "overall_condition": "Good",
    "rust_corrosion": "Minor",
    "oil_leakage": "None",
    "bushing_condition": "Good",
    "tank_body_damage": "None",
    "cooling_fins_condition": "Good"
  },
  "oil_breather": {
    "oil_level": "Adequate",
    "silica_gel_color": "Blue",
    "oil_test_required": false
  },
  "electrical": {
    "load_current_a": 145.5,
    "load_current_b": 152.3,
    "load_current_c": 148.7,
    "voltage_lv_side": 415
  },
  "site_safety": {
    "security_fencing": "Present",
    "earthing": "Present",
    "warning_signs": "Present",
    "vegetation_encroachment": "Moderate",
    "unauthorised_connections": false
  },
  "condition_narrative": "Transformer in good condition. Minor corrosion on cooling fins.",
  "recommended_action": "Monitor"
}
5.4 Fault Management
Method	Endpoint	Description
GET	/faults	Get all faults
GET	/faults/:id	Get fault by ID
GET	/faults/open	Get open faults
GET	/faults/assigned-to-me	Get faults assigned to current user
GET	/faults/transformer/:id	Get faults for transformer
POST	/faults	Report fault
PUT	/faults/:id/assign	Assign fault
PUT	/faults/:id/resolve	Resolve fault
PUT	/faults/:id/close	Close fault
PUT	/faults/:id/escalate	Escalate fault
Report Fault Request Body:

json
{
  "transformer_id": "507f1f77bcf86cd799439011",
  "fault_description": "Oil leak detected on HV bushing. Oil level dropped to low.",
  "fault_type": "Oil Leak",
  "severity": "Major",
  "fault_source": "Field Observation",
  "customers_affected": 150,
  "area_affected": "Kiwatule Trading Centre"
}
5.5 Maintenance Management
Method	Endpoint	Description
GET	/maintenance	Get all maintenance records
GET	/maintenance/:id	Get maintenance by ID
GET	/maintenance/transformer/:id	Get maintenance for transformer
GET	/maintenance/upcoming	Get upcoming maintenance
POST	/maintenance	Create maintenance record
PUT	/maintenance/:id	Update maintenance
DELETE	/maintenance/:id	Delete maintenance
POST	/maintenance/:id/review	Review maintenance
POST	/maintenance/:id/schedule	Schedule next maintenance
5.6 Installation Management
Method	Endpoint	Description
GET	/installations	Get all installations
GET	/installations/:id	Get installation by ID
GET	/installations/transformer/:id	Get installations for transformer
GET	/installations/history/:id	Get installation history
POST	/installations	Create installation
PUT	/installations/:id	Update installation
DELETE	/installations/:id	Delete installation
5.7 Dashboard
Method	Endpoint	Description
GET	/dashboard/manager	Manager dashboard data
GET	/dashboard/field	Field technician dashboard
GET	/dashboard/kpi	KPI strip data
GET	/dashboard/alerts	Alert panel data
GET	/dashboard/charts	Chart data
GET	/dashboard/decision-tables	Decision support tables
GET	/dashboard/map-data	Map data
Manager Dashboard Response:

json
{
  "success": true,
  "data": {
    "kpi": {
      "total": 1250,
      "active": 980,
      "faulty": 45,
      "underMaintenance": 20,
      "decommissioned": 15,
      "11kV": 850,
      "33kV": 400
    },
    "alerts": {
      "criticalFaults": [...],
      "unresolvedFaults": [...],
      "overloadedTransformers": [...],
      "overdueInspections": [...],
      "pendingVerification": [...]
    },
    "charts": {
      "byTerritory": [...],
      "byNetwork": [...],
      "byKVA": [...],
      "faultTrends": [...],
      "inspectionsComparison": {...}
    },
    "decisionTables": {
      "repairCandidates": [...],
      "replacementCandidates": [...],
      "loadSplitCandidates": [...]
    },
    "mapData": [...]
  }
}
5.8 Reports
Method	Endpoint	Description
GET	/reports/transformers	Generate transformer report
GET	/reports/inspections	Generate inspection report
GET	/reports/faults	Generate fault report
GET	/reports/maintenance	Generate maintenance report
GET	/reports/asset-register	Generate asset register
POST	/reports/export/excel	Export to Excel
POST	/reports/export/pdf	Export to PDF
GET	/reports/exports/:id	Get export status
5.9 Notifications
Method	Endpoint	Description
GET	/notifications	Get user notifications
GET	/notifications/unread/count	Get unread count
PUT	/notifications/:id/read	Mark as read
PUT	/notifications/read-all	Mark all as read
DELETE	/notifications/:id	Delete notification
POST	/notifications/push-token	Register push token
DELETE	/notifications/push-token	Unregister push token
5.10 Sync (Offline)
Method	Endpoint	Description
POST	/sync/offline-queue	Sync offline queue
GET	/sync/transformers	Get transformers for offline cache
POST	/sync/conflicts	Resolve sync conflicts
GET	/sync/status	Get sync status
GET	/sync/pending	Get pending items
6. Data Models
6.1 User Model
javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  role: 'Super Admin' | 'Territory Manager' | 'Engineer' | 'Field Technician' | 'Viewer',
  territory_id: ObjectId (ref: Territory),
  service_area_id: ObjectId (ref: ServiceArea),
  is_active: Boolean,
  last_login: Date,
  email_verified: Boolean,
  push_tokens: [{
    token: String,
    platform: 'web' | 'android' | 'ios'
  }]
}
6.2 Transformer Model
javascript
{
  _id: ObjectId,
  asset_id: String (unique, format: TRF-000001),
  uedcl_reference: String,
  manufacturer: String,
  serial_number: String,
  year_manufactured: Number,
  record_status: 'Draft' | 'Verified' | 'Active',
  
  // Rating
  kva_rating: Number,
  network_voltage_kv: 11 | 33,
  display_rating: String,
  
  // Electrical Specs
  voltage_secondary: '415V' | '240V' | 'Other',
  phase_type: 'Single Phase' | 'Three Phase',
  cooling_type: 'ONAN' | 'ONAF' | 'OFAF',
  mounting_type: 'Pole Mounted' | 'Plinth' | 'Ground' | 'Indoor Substation',
  vector_group: String,
  
  // Location - Operational
  location_operational: {
    territory_id: ObjectId,
    territory_name: String,
    service_area_id: ObjectId,
    service_area_name: String,
    feeder_id: ObjectId,
    feeder_name: String,
    feeder_code: String,
    substation_name: String
  },
  
  // Location - Administrative
  location_administrative: {
    district_id: ObjectId,
    district_name: String,
    sub_county: String,
    parish: String,
    village: String,
    site_name: String
  },
  
  // GPS
  gps: {
    type: 'Point',
    coordinates: [Number, Number], // [longitude, latitude]
    method: 'Field Captured' | 'Imported' | 'Estimated',
    accuracy_metres: Number
  },
  
  // Installation
  installation: {
    install_date: Date,
    installing_contractor: String,
    commissioned_by: String,
    commissioning_date: Date,
    warranty_expiry: Date
  },
  
  // Status
  operational_status: 'Active' | 'Faulty' | 'Under Maintenance' | 'Decommissioned' | 'Unverified',
  has_open_fault: Boolean,
  last_inspection_date: Date,
  last_maintenance_date: Date,
  last_load_reading_date: Date,
  last_load_percentage: Number,
  
  qr_code: String,
  
  created_at: Date,
  updated_at: Date
}
6.3 Inspection Model
javascript
{
  _id: ObjectId,
  transformer_id: ObjectId,
  inspector_id: ObjectId,
  inspection_date: Date,
  visit_type: 'Routine Inspection' | 'Follow-up' | 'Audit',
  network_voltage_confirmed: Boolean,
  kva_rating_confirmed: Boolean,
  rating_discrepancy_flag: Boolean,
  
  physical: {
    overall_condition: 'Good' | 'Fair' | 'Poor' | 'Critical',
    rust_corrosion: 'None' | 'Minor' | 'Severe',
    oil_leakage: 'None' | 'Slow Drip' | 'Active Leak',
    bushing_condition: 'Good' | 'Cracked' | 'Broken',
    tank_body_damage: 'None' | 'Dents' | 'Puncture',
    cooling_fins_condition: 'Good' | 'Damaged' | 'Blocked'
  },
  
  oil_breather: {
    oil_level: 'Full' | 'Adequate' | 'Low' | 'Very Low',
    silica_gel_color: 'Blue' | 'Pink' | 'White',
    oil_test_required: Boolean
  },
  
  electrical: {
    load_current_a: Number,
    load_current_b: Number,
    load_current_c: Number,
    voltage_hv_side: Number,
    voltage_lv_side: Number,
    load_percentage: Number,
    overload_flag: Boolean
  },
  
  site_safety: {
    security_fencing: 'Present' | 'Damaged' | 'Absent',
    earthing: 'Present' | 'Absent',
    warning_signs: 'Present' | 'Absent',
    vegetation_encroachment: 'None' | 'Moderate' | 'Severe',
    unauthorised_connections: Boolean
  },
  
  condition_narrative: String,
  recommended_action: 'No Action' | 'Monitor' | 'Schedule Maintenance' | 'Urgent Repair' | 'Replace'
}
6.4 Fault Model
javascript
{
  _id: ObjectId,
  transformer_id: ObjectId,
  reported_by: ObjectId,
  fault_date: Date,
  fault_source: 'Field Observation' | 'Customer Report' | 'Supervisor',
  fault_description: String,
  fault_type: 'Overload' | 'Oil Leak' | 'Bushing Failure' | 'Winding Failure' | 'Complete Failure' | 'Fire' | 'Theft' | 'Vandalism' | 'LV Side Fault' | 'HV Side Fault' | 'Other',
  severity: 'Minor' | 'Major' | 'Critical' | 'Complete Outage',
  customers_affected: Number,
  area_affected: String,
  
  fault_status: 'Open' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed',
  assigned_to: ObjectId,
  date_assigned: Date,
  target_resolution_date: Date,
  
  resolved_date: Date,
  resolution_description: String,
  root_cause: String,
  parts_replaced: String,
  downtime_hours: Number,
  resolved_by: ObjectId
}
7. WebSocket Events
7.1 Connection
javascript
// Client connection
const socket = io(WS_URL, {
  auth: { token: accessToken },
  transports: ['websocket']
});

// After connection
socket.on('welcome', (data) => {
  console.log('Connected:', data.message);
});
7.2 Events
Event	Direction	Description	Data
notification	Server → Client	New notification	{ id, type, title, message, data, priority }
unread-count-update	Server → Client	Unread count update	{ count }
mark-notification-read	Client → Server	Mark notification as read	{ notificationId }
mark-all-notifications-read	Client → Server	Mark all as read	-
get-notifications	Client → Server	Get notifications	{ page, limit }
get-unread-count	Client → Server	Get unread count	-
sync-request	Client → Server	Sync offline data	{ collection, operation, data }
sync-response	Server → Client	Sync response	{ success, data }
sync-status	Server → Client	Sync status update	{ pending, failed, conflicts }
user-status	Server → Client	User online/offline	{ userId, status }
ping	Client → Server	Keep alive	-
pong	Server → Client	Keep alive response	{ timestamp }
7.3 Example: Receiving Notifications
javascript
socket.on('notification', (data) => {
  // Show notification in UI
  showToast(data.title, data.message);
  
  // Update unread count
  socket.emit('get-unread-count');
});

socket.on('unread-count-update', (data) => {
  // Update badge
  updateBadge(data.count);
});
7.4 Example: Offline Sync
javascript
// When online, sync offline queue
socket.on('connect', () => {
  // Get pending items
  socket.emit('get-pending-syncs');
});

socket.on('pending-syncs', (pending) => {
  // Send each pending item
  pending.forEach(item => {
    socket.emit('sync-request', {
      collection: item.collection,
      operation: item.operation_type,
      recordId: item.record_id,
      data: item.data
    });
  });
});

socket.on('sync-response', (response) => {
  if (response.success) {
    console.log('Sync successful:', response);
  } else {
    console.error('Sync failed:', response.error);
  }
});
8. Offline-First Strategy
8.1 Overview
The backend fully supports offline-first operations for field technicians. When network connectivity is lost, the app continues to function normally using local data.

8.2 How It Works
text
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST STRATEGY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. On Login: Download all transformers for assigned area      │
│  2. Store in IndexedDB (client-side)                           │
│  3. User works offline:                                        │
│     - Search cached transformers                               │
│     - Open transformer profiles                                │
│     - Log inspections (queued)                                 │
│     - Report faults (queued)                                   │
│     - Log maintenance (queued)                                │
│  4. On reconnection:                                          │
│     - Sync queue automatically                                │
│     - Upload photos sequentially                              │
│     - Resolve conflicts if any                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
8.3 Sync API Endpoints
Endpoint	Method	Description
/sync/offline-queue	POST	Sync offline queue data
/sync/transformers	GET	Get transformers for offline cache
/sync/conflicts	POST	Resolve sync conflicts
/sync/status	GET	Get sync status
/sync/pending	GET	Get pending items
8.4 Conflict Resolution
When conflicts occur (same record edited offline and online), the system:

Flags the conflict for admin review

Provides both versions

Allows admin to choose: Server version, Client version, or Merge

9. File Uploads
9.1 Supported File Types
Images: JPEG, PNG, JPG

Excel: .xlsx, .xls

CSV: .csv

PDF: .pdf (reports)

9.2 Size Limits
Photos: Max 10MB per file (compressed to 1MB)

Excel/CSV: Max 50MB

Bulk uploads: Max 100 rows

9.3 Upload Endpoints
Endpoint	Method	Description	File Field
/inspections	POST	Add photos to inspection	photos
/maintenance	POST	Add photos to maintenance	photosBefore, photosAfter
/faults	POST	Add photos to fault	photos
/installations	POST	Add photos to installation	photosBefore, photosDuring, photosAfter
/import/transformers	POST	Import transformers	file
9.4 Upload Example (Multipart Form Data)
javascript
const formData = new FormData();
formData.append('photos', imageFile);
formData.append('transformer_id', '507f1f77bcf86cd799439011');
formData.append('inspection_date', '2024-06-15T10:30:00Z');
// ... other fields

fetch('/api/inspections', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
10. Error Handling
10.1 Response Format
json
{
  "success": false,
  "message": "Error message",
  "timestamp": "2024-06-15T10:30:00Z",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
10.2 HTTP Status Codes
Code	Description
200	Success
201	Created
400	Bad Request (validation error)
401	Unauthorized (authentication required)
403	Forbidden (insufficient permissions)
404	Not Found
409	Conflict
422	Unprocessable Entity
429	Too Many Requests
500	Internal Server Error
10.3 Common Error Messages
Error	Solution
Authentication required. Please login.	Include valid JWT token in Authorization header
Invalid token	Token expired or invalid, refresh or re-login
Insufficient permissions	User role doesn't have access to this resource
Validation failed	Check request body for required fields
Transformer not found	Check transformer ID exists
Duplicate serial number	Transformer with this serial number already exists
Network voltage must be 11 or 33	Invalid network voltage value
Rate limit exceeded	Too many requests, wait and retry
11. Environment Variables
env
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb://localhost:27017/kVAssetTracker
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRY=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
REFRESH_TOKEN_EXPIRY=30d
ROTATE_REFRESH_TOKENS=true

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@kVAssetTracker.com

# File Storage (MinIO/S3)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf

# Logging
LOG_LEVEL=info
12. Getting Started
12.1 Prerequisites
Node.js 18+

MongoDB 6.0+

Redis 7.0+

Docker (optional)

12.2 Installation
bash
# Clone repository
git clone https://github.com/your-org/kVAssetTracker-backend.git
cd kVAssetTracker-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your configuration
nano .env

# Create database indexes
npm run create-indexes

# Seed database with reference data
npm run seed

# Start development server
npm run dev

# Start production server
npm start
12.3 Docker Setup
bash
# Start with Docker Compose
docker-compose up -d

# Build and start
docker-compose up --build -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f api
12.4 Database Scripts
bash
# Seed database
npm run seed

# Run migrations
npm run migrate

# List migrations
npm run migrate:list

# Check migration status
npm run migrate:status

# Create indexes
npm run create-indexes

# List indexes
npm run create-indexes:list

# Validate indexes
npm run create-indexes:validate
13. Testing
13.1 Running Tests
bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
13.2 Test Structure
text
tests/
├── unit/
│   ├── services/
│   │   ├── authService.test.js
│   │   └── transformerService.test.js
│   └── utils/
│       └── helpers.test.js
├── integration/
│   ├── auth.test.js
│   ├── transformers.test.js
│   └── faults.test.js
└── fixtures/
    └── testData.js
13.3 Test Example
javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Auth API', () => {
  test('Login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@kVAssetTracker.com',
        password: 'Admin@1234'
      });
    
    expect(response.statusCode).toBe(200);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.user).toBeDefined();
  });
});
14. Deployment
14.1 Production Build
bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start

# Run with PM2
pm2 start npm --name "kVAssetTracker-api" -- start

# View PM2 logs
pm2 logs kVAssetTracker-api
14.2 Docker Production
bash
# Build Docker image
docker build -t kVAssetTracker-api .

# Run container
docker run -d \
  --name kVAssetTracker-api \
  -p 3000:3000 \
  --env-file .env \
  kVAssetTracker-api
14.3 CI/CD Pipeline (GitHub Actions Example)
yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /var/www/kVAssetTracker
            git pull
            npm ci --production
            pm2 restart kVAssetTracker-api
15. API Documentation
15.1 Swagger UI
Access the interactive API documentation at:

text
http://localhost:3000/api-docs
15.2 Postman Collection
Import the Postman collection from:

text
/docs/postman_collection.json
16. Contact & Support
Resource	Link
API Documentation	/api-docs
Health Check	/health
GitHub Issues	https://github.com/your-org/kVAssetTracker/issues
Support Email	support@kVAssetTracker.com
17. Quick Reference
17.1 Common API Calls
javascript
// Login
POST /api/auth/login
{ "email": "admin@kVAssetTracker.com", "password": "Admin@1234" }

// Get transformers
GET /api/transformers?page=1&limit=20&territory_id=507f...

// Create transformer
POST /api/transformers
{ "manufacturer": "ABB", "kva_rating": 315, ... }

// Report fault
POST /api/faults
{ "transformer_id": "507f...", "fault_description": "...", ... }

// Get dashboard
GET /api/dashboard/manager

// Sync offline data
POST /api/sync/offline-queue
{ "operations": [...] }

// Generate report
GET /api/reports/transformers?startDate=2024-01-01&endDate=2024-12-31
17.2 WebSocket Connection
javascript
const socket = io('ws://localhost:3000', {
  auth: { token: 'your_jwt_token' }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('notification', (data) => {
  console.log('New notification:', data);
});
18. Changelog
v2.0.0 (2024-06-15)
✅ Complete backend implementation

✅ 25+ API endpoints

✅ WebSocket real-time notifications

✅ Offline-first sync

✅ 5 user roles with RBAC

✅ QR code generation

✅ Report generation (Excel/PDF)

✅ Bulk import (Excel/CSV)

✅ Full Swagger documentation

✅ Docker support

✅ Comprehensive test suite

v2.1.0 (Planned)
🔜 Predictive analytics

🔜 AI risk scoring

🔜 GIS system integration

🔜 Work order management

🔜 Preventive maintenance scheduling

🔜 Email/SMS notifications

19. License
This project is proprietary software owned by UEDCL (Uganda Electricity Distribution Company Ltd). Unauthorized use, reproduction, or distribution is strictly prohibited.

Last Updated: June 15, 2024
Version: 2.0.0
Maintained by: UEDCL Technical Team