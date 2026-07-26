#!/usr/bin/env node
import { execSync } from 'node:child_process';

const required = ['guestportal-postgres', 'guestportal-redis', 'guestportal-minio'];

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

try {
  run('docker info');
} catch {
  console.error('Docker is not available. Install/start Docker Desktop and retry.');
  process.exit(2);
}

let failed = false;

for (const name of required) {
  try {
    const status = run(`docker inspect -f '{{.State.Health.Status}}' ${name}`);
    if (status !== 'healthy') {
      console.error(`${name}: ${status}`);
      failed = true;
    } else {
      console.log(`${name}: healthy`);
    }
  } catch {
    console.error(`${name}: missing`);
    failed = true;
  }
}

if (failed) {
  console.error('Docker health check failed. Run: pnpm docker:up');
  process.exit(1);
}

console.log('All local infrastructure containers are healthy.');
