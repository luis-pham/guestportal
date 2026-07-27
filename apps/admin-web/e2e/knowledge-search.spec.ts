import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidenceRoot = fileURLToPath(
  new URL('../../../evidence/phase-05/05.6', import.meta.url),
);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const sourceTitle = `Retrieval Smoke ${Date.now()}`;
const sourceNeedle = `heliotrope-${Date.now()}`;
const sourceBody = [
  '# Operations Guide',
  '',
  'The rooftop pool opens from 06:00 to 21:30 every day.',
  `The rooftop pool lookup marker is ${sourceNeedle}.`,
  'Breakfast is served from 06:30 to 09:30 in the Garden Room.',
  'Guests can request extra towels through the QR portal.',
].join('\n');

async function ensureDir(path: string) {
  await mkdir(dirname(path), { recursive: true });
}

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible({ timeout: 30_000 });
}

async function signInApi() {
  const response = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@aurora.test',
      password: 'Password123!',
    }),
  });
  expect(response.ok).toBe(true);
  const cookie = response.headers.get('set-cookie')?.match(/gp_session=[^;]+/)?.[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

async function currentPropertyId(page: Page) {
  await page.getByRole('link', { name: 'Property settings' }).click();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();
  return propertyId!;
}

async function createEmptyProperty() {
  const apiCookie = await signInApi();
  const organizations = await fetch(`${API_URL}/v1/organizations`, {
    headers: { Cookie: apiCookie },
  });
  expect(organizations.ok).toBe(true);
  const orgBody = (await organizations.json()) as {
    organizations: Array<{ id: string }>;
  };
  const organizationId = orgBody.organizations[0]?.id;
  expect(organizationId).toBeTruthy();

  const suffix = Date.now().toString(36);
  const created = await fetch(`${API_URL}/v1/properties`, {
    method: 'POST',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId,
      name: `Empty Search ${suffix}`,
      slug: `empty-search-${suffix}`,
      type: 'hotel',
      timezone: 'Asia/Ho_Chi_Minh',
      currency: 'USD',
      defaultLocale: 'en',
      supportedLocales: ['en', 'vi'],
    }),
  });
  expect(created.ok).toBe(true);
  const body = (await created.json()) as { property: { id: string } };
  return body.property.id;
}

test('admin can upload, process and search knowledge with citations', async ({ page }) => {
  await signIn(page);
  const apiCookie = await signInApi();
  const propertyId = await currentPropertyId(page);

  const file = Buffer.from(sourceBody);
  const presign = await fetch(`${API_URL}/v1/uploads/presign`, {
    method: 'POST',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purpose: 'knowledge_source',
      filename: 'retrieval-smoke.txt',
      mimeType: 'text/plain',
      sizeBytes: file.byteLength,
      propertyId,
    }),
  });
  expect(presign.ok).toBe(true);
  const presigned = (await presign.json()) as {
    assetId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  };

  const put = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: {
      ...presigned.requiredHeaders,
      'Content-Type': 'text/plain',
    },
    body: file,
  });
  expect(put.ok).toBe(true);

  const complete = await fetch(`${API_URL}/v1/uploads/complete`, {
    method: 'POST',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId: presigned.assetId }),
  });
  expect(complete.ok).toBe(true);

  const created = await fetch(`${API_URL}/v1/properties/${propertyId}/knowledge-sources`, {
    method: 'POST',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: sourceTitle,
      type: 'file',
      sourceLanguage: 'en',
      assetId: presigned.assetId,
    }),
  });
  expect(created.ok).toBe(true);
  const createdBody = (await created.json()) as { source: { id: string } };

  const processed = await fetch(
    `${API_URL}/v1/properties/${propertyId}/knowledge-sources/${createdBody.source.id}/process`,
    {
      method: 'POST',
      headers: { Cookie: apiCookie },
    },
  );
  expect(processed.ok).toBe(true);

  await page.goto(`/en/properties/${propertyId}/knowledge`);
  const readySource = page
    .getByTestId('knowledge-source-list')
    .locator('li')
    .filter({ hasText: sourceTitle })
    .first();
  await expect(readySource).toContainText('ready', { timeout: 30_000 });

  await page.goto(`/en/properties/${propertyId}/knowledge/search`);
  await expect(page.getByTestId('knowledge-search-panel')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('knowledge-search-query').fill(`pool opening hours ${sourceNeedle}`);
  await page.getByTestId('knowledge-search-submit').click();
  await expect(page.getByTestId('knowledge-search-results')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('knowledge-search-status')).toContainText(/hit/i);
  await expect(page.getByTestId('knowledge-search-source').first()).toContainText(sourceTitle);
  await expect(page.getByTestId('knowledge-search-score').first()).toContainText(/Score: [0-9.]+/);
  await expect(page.getByTestId('knowledge-search-excerpt').first()).toContainText(/pool/i);

  for (const width of [1024, 1280, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const screenshot = `${evidenceRoot}/screenshots/knowledge-search-en-${width}.png`;
    await ensureDir(screenshot);
    await page.screenshot({ path: screenshot, fullPage: true });
  }
});

test('knowledge search has Vietnamese copy and no serious axe violations', async ({ page }) => {
  await signIn(page);
  const propertyId = await currentPropertyId(page);

  await page.goto(`/vi/properties/${propertyId}/knowledge/search`);
  await expect(page.getByTestId('knowledge-search-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Kiểm thử tìm kiếm tri thức' })).toBeVisible();
  await expect(page.getByTestId('knowledge-search-submit')).toContainText('Tìm kiếm');

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="knowledge-search-panel"]')
    .analyze();
  const reportPath = `${evidenceRoot}/accessibility/knowledge-search-axe.json`;
  await ensureDir(reportPath);
  await writeFile(reportPath, `${JSON.stringify(accessibility, null, 2)}\n`);
  const serious = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(serious).toEqual([]);

  for (const width of [1024, 1280, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const screenshot = `${evidenceRoot}/screenshots/knowledge-search-vi-${width}.png`;
    await ensureDir(screenshot);
    await page.screenshot({ path: screenshot, fullPage: true });
  }
});

test('knowledge search renders no-result and blocked-query states', async ({ page }) => {
  await signIn(page);
  const propertyId = await createEmptyProperty();

  await page.goto(`/en/properties/${propertyId}/knowledge/search`);
  await page.getByTestId('knowledge-search-query').fill('pool hours');
  await page.getByTestId('knowledge-search-submit').click();
  await expect(page.getByTestId('knowledge-search-status')).toContainText('No matching chunks', {
    timeout: 30_000,
  });

  await page.getByTestId('knowledge-search-query').fill('<script>');
  await page.getByTestId('knowledge-search-submit').click();
  await expect(page.getByTestId('knowledge-search-status')).toContainText('Query blocked', {
    timeout: 30_000,
  });
});
