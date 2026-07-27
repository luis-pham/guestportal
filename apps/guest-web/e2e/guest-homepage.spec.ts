import { expect, test, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-04/04.3/screenshots');

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

  const draft = await request.get(`${apiBase()}/v1/properties/${propertyId}/portal/draft`);
  const draftVersion = ((await draft.json()) as { version: number }).version;
  await request.post(`${apiBase()}/v1/properties/${propertyId}/portal/publish`, {
    data: {
      expectedDraftVersion: draftVersion,
      idempotencyKey: `e2e-guest-home-${propertyId}-${Date.now()}`,
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

test('guest homepage renders brand fallbacks across mobile widths', async ({ page, request }) => {
  mkdirSync(evidenceDir, { recursive: true });
  const token = await mintGuestToken(request);

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/g/${token}`);
    await expect(page.getByTestId('guest-homepage')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('guest-cover-fallback')).toBeVisible();
    await expect(page.getByTestId('guest-logo-fallback')).toBeVisible();
    await expect(page.getByTestId('guest-location')).toBeVisible();
    await expect(page.getByTestId('guest-quick-actions')).toBeVisible();
    await page.screenshot({
      path: resolve(evidenceDir, `homepage-${width}.png`),
      fullPage: true,
    });
  }

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((v) => v.impact === 'critical')).toEqual([]);
});
