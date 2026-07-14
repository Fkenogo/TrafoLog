require('dotenv').config();

const request = require('supertest');
const app = require('../app');
const database = require('../config/database');
const AuthService = require('../services/authService');
const User = require('../models/User');
const Session = require('../models/Session');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

const TEST_EMAIL = 'railway-login-regression@example.com';
const TEST_PASSWORD = 'Regression@1234';

describe('Railway login regression', () => {
  let user;
  let originalJwtSecret;
  let originalRefreshSecret;

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET;
    originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
    await database.connect();

    await User.deleteOne({ email: TEST_EMAIL });
    user = await User.create({
      name: 'Railway Login Regression',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: 'Super Admin',
      is_active: true,
      login_attempts: 2,
      last_login: new Date('2026-01-01T00:00:00.000Z')
    });
  });

  beforeEach(async () => {
    await Promise.all([
      Session.deleteMany({ user_id: user._id }),
      RefreshToken.deleteMany({ user_id: user._id }),
      AuditLog.deleteMany({ user_id: user._id })
    ]);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          login_attempts: 2,
          last_login: new Date('2026-01-01T00:00:00.000Z'),
          is_active: true
        },
        $unset: { lock_until: 1 }
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;

    if (originalRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
  });

  afterAll(async () => {
    if (user) {
      await Promise.all([
        Session.deleteMany({ user_id: user._id }),
        RefreshToken.deleteMany({ user_id: user._id }),
        AuditLog.deleteMany({ user_id: user._id }),
        User.deleteOne({ _id: user._id })
      ]);
    }

    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;

    if (originalRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
    else process.env.JWT_REFRESH_SECRET = originalRefreshSecret;

    await database.disconnect();
  });

  test('a token-issuance failure is diagnosed safely and creates no partial auth state', async () => {
    const passwordUser = await User.findById(user._id).select('+password');
    expect(passwordUser.is_active).toBe(true);
    expect(await passwordUser.comparePassword(TEST_PASSWORD)).toBe(true);

    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const logSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(AuthService.login(
      TEST_EMAIL,
      TEST_PASSWORD,
      'Railway regression test',
      '203.0.113.10'
    )).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to login'
    });

    const reloadedUser = await User.findById(user._id);
    expect(reloadedUser.login_attempts).toBe(2);
    expect(reloadedUser.last_login.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    await expect(Promise.all([
      Session.countDocuments({ user_id: user._id }),
      RefreshToken.countDocuments({ user_id: user._id }),
      AuditLog.countDocuments({ user_id: user._id })
    ])).resolves.toEqual([0, 0, 0]);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message, diagnostic] = logSpy.mock.calls[0];
    expect(message).toBe('Auth login stage failed');
    expect(diagnostic).toMatchObject({
      stage: 'auth.login.issue_access_token',
      error: {
        name: 'Error'
      }
    });

    const serializedDiagnostic = JSON.stringify(diagnostic);
    expect(serializedDiagnostic).not.toContain(TEST_PASSWORD);
    expect(serializedDiagnostic).not.toContain(originalJwtSecret || 'never-present-secret');

    logSpy.mockRestore();
  });

  test('a later session failure removes only artifacts created by the current attempt', async () => {
    process.env.JWT_SECRET = 'login-regression-test-secret';
    delete process.env.JWT_REFRESH_SECRET;

    const existingRefreshToken = await RefreshToken.create({
      user_id: user._id,
      token: `pre-existing-refresh-${user._id}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      user_agent: 'Existing test artifact',
      ip_address: '198.51.100.10'
    });
    const existingSession = await Session.create({
      user_id: user._id,
      session_token: `pre-existing-session-${user._id}`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      user_agent: 'Existing test artifact',
      ip_address: '198.51.100.10'
    });

    jest.spyOn(Session.prototype, 'save')
      .mockRejectedValueOnce(new Error('simulated session persistence failure'));
    const logSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    await expect(AuthService.login(
      TEST_EMAIL,
      TEST_PASSWORD,
      'Railway regression test',
      '203.0.113.10'
    )).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to login'
    });

    await expect(Promise.all([
      Session.countDocuments({ user_id: user._id }),
      RefreshToken.countDocuments({ user_id: user._id }),
      AuditLog.countDocuments({ user_id: user._id })
    ])).resolves.toEqual([1, 1, 0]);
    await expect(Promise.all([
      Session.exists({ _id: existingSession._id }),
      RefreshToken.exists({ _id: existingRefreshToken._id })
    ])).resolves.toEqual([expect.anything(), expect.anything()]);

    const reloadedUser = await User.findById(user._id);
    expect(reloadedUser.login_attempts).toBe(2);
    expect(reloadedUser.last_login.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    const diagnosticCall = logSpy.mock.calls.find(
      ([message]) => message === 'Auth login stage failed'
    );
    expect(diagnosticCall?.[1]).toMatchObject({
      stage: 'auth.login.create_session'
    });
    expect(JSON.stringify(diagnosticCall?.[1])).not.toContain(
      'simulated session persistence failure'
    );
  });

  test('one successful login creates exactly one session and one refresh token', async () => {
    process.env.JWT_SECRET = 'login-regression-test-secret';
    delete process.env.JWT_REFRESH_SECRET;

    const result = await AuthService.login(
      TEST_EMAIL,
      TEST_PASSWORD,
      'Railway regression test',
      '203.0.113.10'
    );

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.sessionToken).toEqual(expect.any(String));
    await expect(Promise.all([
      Session.countDocuments({ user_id: user._id }),
      RefreshToken.countDocuments({ user_id: user._id }),
      AuditLog.countDocuments({ user_id: user._id, action: 'LOGIN' })
    ])).resolves.toEqual([1, 1, 1]);

    const reloadedUser = await User.findById(user._id);
    expect(reloadedUser.login_attempts).toBe(0);
    expect(reloadedUser.last_login.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00.000Z').getTime()
    );
  });

  test('the HTTP client receives a generic error without internal configuration details', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    jest.spyOn(logger, 'error').mockImplementation(() => {});

    const response = await request(app.getApp())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Failed to login'
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /JWT_SECRET|secretOrPrivateKey|Regression@1234/i
    );
  });
});
