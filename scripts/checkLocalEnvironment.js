/**
 * Local environment readiness check for kVAssetTracker.
 *
 * Verifies the services and folders a developer needs for the local demo flow.
 */
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const redis = require('redis');
require('dotenv').config();

const ROOT = path.resolve(__dirname, '..');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kVAssetTracker';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const BACKEND_URL = process.env.BACKEND_HEALTH_URL || `${process.env.APP_URL || 'http://localhost:3000'}/health`;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads', 'temp');
const BACKUP_DIR = process.env.BACKUP_LOCAL_DIR || path.join(os.tmpdir(), 'kvassettracker-backups');
const HTTP_TIMEOUT_MS = Number(process.env.LOCAL_ENV_CHECK_TIMEOUT_MS || 3000);

const placeholderValues = new Set(['', 'your_redis_password', 'changeme', 'password']);

function failMessage(error) {
  if (!error) return 'Unknown error';
  return error.message || String(error);
}

function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${HTTP_TIMEOUT_MS}ms`)), HTTP_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function checkMongo() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000,
    maxPoolSize: 1
  });
  await mongoose.connection.db.admin().ping();
}

async function checkRedis() {
  const options = { url: REDIS_URL };
  options.socket = {
    reconnectStrategy: false,
    connectTimeout: HTTP_TIMEOUT_MS
  };
  if (process.env.REDIS_PASSWORD && !placeholderValues.has(process.env.REDIS_PASSWORD)) {
    options.password = process.env.REDIS_PASSWORD;
  }

  const client = redis.createClient(options);
  client.on('error', () => {});
  try {
    await withTimeout(client.connect(), 'Redis connection');
    await withTimeout(client.ping(), 'Redis ping');
  } finally {
    if (client.isOpen) {
      await client.quit().catch(() => client.disconnect());
    }
  }
}

async function checkHttp(name, url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`${name} returned HTTP ${response.status}`);
  }
}

async function checkWritableDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
  const testFile = path.join(dir, `.kvassettracker-check-${process.pid}-${Date.now()}`);
  await fs.writeFile(testFile, 'ok', { flag: 'wx' });
  await fs.unlink(testFile);
}

async function runCheck(name, detail, fn) {
  try {
    await fn();
    return { name, detail, status: 'PASS' };
  } catch (error) {
    return { name, detail, status: 'FAIL', error: failMessage(error) };
  }
}

async function main() {
  const checks = [
    await runCheck('Mongo', MONGODB_URI, checkMongo),
    await runCheck('Redis', REDIS_URL, checkRedis),
    await runCheck('Backend', BACKEND_URL, () => checkHttp('Backend', BACKEND_URL)),
    await runCheck('Frontend', FRONTEND_URL, () => checkHttp('Frontend', FRONTEND_URL)),
    await runCheck('Uploads', UPLOAD_DIR, () => checkWritableDirectory(UPLOAD_DIR)),
    await runCheck('Backup folder', BACKUP_DIR, () => checkWritableDirectory(BACKUP_DIR))
  ];

  await mongoose.disconnect().catch(() => {});

  console.log('=================================');
  console.log('kVAssetTracker Local Environment');
  console.log('=================================');
  for (const check of checks) {
    const label = `${check.status} ${check.name}`.padEnd(22);
    console.log(`${label} ${check.detail}`);
    if (check.error) {
      console.log(`${''.padEnd(22)} ${check.error}`);
    }
  }
  console.log('=================================');

  if (checks.some((check) => check.status === 'FAIL')) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  await mongoose.disconnect().catch(() => {});
  console.error(error);
  process.exitCode = 1;
});
