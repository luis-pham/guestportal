#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const adminUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:3001';

function start(command, env = {}) {
  return spawn(command, {
    shell: true,
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`Service not ready: ${url}`);
}

const children = [];

try {
  const api = start('pnpm --filter @guestportal/api start', {
    PORT: '4000',
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://guestportal:guestportal@127.0.0.1:5432/guestportal',
    AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345',
  });
  children.push(api);

  const admin = start('pnpm --filter @guestportal/admin-web start', {
    PORT: '3001',
    NEXT_PUBLIC_API_URL: apiUrl,
  });
  children.push(admin);

  await waitFor(`${apiUrl}/health`);
  await waitFor(adminUrl);

  const install = spawnSync('pnpm --filter @guestportal/admin-web test:e2e:install', {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  process.stdout.write(install.stdout ?? '');
  process.stderr.write(install.stderr ?? '');

  const e2e = spawnSync('pnpm --filter @guestportal/admin-web test:e2e', {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      ADMIN_WEB_URL: adminUrl,
      NEXT_PUBLIC_API_URL: apiUrl,
    },
  });
  process.stdout.write(e2e.stdout ?? '');
  process.stderr.write(e2e.stderr ?? '');
  if ((e2e.status ?? 1) !== 0) {
    process.exit(e2e.status ?? 1);
  }
} finally {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}
