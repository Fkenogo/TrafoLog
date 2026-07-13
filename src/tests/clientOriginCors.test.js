const fs = require('fs');
const path = require('path');
const request = require('supertest');
const {
  DEFAULT_DEVELOPMENT_ORIGIN,
  resolveClientOrigin
} = require('../config/clientOrigin');

const railwayOrigin = 'https://imaginative-art-production-53f9.up.railway.app';
const originalClientUrl = process.env.CLIENT_URL;

process.env.CLIENT_URL = railwayOrigin;
const app = require('../app');

describe('resolveClientOrigin', () => {
  afterAll(() => {
    if (originalClientUrl === undefined) {
      delete process.env.CLIENT_URL;
    } else {
      process.env.CLIENT_URL = originalClientUrl;
    }
  });

  test('uses localhost only as the non-production default', () => {
    expect(DEFAULT_DEVELOPMENT_ORIGIN).toBe('http://localhost:5173');
    expect(resolveClientOrigin({ NODE_ENV: 'development' })).toBe('http://localhost:5173');
    expect(resolveClientOrigin({ NODE_ENV: 'test', CLIENT_URL: '   ' })).toBe('http://localhost:5173');
  });

  test('trims whitespace and normalizes a root trailing slash', () => {
    expect(resolveClientOrigin({
      NODE_ENV: 'production',
      CLIENT_URL: `  ${railwayOrigin}/  `
    })).toBe(railwayOrigin);
  });

  test('returns the exact Railway production origin', () => {
    expect(resolveClientOrigin({
      NODE_ENV: 'production',
      CLIENT_URL: railwayOrigin
    })).toBe(railwayOrigin);
  });

  test.each([
    [{ NODE_ENV: 'production' }, /CLIENT_URL.*required/i],
    [{ NODE_ENV: 'production', CLIENT_URL: '   ' }, /CLIENT_URL.*required/i],
    [{ NODE_ENV: 'production', CLIENT_URL: 'not-a-url' }, /absolute HTTP\/HTTPS origin/i],
    [{ NODE_ENV: 'production', CLIENT_URL: 'ftp://example.com' }, /absolute HTTP\/HTTPS origin/i],
    [{ NODE_ENV: 'production', CLIENT_URL: 'https://user:pass@example.com' }, /credentials/i],
    [{ NODE_ENV: 'production', CLIENT_URL: 'https://example.com/app' }, /origin without a path/i],
    [{ NODE_ENV: 'production', CLIENT_URL: 'https://example.com?mode=preview' }, /query/i],
    [{ NODE_ENV: 'production', CLIENT_URL: 'https://example.com#preview' }, /fragment/i]
  ])('rejects unsafe or non-origin CLIENT_URL %#', (env, message) => {
    expect(() => resolveClientOrigin(env)).toThrow(message);
  });

  test.each([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://[::1]:5173'
  ])('rejects production loopback origin %s', (clientUrl) => {
    expect(() => resolveClientOrigin({
      NODE_ENV: 'production',
      CLIENT_URL: clientUrl
    })).toThrow(/loopback/i);
  });
});

describe('backend CORS integration', () => {
  test('authorizes the configured Railway origin with credentials', async () => {
    const response = await request(app.getApp())
      .options('/api')
      .set('Origin', railwayOrigin)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe(railwayOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('does not authorize an unrelated requesting origin as itself', async () => {
    const unrelatedOrigin = 'https://unrelated.example.com';
    const response = await request(app.getApp())
      .options('/api')
      .set('Origin', unrelatedOrigin)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).not.toBe(unrelatedOrigin);
  });

  test('uses the configured origin in Helmet CSP', async () => {
    const response = await request(app.getApp()).get('/api');

    expect(response.headers['content-security-policy']).toContain(`connect-src 'self' ${railwayOrigin}`);
  });

  test('Socket.IO imports and uses the shared resolver', () => {
    const appSource = fs.readFileSync(
      path.join(__dirname, '../app.js'),
      'utf8'
    );
    const websocketSource = fs.readFileSync(
      path.join(__dirname, '../websocket/index.js'),
      'utf8'
    );

    expect(websocketSource).toContain("require('../config/clientOrigin')");
    expect(websocketSource).toContain('clientOrigin = resolveClientOrigin()');
    expect(appSource).toContain('new WebSocketManager(this.server, this.clientOrigin)');
    expect(websocketSource).not.toContain("process.env.CLIENT_URL || 'http://localhost:5173'");
  });
});
