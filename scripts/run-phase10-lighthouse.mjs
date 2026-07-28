#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const guestUrl = process.env.GUEST_WEB_URL ?? 'http://127.0.0.1:3000';
const adminUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:3101';
const evidenceDir = process.env.PHASE10_EVIDENCE_DIR ?? 'evidence/phase-10/10.2';
const lighthouseDir = resolve(root, evidenceDir, 'lighthouse');

function loadDotEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function start(command, env = {}) {
  const child = spawn(command, {
    shell: true,
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

function stop(child) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // Already gone.
    }
  }
}

async function waitFor(url, attempts = 90) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.ok || response.status < 500) return;
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`Service not ready: ${url}`);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return { response, body };
}

async function createGuestUrl() {
  const login = await apiFetch('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'owner@aurora.test', password: 'Password123!' }),
  });
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Login did not return a session cookie.');
  const organizationId = login.body.activeOrganizationId;

  const properties = await apiFetch(`/v1/properties?organizationId=${organizationId}`, {
    headers: { cookie },
  });
  const property = properties.body.properties.find((item) => item.slug === 'aurora-city-hotel');
  if (!property) throw new Error('Could not find aurora-city-hotel.');

  const locations = await apiFetch(`/v1/properties/${property.id}/locations`, {
    headers: { cookie },
  });
  const locationId = locations.body.locations[0]?.id;
  if (!locationId) throw new Error('Could not find a location for aurora-city-hotel.');

  const qr = await apiFetch(`/v1/properties/${property.id}/qr-codes`, {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ locationId, destinationType: 'portal_home' }),
  });

  return `${guestUrl}/g/${qr.body.token}`;
}

function run(command, env = process.env) {
  const result = spawnSync(command, { shell: true, cwd: root, stdio: 'inherit', env });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function readScore(file, category) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  return report.categories?.[category]?.score ?? null;
}

async function runLighthouse(name, url) {
  const outputPath = resolve(lighthouseDir, `${name}.json`);
  run(
    `npx --yes lighthouse "${url}" --preset=desktop --only-categories=performance,accessibility,best-practices --quiet --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="${outputPath}"`,
  );
  return {
    name,
    url,
    report: outputPath,
    scores: {
      performance: readScore(outputPath, 'performance'),
      accessibility: readScore(outputPath, 'accessibility'),
      bestPractices: readScore(outputPath, 'best-practices'),
    },
    target: {
      minPerformance: 0.5,
      minAccessibility: 0.9,
      minBestPractices: 0.8,
    },
  };
}

const fileEnv = loadDotEnv();
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}
delete process.env.NODE_ENV;
mkdirSync(lighthouseDir, { recursive: true });

const children = [];
let exitCode = 0;

try {
  run('pnpm --filter @guestportal/api build');
  run('pnpm --filter @guestportal/guest-web build', {
    ...process.env,
    NEXT_PUBLIC_API_URL: apiUrl,
  });
  run('pnpm --filter @guestportal/admin-web build', {
    ...process.env,
    NEXT_PUBLIC_API_URL: apiUrl,
  });

  children.push(
    start('node apps/api/dist/server.js', {
      PORT: '4000',
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://guestportal_app@127.0.0.1:5432/guestportal',
      AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345',
    }),
  );
  children.push(
    start('apps/guest-web/node_modules/.bin/next start apps/guest-web --port 3000', {
      PORT: '3000',
      NEXT_PUBLIC_API_URL: apiUrl,
    }),
  );
  children.push(
    start('apps/admin-web/node_modules/.bin/next start apps/admin-web --port 3101', {
      PORT: '3101',
      NEXT_PUBLIC_API_URL: apiUrl,
    }),
  );

  await waitFor(`${apiUrl}/health`);
  await waitFor(guestUrl);
  await waitFor(`${adminUrl}/vi/login`);

  const guestHomeUrl = await createGuestUrl();
  await waitFor(guestHomeUrl);

  const reports = [
    await runLighthouse('guest-home-desktop', guestHomeUrl),
    await runLighthouse('admin-login-desktop', `${adminUrl}/vi/login`),
  ].map((report) => ({
    ...report,
    passed:
      report.scores.performance >= report.target.minPerformance &&
      report.scores.accessibility >= report.target.minAccessibility &&
      report.scores.bestPractices >= report.target.minBestPractices,
  }));

  const summary = {
    generatedAt: new Date().toISOString(),
    environment: process.env.CI ? 'ci' : 'local',
    reports,
    passed: reports.every((report) => report.passed),
  };
  writeFileSync(resolve(lighthouseDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  exitCode = summary.passed ? 0 : 1;
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  for (const child of children) stop(child);
  process.exitCode = exitCode;
}
