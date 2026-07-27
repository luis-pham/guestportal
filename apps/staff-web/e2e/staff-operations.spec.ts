import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signIn } from './helpers';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-08/08.3');
const screenshotDir = resolve(evidenceDir, 'screenshots');
const claimEvidenceDir = resolve(process.cwd(), '../../evidence/phase-08/08.4');
const claimScreenshotDir = resolve(claimEvidenceDir, 'screenshots');
const realtimeEvidenceDir = resolve(process.cwd(), '../../evidence/phase-08/08.5');
const realtimeScreenshotDir = resolve(realtimeEvidenceDir, 'screenshots');

test.describe.configure({ mode: 'serial' });

type SeededWork = {
  propertyId: string;
  requestId: string;
  orderId: string;
  requestTitle: string;
  orderTitle: string;
  guestMessage: string;
};

function responseCookie(response: APIResponse, name: string) {
  const header = response
    .headersArray()
    .find((item) => item.name.toLowerCase() === 'set-cookie' && item.value.startsWith(`${name}=`));
  const cookie = header?.value.split(';')[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

async function seedSubmittedWork(request: APIRequestContext): Promise<SeededWork> {
  const suffix = Date.now().toString(36);
  const ownerLogin = await request.post(`${apiBase()}/v1/auth/login`, {
    data: { email: 'owner@aurora.test', password: 'Password123!' },
  });
  expect(ownerLogin.ok()).toBeTruthy();
  const ownerCookie = responseCookie(ownerLogin, 'gp_session');
  const { activeOrganizationId } = (await ownerLogin.json()) as { activeOrganizationId: string };

  const properties = await request.get(
    `${apiBase()}/v1/properties?organizationId=${activeOrganizationId}`,
    { headers: { cookie: ownerCookie } },
  );
  expect(properties.ok()).toBeTruthy();
  const property = (
    (await properties.json()) as {
      properties: Array<{ id: string; slug: string }>;
    }
  ).properties.find((item) => item.slug === 'aurora-city-hotel');
  expect(property).toBeTruthy();
  const propertyId = property!.id;

  const locations = await request.get(`${apiBase()}/v1/properties/${propertyId}/locations`, {
    headers: { cookie: ownerCookie },
  });
  expect(locations.ok()).toBeTruthy();
  const locationId = (
    (await locations.json()) as { locations: Array<{ id: string }> }
  ).locations[0]!.id;

  const qr = await request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    headers: { cookie: ownerCookie },
    data: { locationId },
  });
  expect(qr.ok()).toBeTruthy();
  const token = ((await qr.json()) as { token: string }).token;

  const guestSession = await request.post(`${apiBase()}/v1/guest/sessions`, {
    data: { token, locale: 'vi' },
  });
  expect(guestSession.ok()).toBeTruthy();
  const guestCookie = responseCookie(guestSession, 'gp_guest_session');

  const conversation = await request.post(`${apiBase()}/v1/guest/conversations`, {
    headers: { cookie: guestCookie },
    data: { locale: 'vi', retentionPolicy: 'standard_30_days' },
  });
  expect(conversation.ok()).toBeTruthy();
  const conversationId = ((await conversation.json()) as { conversation: { id: string } })
    .conversation.id;

  const guestMessage = `Can staff see this towel note ${suffix}?`;
  const message = await request.post(
    `${apiBase()}/v1/guest/conversations/${conversationId}/messages`,
    {
      headers: { cookie: guestCookie },
      data: {
        text: guestMessage,
        originalLanguage: 'en',
        clientMessageId: `staff-ops-msg-${suffix}`,
      },
    },
  );
  expect(message.ok()).toBeTruthy();

  const requestTitle = `Extra towels ${suffix}`;
  const draft = await request.post(`${apiBase()}/v1/guest/request-drafts`, {
    headers: { cookie: guestCookie },
    data: {
      conversationId,
      requestType: 'housekeeping',
      title: requestTitle,
      details: 'Please bring two extra towels to the room.',
    },
  });
  expect(draft.ok()).toBeTruthy();
  const requestDraftId = ((await draft.json()) as { draft: { id: string } }).draft.id;
  const confirmedRequest = await request.post(
    `${apiBase()}/v1/guest/request-drafts/${requestDraftId}/confirm`,
    {
      headers: { cookie: guestCookie },
      data: { idempotencyKey: `staff-ops-request-${requestDraftId}` },
    },
  );
  expect(confirmedRequest.ok()).toBeTruthy();
  const requestId = ((await confirmedRequest.json()) as { request: { id: string } }).request.id;

  const orderTitle = `Fresh juice ${suffix}`;
  const orderDraft = await request.post(`${apiBase()}/v1/guest/order-drafts`, {
    headers: { cookie: guestCookie },
    data: {
      conversationId,
      title: orderTitle,
      items: [
        {
          itemId: `fresh-juice-${suffix}`,
          label: 'Fresh juice',
          quantity: 1,
          unitPriceMinor: 650,
          currency: 'USD',
        },
      ],
    },
  });
  expect(orderDraft.ok()).toBeTruthy();
  const orderDraftId = ((await orderDraft.json()) as { draft: { id: string } }).draft.id;
  const confirmedOrder = await request.post(
    `${apiBase()}/v1/guest/order-drafts/${orderDraftId}/confirm`,
    {
      headers: { cookie: guestCookie },
      data: { idempotencyKey: `staff-ops-order-${orderDraftId}` },
    },
  );
  expect(confirmedOrder.ok()).toBeTruthy();
  const orderId = ((await confirmedOrder.json()) as { order: { id: string } }).order.id;

  return { propertyId, requestId, orderId, requestTitle, orderTitle, guestMessage };
}

