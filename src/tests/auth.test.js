// test/auth.test.js
const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const redis = require('../config/redis');

describe('Authentication Tests', () => {
  let accessToken;
  let refreshToken;
  let testUser;

  beforeAll(async () => {
    await database.connect();
    await redis.connect();
    // Clean up any test user from previous runs
    const User = require('../models/User');
    await User.deleteOne({ email: 'test@example.com' });
  });

  afterAll(async () => {
    const User = require('../models/User');
    await User.deleteOne({ email: 'test@example.com' });
    await database.disconnect();
    await redis.disconnect();
  });

  test('Register new user', async () => {
    const res = await request(app.getApp())
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@1234',
        confirmPassword: 'Test@1234',
        role: 'Viewer'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.email).toBe('test@example.com');
    testUser = res.body.data.user;
  });

  test('Login user', async () => {
    const res = await request(app.getApp())
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test@1234'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user).toBeDefined();

    accessToken = res.body.data.accessToken;
    // refreshToken is not in JSON body; extract from Set-Cookie header
    const cookies = res.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
    if (refreshCookie) {
      refreshToken = refreshCookie.split('=')[1].split(';')[0];
    }
  });

  test('Get user profile with token', async () => {
    const res = await request(app.getApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });

  test('Refresh token', async () => {
    const res = await request(app.getApp())
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  test('Logout user', async () => {
    const res = await request(app.getApp())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });

  test('Protected route without token', async () => {
    const res = await request(app.getApp())
      .get('/api/auth/me');

    expect(res.statusCode).toBe(401);
  });
});
