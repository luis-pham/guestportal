#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = process.cwd();
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:4000';
const adminUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:3101';

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
        'postgresql://guestportal_app:guestportal@127.0.0.1:5432/guestportal',
      AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345',
    }),
  );
  children.push(
    start('pnpm --filter @guestportal/admin-web start', {
      PORT: '3101',
      NEXT_PUBLIC_API_URL: apiUrl,
    }),
  );

  await waitFor(`${apiUrl}/health`);
  await waitFor(`${adminUrl}/en/login`);

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
  exitCode = e2e.status ?? 1;
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
