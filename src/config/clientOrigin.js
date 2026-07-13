const DEFAULT_DEVELOPMENT_ORIGIN = 'http://localhost:5173';

function clientUrlError(message) {
  return new Error(`Invalid CLIENT_URL: ${message}`);
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '127.0.0.1'
    || normalized === '::1';
}

function resolveClientOrigin(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configured = typeof env.CLIENT_URL === 'string' ? env.CLIENT_URL.trim() : '';
  const value = configured || (production ? '' : DEFAULT_DEVELOPMENT_ORIGIN);

  if (!value) {
    throw clientUrlError('CLIENT_URL is required in production');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw clientUrlError('expected an absolute HTTP/HTTPS origin');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw clientUrlError('expected an absolute HTTP/HTTPS origin');
  }
  if (parsed.username || parsed.password) {
    throw clientUrlError('credentials are not allowed');
  }
  if (parsed.pathname !== '/') {
    throw clientUrlError('expected an origin without a path');
  }
  if (parsed.search) {
    throw clientUrlError('query parameters are not allowed');
  }
  if (parsed.hash) {
    throw clientUrlError('fragments are not allowed');
  }
  if (production && isLoopbackHostname(parsed.hostname)) {
    throw clientUrlError('loopback origins are not allowed in production');
  }

  return parsed.origin;
}

module.exports = {
  DEFAULT_DEVELOPMENT_ORIGIN,
  resolveClientOrigin
};
