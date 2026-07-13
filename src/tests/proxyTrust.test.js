const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { configureProxyTrust } = require('../config/proxyTrust');

const RAILWAY_FRONTEND_ORIGIN = 'https://imaginative-art-production-53f9.up.railway.app';

function createIpProbe(env) {
  const app = express();
  configureProxyTrust(app, env);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip, ips: req.ips });
  });
  return app;
}

describe('Railway proxy trust configuration', () => {
  test('production trusts exactly one proxy hop', () => {
    const app = express();

    expect(configureProxyTrust(app, { NODE_ENV: 'production' })).toBe(1);
    expect(app.get('trust proxy')).toBe(1);
  });

  test('production resolves the client IP from the nearest forwarded hop', async () => {
    const app = createIpProbe({ NODE_ENV: 'production' });

    const response = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.99, 198.51.100.27');

    expect(response.statusCode).toBe(200);
    expect(response.body.ip).toBe('198.51.100.27');
    expect(response.body.ip).not.toBe('203.0.113.99');
  });

  test('development keeps proxy trust disabled and ignores arbitrary forwarded IPs', async () => {
    const app = createIpProbe({ NODE_ENV: 'development' });

    const response = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.99');

    expect(app.get('trust proxy')).toBe(false);
    expect(response.statusCode).toBe(200);
    expect(response.body.ip).not.toBe('203.0.113.99');
    expect(response.body.ips).toEqual([]);
  });
});

describe('production application behind the Railway proxy', () => {
  let app;
  let originalNodeEnv;
  let originalClientUrl;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalClientUrl = process.env.CLIENT_URL;
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = RAILWAY_FRONTEND_ORIGIN;

    jest.resetModules();
    app = require('../app').getApp();
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalClientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = originalClientUrl;
  });

  test('configures proxy trust before serving requests', () => {
    expect(app.get('trust proxy')).toBe(1);
  });

  test('login preflight remains authorized for the Railway frontend', async () => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', RAILWAY_FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(RAILWAY_FRONTEND_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('a proxied login request proceeds without proxy validation failure', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', RAILWAY_FRONTEND_ORIGIN)
      .set('X-Forwarded-For', '198.51.100.20')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.statusCode).not.toBe(500);
    expect(response.body.message).not.toMatch(/X-Forwarded-For|trust proxy/i);
  });

  test('login rate limiting remains active behind the proxy', async () => {
    const statuses = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.21')
        .send({});
      statuses.push(response.statusCode);
    }

    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses[5]).toBe(429);
  });

  test('refresh and health endpoints do not regress behind the proxy', async () => {
    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('X-Forwarded-For', '198.51.100.22')
      .send({});
    const healthResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '198.51.100.22');

    expect(refreshResponse.statusCode).toBe(401);
    expect(healthResponse.statusCode).not.toBe(500);
    expect(healthResponse.body.status).toBe('healthy');
  });

  test('auth limiters retain express-rate-limit proxy validation', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../middleware/authRateLimiter.js'),
      'utf8'
    );

    expect(source).not.toMatch(/xForwardedForHeader\s*:\s*false/);
    expect(source).not.toMatch(/validate\s*:\s*false/);
  });
});