test('staff inbox and detail workspace render real request/order data', async ({ page, request }) => {
  mkdirSync(screenshotDir, { recursive: true });
  const seeded = await seedSubmittedWork(request);

  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, 'staff.hotel@aurora.test');

  const propertyOptions = await page.getByTestId('property-switcher').locator('option').allTextContents();
  expect(propertyOptions).toContain('Aurora City Hotel');
  expect(propertyOptions).not.toContain('Aurora Bay Cruise');

  await expect(page.getByTestId('staff-inbox')).toBeVisible();
  await expect(page.getByTestId('staff-work-item').filter({ hasText: seeded.requestTitle })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('staff-work-item').filter({ hasText: seeded.orderTitle })).toBeVisible();
  await page.getByTestId('staff-work-item').filter({ hasText: seeded.requestTitle }).locator('button').first().click();
  await expect(page.getByTestId('staff-detail')).toContainText(seeded.requestTitle);
  await expect(page.getByTestId('staff-conversation')).toContainText(seeded.guestMessage);
  await expect(page.getByTestId('staff-timeline')).toContainText('submitted');

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(resolve(evidenceDir, 'axe-staff-ops.json'), JSON.stringify({ violations: blocking }, null, 2));
  expect(blocking).toEqual([]);

  for (const locale of ['en', 'vi'] as const) {
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}/inbox`);
      await expect(page.getByTestId('staff-work-item').filter({ hasText: seeded.requestTitle })).toBeVisible({
        timeout: 30_000,
      });
      await page.screenshot({
        path: resolve(screenshotDir, `staff-inbox-${locale}-${viewport.width}.png`),
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBe(false);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/vi/requests/${seeded.requestId}`);
  await expect(page.getByTestId('staff-detail')).toContainText(seeded.requestTitle);
  await page.screenshot({
    path: resolve(screenshotDir, 'staff-request-detail-vi-390.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/en/orders/${seeded.orderId}`);
  await expect(page.getByTestId('staff-detail')).toContainText(seeded.orderTitle);
  await expect(page.getByTestId('staff-detail')).toContainText('Fresh juice');
  await page.screenshot({
    path: resolve(screenshotDir, 'staff-order-detail-en-1280.png'),
    fullPage: true,
  });
});

test('staff workspace exposes loading, error, and empty states', async ({ page }) => {
  await page.route('**/v1/staff/work-items?**', async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 750);
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
  await signIn(page, 'staff.hotel@aurora.test');
  await expect(page.getByTestId('staff-ops-loading')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('staff-empty')).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/v1/staff/work-items?**');

  await page.context().clearCookies();
  await page.route('**/v1/staff/work-items?**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'TEST_FAILURE' } }),
    });
  });
  await signIn(page, 'staff.hotel@aurora.test');
  await expect(page.getByTestId('staff-error')).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/v1/staff/work-items?**');

  await page.context().clearCookies();
  await page.route('**/v1/staff/work-items?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
  await signIn(page, 'staff.hotel@aurora.test');
  await expect(page.getByTestId('staff-empty')).toBeVisible({ timeout: 30_000 });
});

