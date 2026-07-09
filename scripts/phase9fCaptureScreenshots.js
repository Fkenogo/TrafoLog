/**
 * Phase 9F screenshot capture.
 *
 * Captures major frontend workflows for validation evidence. Requires the
 * backend to be available on port 3000 and a Vite frontend URL, defaulting to
 * http://127.0.0.1:5176.
 */
const fs = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_URL = process.env.PHASE9F_FRONTEND_URL || 'http://127.0.0.1:5176';
const ARTIFACT_DIR = path.resolve(__dirname, '../docs/superpowers/reports/phase9f-validation-artifacts');
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');

const credentials = {
  email: 'super.admin@phase9f.io',
  password: 'Phase9F@1234'
};

const pages = [
  ['desktop-dashboard', '/dashboard', { width: 1440, height: 1000 }],
  ['desktop-transformers', '/transformers', { width: 1440, height: 1000 }],
  ['desktop-inspections', '/inspections', { width: 1440, height: 1000 }],
  ['desktop-faults', '/faults', { width: 1440, height: 1000 }],
  ['desktop-maintenance', '/maintenance', { width: 1440, height: 1000 }],
  ['desktop-map', '/map', { width: 1440, height: 1000 }],
  ['desktop-reports', '/reports', { width: 1440, height: 1000 }],
  ['desktop-reference-data', '/reference-data', { width: 1440, height: 1000 }],
  ['desktop-admin-overview', '/admin', { width: 1440, height: 1000 }],
  ['tablet-dashboard', '/dashboard', { width: 834, height: 1112 }],
  ['mobile-dashboard', '/dashboard', { width: 390, height: 844 }]
];

async function waitForSettled(page) {
  await page.waitForLoadState?.('networkidle').catch(() => undefined);
}

async function main() {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const versionResponse = await fetch(`${BASE_URL}/api/version`);
  const versionPayload = await versionResponse.json().catch(() => ({}));
  if (!versionResponse.ok || versionPayload?.success !== true) {
    throw new Error(`Backend preflight failed at ${BASE_URL}/api/version with HTTP ${versionResponse.status}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const browserMetadata = {
    product: await browser.version(),
    userAgent: await browser.userAgent(),
    automatedCoverage: 'Chromium via Puppeteer',
    pilotPrimaryBrowsers: ['Chrome', 'Edge'],
    manualValidationRecommended: ['Safari', 'Firefox']
  };
  const consoleLogs = [];
  page.on('console', (message) => {
    if (['error', 'warning', 'warn'].includes(message.type())) {
      consoleLogs.push({
        type: message.type(),
        text: message.text(),
        location: message.location()
      });
    }
  });
  page.on('pageerror', (error) => {
    consoleLogs.push({ type: 'pageerror', text: error.message });
  });

  try {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[type="email"]', credentials.email);
    await page.type('input[type="password"]', credentials.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => undefined)
    ]);

    const backendPreflight = await page.evaluate(async () => {
      const token = window.localStorage.getItem('kvassettracker.accessToken');
      const response = await fetch('/api/admin/system-stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body };
    });
    if (!backendPreflight.ok) {
      throw new Error(`Authenticated backend preflight failed for /api/admin/system-stats with HTTP ${backendPreflight.status}`);
    }

    const captured = [];
    for (const [name, route, viewport] of pages) {
      await page.setViewport(viewport);
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 900));
      const file = path.join(SCREENSHOT_DIR, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      captured.push(file);
    }

    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const clickedOperations = await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Operations');
      if (!button) return false;
      button.click();
      return true;
    });
    if (clickedOperations) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const file = path.join(SCREENSHOT_DIR, 'desktop-admin-operations.png');
      await page.screenshot({ path: file, fullPage: true });
      captured.push(file);
    }

    await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-console-logs.json'), JSON.stringify(consoleLogs, null, 2));
    await fs.writeFile(path.join(ARTIFACT_DIR, 'browser-preflight.json'), JSON.stringify({ version: versionPayload, admin: backendPreflight, browser: browserMetadata }, null, 2));
    console.log(JSON.stringify({ captured, consoleLogs: consoleLogs.length, preflight: { version: versionPayload.version, adminStatus: backendPreflight.status }, browser: browserMetadata }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
