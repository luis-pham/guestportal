#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const guestUrl = process.env.GUEST_WEB_URL ?? 'http://127.0.0.1:3000';

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

const fileEnv = loadDotEnv();
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}
delete process.env.NODE_ENV;

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
  spawnSync('pnpm --filter @guestportal/api build', { shell: true, cwd: root, stdio: 'inherit', env: process.env });
  spawnSync('pnpm --filter @guestportal/guest-web build', {
    shell: true,
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
  });

  children.push(
    start('pnpm --filter @guestportal/api start', {
      PORT: '4000',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://guestportal_app:guestportal@127.0.0.1:5432/guestportal',
      AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345',
    }),
  );
  children.push(
    start('pnpm --filter @guestportal/guest-web start', {
      PORT: '3000',
      NEXT_PUBLIC_API_URL: apiUrl,
    }),
  );

  await waitFor(`${apiUrl}/health`);
  await waitFor(guestUrl);

  const e2e = spawnSync('pnpm --filter @guestportal/guest-web test:e2e', {
    shell: true,
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      GUEST_WEB_URL: guestUrl,
      NEXT_PUBLIC_API_URL: apiUrl,
    },
  });
  exitCode = e2e.status ?? 1;
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  for (const child of children) stop(child);
}

process.exit(exitCode);
