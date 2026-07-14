const { spawnSync } = require('child_process');
const path = require('path');

const {
  resolveAuthConfig,
  validateAuthConfig
} = require('../config/auth');

describe('authentication configuration', () => {
  test('resolves the required JWT secret and preserves the established refresh-secret fallback', () => {
    expect(resolveAuthConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret'
    })).toEqual({
      jwtSecret: 'test-only-secret',
      refreshTokenSecret: 'test-only-secret'
    });
  });

  test.each([
    [{ NODE_ENV: 'production' }, 'required'],
    [{ NODE_ENV: 'production', JWT_SECRET: '   ' }, 'required'],
    [{ NODE_ENV: 'production', JWT_SECRET: 'your_jwt_secret_key' }, 'placeholder']
  ])('rejects unsafe production JWT configuration clearly', (env, expectedMessage) => {
    expect(() => validateAuthConfig(env)).toThrow(
      new RegExp(`Invalid JWT configuration:.*${expectedMessage}`, 'i')
    );
  });

  test('the production app fails during startup when JWT_SECRET is empty', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', "require('./src/app')"],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          CLIENT_URL: 'https://imaginative-art-production-53f9.up.railway.app',
          JWT_SECRET: ''
        },
        encoding: 'utf8'
      }
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(
      /Invalid JWT configuration:.*JWT_SECRET.*required/i
    );
  });
});
