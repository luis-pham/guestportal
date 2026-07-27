import { expect, test, type APIRequestContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-04/04.4/screenshots');

async function mintGuestToken(request: APIRequestContext) {
  const login = await request.post(`${apiBase()}/v1/auth/login`, {
    data: { email: 'owner@aurora.test', password: 'Password123!' },
  });
  expect(login.ok()).toBeTruthy();
  const { activeOrganizationId } = (await login.json()) as { activeOrganizationId: string };
  const properties = await request.get(
    `${apiBase()}/v1/properties?organizationId=${activeOrganizationId}`,
  );
  const propertyId = ((await properties.json()) as { properties: Array<{ id: string }> })
    .properties[0]!.id;

  // Force draft to latest template defaults then publish for explore/guide sections.
  const draft = await request.get(`${apiBase()}/v1/properties/${propertyId}/portal/draft`);
  const body = await draft.json();
  await request.put(`${apiBase()}/v1/properties/${propertyId}/portal/draft`, {
    data: {
      version: body.version,
      config: body.config,
    },
  });
  const after = await request.get(`${apiBase()}/v1/properties/${propertyId}/portal/draft`);
  const draftVersion = ((await after.json()) as { version: number }).version;
  const publish = await request.post(`${apiBase()}/v1/properties/${propertyId}/portal/publish`, {
    data: {
      expectedDraftVersion: draftVersion,
      idempotencyKey: `e2e-nav-${propertyId}-${Date.now()}`,
    },
  });
  expect(publish.ok()).toBeTruthy();

  const locations = await request.get(`${apiBase()}/v1/properties/${propertyId}/locations`);
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> })
    .locations[0]!.id;
  const qr = await request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    data: { locationId },
  });
  return ((await qr.json()) as { token: string }).token;
}

test('explore, guide, locale, and empty-safe navigation', async ({ page, request }) => {
  mkdirSync(evidenceDir, { recursive: true });
  const token = await mintGuestToken(request);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/g/${token}`);
  await expect(page.getByTestId('guest-homepage')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('guest-mobile-nav')).toBeVisible();

  await page.goto(`/g/${token}/explore`);
  await expect(page.getByTestId('guest-explore')).toBeVisible({ timeout: 30_000 });
  const exploreEmpty = page.getByTestId('guest-explore-empty');
  const exploreList = page.getByTestId('guest-explore-list');
  await expect(exploreEmpty.or(exploreList)).toBeVisible();

  await page.goto(`/g/${token}/guide`);
  await expect(page.getByTestId('guest-guide')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('guest-guide-empty').or(page.getByTestId('guest-guide-list'))).toBeVisible();

  // Location-safe: relative nav stays under /g/:token
  const href = await page.locator('[data-testid="guest-mobile-nav"] a').first().getAttribute('href');
  expect(href?.startsWith(`/g/${token}`)).toBeTruthy();

  await page.getByTestId('guest-locale-toggle').click();
  await expect(page.getByTestId('guest-guide')).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: resolve(evidenceDir, 'guide-390.png'), fullPage: true });
  await page.goto(`/g/${token}/explore`);
  await page.screenshot({ path: resolve(evidenceDir, 'explore-390.png'), fullPage: true });
});
