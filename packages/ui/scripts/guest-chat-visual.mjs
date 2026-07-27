#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const repoRoot = join(pkgRoot, '../..');
const tempDir = join(pkgRoot, '.tmp-guest-chat-visual');
const tempSrc = join(tempDir, 'src');
const outDir = join(repoRoot, 'evidence/phase-06/06.4/screenshots');
const port = 6014;

const scenarios = [
  { name: 'vi-320', locale: 'vi', width: 320, height: 568 },
  { name: 'en-390', locale: 'en', width: 390, height: 844 },
  { name: 'ko-430', locale: 'ko', width: 430, height: 932 },
];

mkdirSync(tempSrc, { recursive: true });
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(tempDir, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guest Chat Visual</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
);

writeFileSync(
  join(tempSrc, 'main.tsx'),
  `import React from 'react';
import { createRoot } from 'react-dom/client';
import { GuestTextChat, type GuestChatMessage } from '../../src/guest/GuestTextChat';
import '../../src/guest/guest-chat.css';

const locale = new URLSearchParams(window.location.search).get('locale') ?? 'vi';
const messages: GuestChatMessage[] = [
  {
    id: 'guest',
    role: 'guest',
    text: locale === 'ko' ? '수건 두 장과 늦은 체크아웃을 부탁드려요.' : 'Can you send two extra towels and check late checkout?',
  },
  {
    id: 'assistant',
    role: 'assistant',
    text: locale === 'ko'
      ? '수건은 바로 보내드릴 수 있고, 늦은 체크아웃은 13:00까지 가능합니다.'
      : 'Housekeeping can bring towels now. Late checkout is available until 13:00.',
    translatedText: locale === 'vi'
      ? 'Bộ phận buồng phòng có thể mang khăn ngay. Trả phòng muộn đến 13:00.'
      : undefined,
    citations: [
      {
        id: 'services',
        label: 'services',
        sourceTitle: locale === 'ko' ? '고객 서비스 안내' : 'Guest Services Guide',
        excerpt: locale === 'ko'
          ? '하우스키핑 요청은 객실로 전달됩니다.'
          : 'Housekeeping requests can be delivered to occupied rooms.',
      },
      {
        id: 'front-desk',
        label: 'front-desk',
        sourceTitle: locale === 'ko' ? '프런트 정책' : 'Front Desk Policy',
        excerpt: locale === 'ko'
          ? '늦은 체크아웃은 객실 상황에 따라 가능합니다.'
          : 'Late checkout depends on room availability.',
      },
    ],
  },
];

createRoot(document.getElementById('root')!).render(
  <GuestTextChat
    locale={locale}
    assistantName="Aurora Assistant"
    connectionState="recovering"
    messages={messages}
    confirmation={{
      id: 'draft',
      kind: locale === 'ko' ? 'order' : 'request',
      title: locale === 'ko' ? '타월 두 장 요청' : 'Two extra towels',
      summary: locale === 'ko'
        ? '객실 1208로 하우스키핑 요청을 보냅니다.'
        : 'Send a housekeeping request to room 1208.',
      expiresAtLabel: '14:30',
      status: 'needs_confirmation',
    }}
    recoveryMessage={locale === 'en' ? 'Reconnecting. Chat history is still here.' : undefined}
    composerValue={locale === 'ko' ? '감사합니다' : 'Thank you'}
  />,
);
`,
);

const server = spawn(
  'pnpm',
  ['exec', 'vite', '--host', '127.0.0.1', '--port', String(port), tempDir],
  {
    cwd: pkgRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_CJS_IGNORE_WARNING: 'true',
    },
  },
);

async function waitReady() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error('Guest chat visual server not ready');
}

try {
  await waitReady();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const scenario of scenarios) {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(`http://127.0.0.1:${port}/?locale=${scenario.locale}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('[data-testid="guest-text-chat"]');
    await page.screenshot({
      path: join(outDir, `chat-${scenario.name}.png`),
      fullPage: true,
    });
  }

  await browser.close();
  console.log(`Wrote guest chat visual snapshots to ${outDir}`);
} finally {
  server.kill('SIGTERM');
  rmSync(tempDir, { recursive: true, force: true });
}
