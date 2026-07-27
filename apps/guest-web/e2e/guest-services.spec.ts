import { expect, test, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-08/08.2');
const screenshotDir = resolve(evidenceDir, 'screenshots');

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
  const publish = await request.post(`${apiBase()}/v1/properties/${propertyId}/portal/publish`, {
    data: {
      expectedDraftVersion: draftVersion,
      idempotencyKey: `e2e-services-${propertyId}-${Date.now()}`,
    },
  });
  expect(publish.ok()).toBeTruthy();

  const locations = await request.get(`${apiBase()}/v1/properties/${propertyId}/locations`);
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> })
    .locations[0]!.id;
  const qr = await request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    data: { locationId },
  });
  expect(qr.ok()).toBeTruthy();
  return ((await qr.json()) as { token: string }).token;
}

test('catalog, cart, guest submission, and persisted status', async ({ page, request }) => {
  mkdirSync(screenshotDir, { recursive: true });
  const token = await mintGuestToken(request);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/g/${token}/services`);
  await expect(page.getByTestId('guest-services')).toBeVisible({ timeout: 30_000 });
  expect(await page.getByTestId('guest-service-item').count()).toBeGreaterThanOrEqual(2);

  const requestButton = page.locator('[data-testid^="guest-submit-request-"]').first();
  await requestButton.click();
  await expect(page.getByTestId('guest-confirmation')).toBeVisible({ timeout: 30_000 });

  const addButton = page.locator('[data-testid^="guest-add-"]').first();
  await addButton.click();
  await expect(page.getByTestId('guest-cart-total')).toContainText('USD');
  const submitOrder = page.getByTestId('guest-submit-order');
  await submitOrder.evaluate((element) => {
    const button = element as HTMLButtonElement;
    button.click();
    button.click();
  });
  await expect(page.getByTestId('guest-confirmation')).toBeVisible({ timeout: 30_000 });

  await page.goto(`/g/${token}/status`);
  await expect(page.getByTestId('guest-status-list')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('guest-status-item')).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId('guest-status-item')).toHaveCount(2);
  await page.screenshot({
    path: resolve(screenshotDir, 'status-390.png'),
    fullPage: true,
  });

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/g/${token}/services`);
    await expect(page.getByTestId('guest-services')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({
      path: resolve(screenshotDir, `services-${width}.png`),
      fullPage: true,
    });
  }

  await page.goto(`/g/${token}/status`);
  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(evidenceDir, 'axe-status.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);
});
