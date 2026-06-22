// test/auth.test.js
const request = require('supertest');
const app = require('../app');

describe('Authentication Tests', () => {
  let accessToken;
  let refreshToken;
  let testUser;
  
  test('Register new user', async () => {
    const res = await request(app)
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
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test@1234'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });
  
  test('Get user profile with token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });
  
  test('Refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });
  
  test('Logout user', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });
  
  test('Protected route without token', async () => {
    const res = await request(app)
      .get('/api/auth/me');
    
    expect(res.statusCode).toBe(401);
  });
});