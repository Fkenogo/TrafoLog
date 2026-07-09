const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

jest.setTimeout(30000);

const ADMIN_EMAIL = 'admin.users@example.com';
const MANAGER_EMAIL = 'manager.users@example.com';
const TARGET_EMAIL = 'target.users@example.com';
const CREATED_EMAIL = 'created.users@example.com';
const TEST_PASSWORD = 'Admin@1234';

let adminToken;
let managerToken;
let adminId;
let managerId;
let targetId;
let territoryId;
let serviceAreaId;

const userEmails = [ADMIN_EMAIL, MANAGER_EMAIL, TARGET_EMAIL, CREATED_EMAIL];

const authed = (method, path, token = adminToken) => request(app.getApp())
  [method](path)
  .set('Authorization', `Bearer ${token}`);

const expectSafeUser = (user) => {
  expect(user).toBeDefined();
  expect(user).not.toHaveProperty('password');
  expect(user).not.toHaveProperty('refresh_tokens');
  expect(user).not.toHaveProperty('reset_password_token');
  expect(user).not.toHaveProperty('email_verification_token');
  expect(user).not.toHaveProperty('two_factor_secret');
};

beforeAll(async () => {
  await database.connect();
  await redis.connect();

  const oldUsers = await User.find({ email: { $in: userEmails } });
  const oldUserIds = oldUsers.map((user) => user._id);
  await AuditLog.deleteMany({
    $or: [
      { user_id: { $in: oldUserIds } },
      { target_user_id: { $in: oldUserIds } },
      { target_record_id: { $in: oldUserIds } }
    ]
  });
  await User.deleteMany({ email: { $in: userEmails } });

  territoryId = new mongoose.Types.ObjectId();
  serviceAreaId = new mongoose.Types.ObjectId();

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Users Admin',
      email: ADMIN_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Super Admin'
    });

  await request(app.getApp())
    .post('/api/auth/register')
    .send({
      name: 'Users Manager',
      email: MANAGER_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      role: 'Territory Manager',
      territory_id: territoryId
    });

  const adminLogin = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });
  adminToken = adminLogin.body.data.accessToken;

  const managerLogin = await request(app.getApp())
    .post('/api/auth/login')
    .send({ email: MANAGER_EMAIL, password: TEST_PASSWORD });
  managerToken = managerLogin.body.data.accessToken;

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const manager = await User.findOne({ email: MANAGER_EMAIL });
  adminId = admin._id;
  managerId = manager._id;

  const target = await User.create({
    name: 'Target User',
    email: TARGET_EMAIL,
    password: TEST_PASSWORD,
    role: 'Viewer',
    created_by: adminId
  });
  targetId = target._id;
});

afterAll(async () => {
  const users = await User.find({ email: { $in: userEmails } });
  const userIds = users.map((user) => user._id);
  await AuditLog.deleteMany({
    $or: [
      { user_id: { $in: userIds } },
      { target_user_id: { $in: userIds } },
      { target_record_id: { $in: userIds } }
    ]
  });
  await User.deleteMany({ email: { $in: userEmails } });
  await database.disconnect();
  await redis.disconnect();
});

describe('User Management API', () => {
  test('requires authentication', async () => {
    const res = await request(app.getApp()).get('/api/users');

    expect(res.statusCode).toBe(401);
  });

  test('rejects non-Super Admin users', async () => {
    const res = await authed('get', '/api/users', managerToken);

    expect(res.statusCode).toBe(403);
  });

  test('Super Admin can list users with pagination', async () => {
    const res = await authed('get', '/api/users?page=1&limit=2');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: expect.any(Number),
      pages: expect.any(Number)
    });
    res.body.data.forEach(expectSafeUser);
  });

  test('list supports search and role filters', async () => {
    const res = await authed('get', '/api/users?search=target.users&role=Viewer');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((user) => user.email === TARGET_EMAIL)).toBe(true);
    expect(res.body.data.every((user) => user.role === 'Viewer')).toBe(true);
  });

  test('Super Admin can get user by ID', async () => {
    const res = await authed('get', `/api/users/${targetId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(TARGET_EMAIL);
    expectSafeUser(res.body.data);
  });

  test('create user validates required fields', async () => {
    const res = await authed('post', '/api/users')
      .send({
        email: 'invalid-create@example.com',
        role: 'Viewer'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('Super Admin can create user without exposing sensitive fields', async () => {
    const res = await authed('post', '/api/users')
      .send({
        name: 'Created User',
        email: CREATED_EMAIL,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
        role: 'Viewer'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.email).toBe(CREATED_EMAIL);
    expectSafeUser(res.body.data);

    const created = await User.findOne({ email: CREATED_EMAIL }).select('+password');
    expect(created.password).toBeDefined();
    expect(created.password).not.toBe(TEST_PASSWORD);
  });

  test('update user only applies safe fields', async () => {
    const res = await authed('put', `/api/users/${targetId}`)
      .send({
        name: 'Updated Target User',
        preferences: {
          theme: 'dark',
          notifications: { email: false, push: true, sms: false },
          dashboard_widgets: ['users']
        },
        password: 'ShouldNotApply@123'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('Updated Target User');
    expect(res.body.data.preferences.theme).toBe('dark');
    expectSafeUser(res.body.data);

    const targetWithPassword = await User.findById(targetId).select('+password');
    const passwordMatchesUnsafeInput = await targetWithPassword.comparePassword('ShouldNotApply@123');
    expect(passwordMatchesUnsafeInput).toBe(false);
  });

  test('role change works and writes audit log', async () => {
    const res = await authed('post', `/api/users/${targetId}/role`)
      .send({
        role: 'Engineer',
        territory_id: territoryId.toString(),
        service_area_id: serviceAreaId.toString()
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.role).toBe('Engineer');

    const audit = await AuditLog.findOne({
      action: 'USER_ROLE_CHANGE',
      action_category: 'USER_MANAGEMENT',
      target_user_id: targetId
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit.new_values)).not.toContain(TEST_PASSWORD);
  });

  test('invalid role is rejected', async () => {
    const res = await authed('post', `/api/users/${targetId}/role`)
      .send({ role: 'Root Admin' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('deactivate user works and writes audit log', async () => {
    const res = await authed('post', `/api/users/${targetId}/deactivate`)
      .send({ reason: 'No longer assigned to operations' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.is_active).toBe(false);

    const audit = await AuditLog.findOne({
      action: 'USER_DEACTIVATE',
      action_category: 'USER_MANAGEMENT',
      target_user_id: targetId
    });
    expect(audit).not.toBeNull();
  });

  test('activate user works and writes audit log', async () => {
    const res = await authed('post', `/api/users/${targetId}/activate`)
      .send({ notes: 'Returned to operations' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.is_active).toBe(true);

    const audit = await AuditLog.findOne({
      action: 'USER_ACTIVATE',
      action_category: 'USER_MANAGEMENT',
      target_user_id: targetId
    });
    expect(audit).not.toBeNull();
  });

  test('self-deactivation is blocked', async () => {
    const res = await authed('post', `/api/users/${adminId}/deactivate`)
      .send({ reason: 'Should not be allowed' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/own account/i);
  });

  test('self-demotion is blocked', async () => {
    const res = await authed('post', `/api/users/${adminId}/role`)
      .send({ role: 'Viewer' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/own role/i);
  });
});
