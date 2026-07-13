const RAILWAY_TRUSTED_PROXY_HOPS = 1;

function configureProxyTrust(app, env = process.env) {
  const trustProxy = env.NODE_ENV === 'production'
    ? RAILWAY_TRUSTED_PROXY_HOPS
    : false;

  app.set('trust proxy', trustProxy);
  return trustProxy;
}

module.exports = {
  RAILWAY_TRUSTED_PROXY_HOPS,
  configureProxyTrust
};
