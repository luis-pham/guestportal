import { expect, test, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-04/04.5/screenshots');
const realtimeEvidenceDir = resolve(process.cwd(), '../../evidence/phase-08/08.5');
const realtimeScreenshotDir = resolve(realtimeEvidenceDir, 'screenshots');

function responseCookie(headers: Array<{ name: string; value: string }>, name: string) {
  const header = headers.find(
    (item) => item.name.toLowerCase() === 'set-cookie' && item.value.startsWith(`${name}=`),
  );
  const cookie = header?.value.split(';')[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

async function mintGuestToken(request: APIRequestContext) {
  const login = await request.post(`${apiBase()}/v1/auth/login`, {
    data: { email: 'owner@aurora.test', password: 'Password123!' },
  });
  expect(login.ok()).toBeTruthy();
  const ownerCookie = responseCookie(login.headersArray(), 'gp_session');
  const { activeOrganizationId } = (await login.json()) as { activeOrganizationId: string };
  const properties = await request.get(
    `${apiBase()}/v1/properties?organizationId=${activeOrganizationId}`,
    { headers: { cookie: ownerCookie } },
  );
  expect(properties.ok()).toBeTruthy();
  const property = (
    (await properties.json()) as { properties: Array<{ id: string; slug: string }> }
  ).properties.find((item) => item.slug === 'aurora-city-hotel');
  expect(property).toBeTruthy();
  const propertyId = property!.id;
  const draft = await request.get(`${apiBase()}/v1/properties/${propertyId}/portal/draft`, {
    headers: { cookie: ownerCookie },
  });
  const draftVersion = ((await draft.json()) as { version: number }).version;
  await request.post(`${apiBase()}/v1/properties/${propertyId}/portal/publish`, {
    headers: { cookie: ownerCookie },
    data: {
      expectedDraftVersion: draftVersion,
      idempotencyKey: `e2e-status-${propertyId}-${Date.now()}`,
    },
  });
  const locations = await request.get(`${apiBase()}/v1/properties/${propertyId}/locations`, {
    headers: { cookie: ownerCookie },
  });
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> })
    .locations[0]!.id;
  const qr = await request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    headers: { cookie: ownerCookie },
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

test('guest status receives realtime staff status updates and converges after reload', async ({
  page,
  request,
}) => {
  mkdirSync(realtimeScreenshotDir, { recursive: true });
  const token = await mintGuestToken(request);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/g/${token}/status`);
  await expect(page.getByTestId('guest-status-empty')).toBeVisible({ timeout: 30_000 });

  const conversation = await page.request.post(`${apiBase()}/v1/guest/conversations`, {
    data: { locale: 'en', retentionPolicy: 'standard_30_days' },
  });
  expect(conversation.ok()).toBeTruthy();
  const conversationId = ((await conversation.json()) as { conversation: { id: string } })
    .conversation.id;
  const draft = await page.request.post(`${apiBase()}/v1/guest/request-drafts`, {
    data: {
      conversationId,
      requestType: 'housekeeping',
      title: `Realtime guest towels ${Date.now().toString(36)}`,
      details: 'Please bring towels.',
    },
  });
  expect(draft.ok()).toBeTruthy();
  const draftId = ((await draft.json()) as { draft: { id: string } }).draft.id;
  const confirm = await page.request.post(`${apiBase()}/v1/guest/request-drafts/${draftId}/confirm`, {
    data: { idempotencyKey: `guest-realtime-${draftId}` },
  });
  expect(confirm.ok()).toBeTruthy();
  const requestBody = (await confirm.json()) as { request: { id: string; title: string } };
  await expect(page.getByTestId('guest-status-item').filter({ hasText: requestBody.request.title })).toBeVisible({
    timeout: 30_000,
  });

  const staffLogin = await request.post(`${apiBase()}/v1/auth/login`, {
    data: { email: 'staff.hotel@aurora.test', password: 'Password123!' },
  });
  expect(staffLogin.ok()).toBeTruthy();
  const staffCookie = responseCookie(staffLogin.headersArray(), 'gp_session');
  const accepted = await request.post(
    `${apiBase()}/v1/staff/requests/${requestBody.request.id}/accept`,
    {
      headers: { cookie: staffCookie },
      data: {
        expectedVersion: 1,
        idempotencyKey: `guest-realtime-accept-${requestBody.request.id}`,
      },
    },
  );
  expect(accepted.ok()).toBeTruthy();

  const item = page.getByTestId('guest-status-item').filter({ hasText: requestBody.request.title });
  await expect(page.getByTestId('guest-status-live')).toBeVisible({ timeout: 30_000 });
  await expect(item).toContainText(/Accepted|Đã nhận/, { timeout: 30_000 });

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(realtimeEvidenceDir, 'axe-guest-realtime.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);

  await page.screenshot({
    path: resolve(realtimeScreenshotDir, 'guest-status-realtime-390.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(item).toContainText(/Accepted|Đã nhận/, { timeout: 30_000 });
});
