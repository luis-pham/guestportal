#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const repoRoot = join(pkgRoot, '../..');
const outDir = join(repoRoot, 'evidence/phase-02/02.2/screenshots');
const viewports = [
  { name: '360', width: 360, height: 800 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
];

mkdirSync(outDir, { recursive: true });

const build = spawnSync('pnpm', ['exec', 'storybook', 'build', '-o', 'storybook-static'], {
  cwd: pkgRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    STORYBOOK_DISABLE_TELEMETRY: '1',
    DISABLE_TELEMETRY: '1',
  },
});
process.stdout.write(build.stdout ?? '');
process.stderr.write(build.stderr ?? '');
if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

const port = 6006;
const server = spawn(
  'pnpm',
  ['exec', 'http-server', 'storybook-static', '-p', String(port), '-a', '127.0.0.1', '-c-1'],
  { cwd: pkgRoot, stdio: ['ignore', 'pipe', 'pipe'] },
);

async function waitReady() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error('Storybook static server not ready');
}

try {
  await waitReady();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const storyUrl = `http://127.0.0.1:${port}/iframe.html?id=primitives-gallery--default&viewMode=story`;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(storyUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="primitives-gallery"]');
    await page.screenshot({
      path: join(outDir, `gallery-${viewport.name}.png`),
      fullPage: true,
    });
  }

  await browser.close();
  console.log(`Wrote visual snapshots to ${outDir}`);
} finally {
  server.kill('SIGTERM');
}
