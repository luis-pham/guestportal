import { expect, test, type APIResponse, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-09/09.3');
const screenshotDir = resolve(evidenceDir, 'screenshots');
const accessibilityDir = resolve(evidenceDir, 'accessibility');

test.describe.configure({ mode: 'serial' });

function responseCookie(response: APIResponse, name: string) {
  const header = response
    .headersArray()
    .find((item) => item.name.toLowerCase() === 'set-cookie' && item.value.startsWith(`${name}=`));
  const cookie = header?.value.split(';')[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

function cookieUrls() {
  const urls = new Set([apiBase()]);
  const parsed = new URL(apiBase());
  if (parsed.hostname === 'localhost') {
    parsed.hostname = '127.0.0.1';
    urls.add(parsed.toString());
  } else if (parsed.hostname === '127.0.0.1') {
    parsed.hostname = 'localhost';
    urls.add(parsed.toString());
  }
  return [...urls];
}

async function signIn(page: Page, email: string) {
  const login = await page.request.post(`${apiBase()}/v1/auth/login`, {
    data: { email, password: 'Password123!' },
  });
  expect(login.ok()).toBeTruthy();
  const cookie = responseCookie(login, 'gp_session');
  const value = cookie.split('=').slice(1).join('=');
  await page.setExtraHTTPHeaders({ Cookie: cookie });
  await page.context().addCookies(
    cookieUrls().map((url) => ({
      name: 'gp_session',
      value,
      url,
      httpOnly: true,
      sameSite: 'Lax',
    })),
  );
  return (await login.json()) as { activeOrganizationId: string };
}

async function auroraProperty(page: Page, organizationId: string) {
  const properties = await page.request.get(`${apiBase()}/v1/properties?organizationId=${organizationId}`);
  expect(properties.ok()).toBeTruthy();
  return ((await properties.json()) as { properties: Array<{ id: string; slug: string }> })
    .properties.find((property) => property.slug === 'aurora-city-hotel')!;
}

async function seedAnalyticsWork(page: Page, propertyId: string) {
  const locations = await page.request.get(`${apiBase()}/v1/properties/${propertyId}/locations`);
  expect(locations.ok()).toBeTruthy();
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> }).locations[0]!.id;
  const qr = await page.request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    data: { locationId, destinationType: 'portal_home' },
  });
  expect(qr.ok()).toBeTruthy();
  const token = ((await qr.json()) as { token: string }).token;
  const session = await page.request.post(`${apiBase()}/v1/guest/sessions`, {
    data: { token, locale: 'en' },
  });
  expect(session.ok()).toBeTruthy();
  const guestCookie = responseCookie(session, 'gp_guest_session');
  const conversation = await page.request.post(`${apiBase()}/v1/guest/conversations`, {
    headers: { Cookie: guestCookie },
    data: { locale: 'en', retentionPolicy: 'standard_30_days' },
  });
  expect(conversation.ok()).toBeTruthy();
  const conversationId = ((await conversation.json()) as { conversation: { id: string } }).conversation.id;
  const marker = Date.now();

  const requestDraft = await page.request.post(`${apiBase()}/v1/guest/request-drafts`, {
    headers: { Cookie: guestCookie },
    data: {
      conversationId,
      requestType: 'housekeeping',
      title: `Analytics towels ${marker}`,
      details: 'Please bring two towels.',
    },
  });
  expect(requestDraft.ok()).toBeTruthy();
  const requestDraftId = ((await requestDraft.json()) as { draft: { id: string } }).draft.id;
  const requestConfirm = await page.request.post(
    `${apiBase()}/v1/guest/request-drafts/${requestDraftId}/confirm`,
    {
      headers: { Cookie: guestCookie },
      data: { idempotencyKey: `analytics-request-${requestDraftId}` },
    },
  );
  expect(requestConfirm.ok()).toBeTruthy();

  const orderDraft = await page.request.post(`${apiBase()}/v1/guest/order-drafts`, {
    headers: { Cookie: guestCookie },
    data: {
      conversationId,
      title: `Analytics breakfast ${marker}`,
      items: [
        {
          itemId: `breakfast-${marker}`,
          label: `Analytics breakfast ${marker}`,
          quantity: 2,
          unitPriceMinor: 12500,
          currency: 'USD',
        },
      ],
    },
  });
  expect(orderDraft.ok()).toBeTruthy();
  const orderDraftId = ((await orderDraft.json()) as { draft: { id: string } }).draft.id;
  const orderConfirm = await page.request.post(
    `${apiBase()}/v1/guest/order-drafts/${orderDraftId}/confirm`,
    {
      headers: { Cookie: guestCookie },
      data: { idempotencyKey: `analytics-order-${orderDraftId}` },
    },
  );
  expect(orderConfirm.ok()).toBeTruthy();
}

test('owner views real analytics dashboard with evidence', async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(accessibilityDir, { recursive: true });
  const owner = await signIn(page, 'owner@aurora.test');
  const property = await auroraProperty(page, owner.activeOrganizationId);
  await seedAnalyticsWork(page, property.id);

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`/en/properties/${property.id}/analytics`);
  await expect(page.getByTestId('admin-analytics-dashboard')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('analytics-summary')).toContainText('Requests', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('analytics-top-services')).toContainText('Analytics breakfast', {
    timeout: 30_000,
  });

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(accessibilityDir, 'axe-admin-analytics.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);
  await page.screenshot({
    path: resolve(screenshotDir, 'admin-analytics-1280.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/vi/properties/${property.id}/analytics`);
  await expect(page.getByTestId('admin-analytics-dashboard')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('analytics-summary')).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: resolve(screenshotDir, 'admin-analytics-390.png'),
    fullPage: true,
  });
});

test('content manager sees analytics permission error', async ({ page }) => {
  const content = await signIn(page, 'content@aurora.test');
  const property = await auroraProperty(page, content.activeOrganizationId);
  await page.goto(`/en/properties/${property.id}/analytics`);
  await expect(page.getByTestId('analytics-error')).toContainText('permission', {
    timeout: 30_000,
  });
});
