#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const adminUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:3101';
const staffUrl = process.env.STAFF_WEB_URL ?? 'http://127.0.0.1:3002';

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
  children.push(
    start('pnpm --filter @guestportal/admin-web start', {
      PORT: '3101',
      NEXT_PUBLIC_API_URL: apiUrl,
    }),
  );
  children.push(
    start('pnpm --filter @guestportal/staff-web start', {
      PORT: '3002',
      NEXT_PUBLIC_API_URL: apiUrl,
    }),
  );

  await waitFor(`${apiUrl}/health`);
  await waitFor(`${adminUrl}/en/login`);
  await waitFor(`${staffUrl}/en/login`);

  const admin = spawnSync('pnpm --filter @guestportal/admin-web exec playwright test e2e/i18n.spec.ts', {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ADMIN_WEB_URL: adminUrl, NEXT_PUBLIC_API_URL: apiUrl },
  });
  process.stdout.write(admin.stdout ?? '');
  process.stderr.write(admin.stderr ?? '');
  if ((admin.status ?? 1) !== 0) exitCode = admin.status ?? 1;

  const staff = spawnSync('pnpm --filter @guestportal/staff-web exec playwright test e2e/i18n.spec.ts', {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, STAFF_WEB_URL: staffUrl, NEXT_PUBLIC_API_URL: apiUrl },
  });
  process.stdout.write(staff.stdout ?? '');
  process.stderr.write(staff.stderr ?? '');
  if ((staff.status ?? 1) !== 0) exitCode = staff.status ?? 1;
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  for (const child of children) stop(child);
  await sleep(500);
  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        // gone
      }
    }
  }
}

process.exit(exitCode);