test('staff inbox receives realtime submitted work and survives reload', async ({ page, request }) => {
  mkdirSync(realtimeScreenshotDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'staff.hotel@aurora.test');
  await expect(page.getByTestId('staff-inbox')).toBeVisible({ timeout: 30_000 });

  const seeded = await seedSubmittedWork(request);
  await expect(page.getByTestId('staff-claim-notice')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('staff-work-item').filter({ hasText: seeded.requestTitle })).toBeVisible({
    timeout: 30_000,
  });

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(realtimeEvidenceDir, 'axe-staff-realtime.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);

  await page.screenshot({
    path: resolve(realtimeScreenshotDir, 'staff-realtime-inbox-390.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByTestId('staff-work-item').filter({ hasText: seeded.requestTitle })).toBeVisible({
    timeout: 30_000,
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test('staff claim conflict is visible when another worker claims first', async ({
  browser,
  request,
}) => {
  mkdirSync(claimScreenshotDir, { recursive: true });
  const seeded = await seedSubmittedWork(request);
  const staffContext = await browser.newContext();
  const managerContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  const managerPage = await managerContext.newPage();

  try {
    await staffPage.setViewportSize({ width: 390, height: 844 });
    await managerPage.setViewportSize({ width: 1280, height: 800 });
    await signIn(staffPage, 'staff.hotel@aurora.test');
    await signIn(managerPage, 'manager.hotel@aurora.test');

    const staffCard = staffPage.getByTestId('staff-work-item').filter({ hasText: seeded.requestTitle });
    const managerCard = managerPage
      .getByTestId('staff-work-item')
      .filter({ hasText: seeded.requestTitle });
    await expect(staffCard).toBeVisible({ timeout: 30_000 });
    await expect(managerCard).toBeVisible({ timeout: 30_000 });

    await managerCard.getByTestId('staff-claim-item').click();
    await expect(managerPage.getByTestId('staff-claim-notice')).toBeVisible({ timeout: 30_000 });

    await staffCard.getByTestId('staff-claim-item').click();
    await expect(staffPage.getByTestId('staff-claim-conflict')).toBeVisible({ timeout: 30_000 });
    const accessibility = await new AxeBuilder({ page: staffPage }).analyze();
    const blocking = accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    writeFileSync(
      resolve(claimEvidenceDir, 'axe-staff-claim.json'),
      JSON.stringify({ violations: blocking }, null, 2),
    );
    expect(blocking).toEqual([]);
    await staffPage.screenshot({
      path: resolve(claimScreenshotDir, 'staff-claim-conflict-390.png'),
      fullPage: true,
    });
    const overflow = await staffPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  } finally {
    await staffContext.close();
    await managerContext.close();
  }
});

test('staff role cannot see properties outside assignment', async ({ page }) => {
  await signIn(page, 'staff.cruise@aurora.test');
  const propertyOptions = await page.getByTestId('property-switcher').locator('option').allTextContents();
  expect(propertyOptions).toContain('Aurora Bay Cruise');
  expect(propertyOptions).not.toContain('Aurora City Hotel');
  await expect(page.getByTestId('access-denied')).toHaveCount(0);
});
