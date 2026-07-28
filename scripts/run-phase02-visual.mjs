#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const { chromium } = require(join(root, 'apps/admin-web/node_modules/@playwright/test'));
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const adminUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:3101';
const staffUrl = process.env.STAFF_WEB_URL ?? 'http://127.0.0.1:3002';
const outDir = join(root, 'evidence/phase-02/screenshots');
const taskDir = join(root, 'evidence/phase-02/02.6/screenshots');
mkdirSync(outDir, { recursive: true });
mkdirSync(taskDir, { recursive: true });
mkdirSync(join(root, 'evidence/phase-02/accessibility'), { recursive: true });
mkdirSync(join(root, 'evidence/phase-02/visual'), { recursive: true });
mkdirSync(join(root, 'evidence/phase-02/02.6'), { recursive: true });

function start(command, env = {}) {
  const child = spawn(command, {
    shell: true,
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
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
      // gone
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

async function login(page, base, email) {
  await page.goto(`${base}/en/login`);
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
}

const children = [];
let exitCode = 0;

try {
  children.push(
    start('pnpm --filter @guestportal/api start', {
      PORT: '4000',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://guestportal_app@127.0.0.1:5432/guestportal',
      AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345',
    }),
  );
  children.push(start('pnpm --filter @guestportal/admin-web start', { PORT: '3101', NEXT_PUBLIC_API_URL: apiUrl }));
  children.push(start('pnpm --filter @guestportal/staff-web start', { PORT: '3002', NEXT_PUBLIC_API_URL: apiUrl }));

  await waitFor(`${apiUrl}/health`);
  await waitFor(`${adminUrl}/en/login`);
  await waitFor(`${staffUrl}/en/login`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await login(page, adminUrl, 'owner@aurora.test');
    await page.getByTestId('module-workspace').waitFor();
    const file = `phase02-admin-${width}.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: true });
    copyFileSync(join(outDir, file), join(taskDir, file));
  }

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await login(page, staffUrl, 'staff.hotel@aurora.test');
    await page.getByTestId('staff-workspace').waitFor();
    const file = `phase02-staff-${width}.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: true });
    copyFileSync(join(outDir, file), join(taskDir, file));
  }

  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await login(page, adminUrl, 'owner@aurora.test');
    await page.getByTestId('locale-switch').click();
    await page.getByTestId('long-fixture').waitFor();
    const file = `phase02-admin-vi-${width}.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: true });
    copyFileSync(join(outDir, file), join(taskDir, file));
  }

  await browser.close();

  const visual = spawnSync('pnpm --filter @guestportal/ui test:visual', {
    shell: true,
    cwd: root,
    encoding: 'utf8',
  });
  writeFileSync(join(root, 'evidence/phase-02/02.6/visual.log'), `${visual.stdout ?? ''}${visual.stderr ?? ''}`);
  writeFileSync(join(root, 'evidence/phase-02/visual/ui-gallery.log'), `${visual.stdout ?? ''}${visual.stderr ?? ''}`);
  if ((visual.status ?? 1) !== 0) exitCode = visual.status ?? 1;

  const axeSource = join(root, 'evidence/phase-02/02.2/axe-report.json');
  try {
    copyFileSync(axeSource, join(root, 'evidence/phase-02/accessibility/primitives-axe.json'));
    copyFileSync(axeSource, join(root, 'evidence/phase-02/02.6/axe-report.json'));
  } catch {
    writeFileSync(
      join(root, 'evidence/phase-02/02.6/axe-report.json'),
      `${JSON.stringify({ note: 'Regenerate via UI package axe suite if missing' }, null, 2)}\n`,
    );
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  for (const child of children) stop(child);
  await sleep(500);
}

process.exit(exitCode);
