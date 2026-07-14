const DOCUMENTED_PLACEHOLDER_SECRET = 'your_jwt_secret_key';

function authConfigError(message) {
  return new Error(`Invalid JWT configuration: ${message}`);
}

function requireSecret(name, value, { production, allowMissing = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (allowMissing) return null;
    throw authConfigError(`${name} is required`);
  }

  const secret = String(value);
  if (production && secret.trim() === DOCUMENTED_PLACEHOLDER_SECRET) {
    throw authConfigError(`${name} must not use the documented placeholder in production`);
  }

  return secret;
}

function resolveAuthConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const jwtSecret = requireSecret('JWT_SECRET', env.JWT_SECRET, { production });
  const configuredRefreshSecret = requireSecret(
    'JWT_REFRESH_SECRET',
    env.JWT_REFRESH_SECRET,
    { production, allowMissing: true }
  );

  return {
    jwtSecret,
    refreshTokenSecret: configuredRefreshSecret || jwtSecret
  };
}

function validateAuthConfig(env = process.env) {
  return resolveAuthConfig(env);
}

module.exports = {
  DOCUMENTED_PLACEHOLDER_SECRET,
  resolveAuthConfig,
  validateAuthConfig
};
