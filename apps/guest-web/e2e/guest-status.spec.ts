import { expect, test, type APIRequestContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-04/04.5/screenshots');

async function mintGuestToken(request: APIRequestContext) {
  const login = await request.post(`${apiBase()}/v1/auth/login`, {
    data: { email: 'owner@aurora.test', password: 'Password123!' },
  });
  const { activeOrganizationId } = (await login.json()) as { activeOrganizationId: string };
  const properties = await request.get(
    `${apiBase()}/v1/properties?organizationId=${activeOrganizationId}`,
  );
  const propertyId = ((await properties.json()) as { properties: Array<{ id: string }> })
    .properties[0]!.id;
  const draft = await request.get(`${apiBase()}/v1/properties/${propertyId}/portal/draft`);
  const draftVersion = ((await draft.json()) as { version: number }).version;
  await request.post(`${apiBase()}/v1/properties/${propertyId}/portal/publish`, {
    data: {
      expectedDraftVersion: draftVersion,
      idempotencyKey: `e2e-status-${propertyId}-${Date.now()}`,
    },
  });
  const locations = await request.get(`${apiBase()}/v1/properties/${propertyId}/locations`);
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> })
    .locations[0]!.id;
  const qr = await request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    data: { locationId },
  });
  return ((await qr.json()) as { token: string }).token;
}

test('status center empty shell, offline banner, and slow network hint', async ({
  page,
  request,
}) => {
  mkdirSync(evidenceDir, { recursive: true });
  const token = await mintGuestToken(request);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/g/${token}/status`);
  await expect(page.getByTestId('guest-status-empty')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: resolve(evidenceDir, 'status-empty-390.png'), fullPage: true });

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByTestId('guest-offline-banner')).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, 'status-offline-390.png'), fullPage: true });

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(page.getByTestId('guest-status-empty')).toBeVisible({ timeout: 30_000 });

  await page.route('**/v1/guest/**', async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
    await route.continue();
  });
  await page.goto(`/g/${token}/status`);
  await expect(page.getByTestId('guest-slow-network')).toBeVisible({ timeout: 10_000 });
});
