import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-09/09.1');
const screenshotDir = resolve(evidenceDir, 'screenshots');
const accessibilityDir = resolve(evidenceDir, 'accessibility');

test.describe.configure({ mode: 'serial' });

type GuestContext = {
  propertyId: string;
  guestCookie: string;
  conversationId: string;
};

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
}

async function createGuestContext(request: APIRequestContext): Promise<GuestContext> {
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
    (await properties.json()) as { properties: Array<{ id: string; slug: string }> }
  ).properties.find((item) => item.slug === 'aurora-city-hotel');
  expect(property).toBeTruthy();

  const locations = await request.get(`${apiBase()}/v1/properties/${property!.id}/locations`, {
    headers: { cookie: ownerCookie },
  });
  expect(locations.ok()).toBeTruthy();
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> })
    .locations[0]!.id;

  const qr = await request.post(`${apiBase()}/v1/properties/${property!.id}/qr-codes`, {
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

  return { propertyId: property!.id, guestCookie, conversationId };
}

async function seedRequest(request: APIRequestContext, context: GuestContext, title: string) {
  const message = await request.post(
    `${apiBase()}/v1/guest/conversations/${context.conversationId}/messages`,
    {
      headers: { cookie: context.guestCookie },
      data: {
        text: `Please track ${title}`,
        originalLanguage: 'en',
        clientMessageId: `admin-ops-msg-${title.replaceAll(' ', '-').toLowerCase()}`,
      },
    },
  );
  expect(message.ok()).toBeTruthy();

  const draft = await request.post(`${apiBase()}/v1/guest/request-drafts`, {
    headers: { cookie: context.guestCookie },
    data: {
      conversationId: context.conversationId,
      requestType: 'housekeeping',
      title,
      details: `Guest request detail for ${title}`,
    },
  });
  expect(draft.ok()).toBeTruthy();
  const draftId = ((await draft.json()) as { draft: { id: string } }).draft.id;
  const confirmed = await request.post(`${apiBase()}/v1/guest/request-drafts/${draftId}/confirm`, {
    headers: { cookie: context.guestCookie },
    data: { idempotencyKey: `admin-ops-request-${draftId}` },
  });
  expect(confirmed.ok()).toBeTruthy();
  return ((await confirmed.json()) as { request: { id: string } }).request.id;
}

async function seedOrder(request: APIRequestContext, context: GuestContext, title: string) {
  const draft = await request.post(`${apiBase()}/v1/guest/order-drafts`, {
    headers: { cookie: context.guestCookie },
    data: {
      conversationId: context.conversationId,
      title,
      items: [
        {
          itemId: `juice-${Date.now()}`,
          label: 'Fresh juice',
          quantity: 2,
          unitPriceMinor: 650,
          currency: 'USD',
        },
      ],
    },
  });
  expect(draft.ok()).toBeTruthy();
  const draftId = ((await draft.json()) as { draft: { id: string } }).draft.id;
  const confirmed = await request.post(`${apiBase()}/v1/guest/order-drafts/${draftId}/confirm`, {
    headers: { cookie: context.guestCookie },
    data: { idempotencyKey: `admin-ops-order-${draftId}` },
  });
  expect(confirmed.ok()).toBeTruthy();
  return ((await confirmed.json()) as { order: { id: string } }).order.id;
}

test('admin operations filters and opens request/order deep links with evidence', async ({
  page,
  request,
}) => {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(accessibilityDir, { recursive: true });
  const context = await createGuestContext(request);
  const suffix = Date.now().toString(36);
  const requestTitle = `Admin ops towels ${suffix}`;
  const orderTitle = `Admin ops juice ${suffix}`;
  const requestId = await seedRequest(request, context, requestTitle);
  const orderId = await seedOrder(request, context, orderTitle);

  await page.setViewportSize({ width: 1280, height: 860 });
  await signIn(page, 'owner@aurora.test');
  await page.goto(`/en/properties/${context.propertyId}/operations/requests`);
  await page.getByTestId('admin-ops-status').selectOption('submitted');
  const requestRow = page.getByTestId('admin-ops-item').filter({ hasText: requestTitle });
  await expect(requestRow).toBeVisible({ timeout: 30_000 });
  await requestRow.getByTestId('admin-ops-open').click();
  await expect(page).toHaveURL(new RegExp(`/operations/requests/${requestId}$`));
  await expect(page.getByTestId('admin-ops-detail')).toContainText(requestTitle);
  await expect(page.getByTestId('admin-ops-conversation')).toContainText(
    `Please track ${requestTitle}`,
  );
  await expect(page.getByTestId('admin-ops-timeline')).toContainText('submitted');

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(accessibilityDir, 'axe-admin-operations-requests.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);
  await page.screenshot({
    path: resolve(screenshotDir, 'admin-operations-requests-1280.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/en/properties/${context.propertyId}/operations/orders/${orderId}`);
  await expect(page.getByTestId('admin-ops-detail')).toContainText(orderTitle, { timeout: 30_000 });
  await expect(page.getByTestId('admin-ops-order-items')).toContainText('Fresh juice');
  await page.screenshot({
    path: resolve(screenshotDir, 'admin-operations-orders-390.png'),
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});

test('admin operations paginates large request lists', async ({ page, request }) => {
  const context = await createGuestContext(request);
  const suffix = Date.now().toString(36);
  const oldestTitle = `Admin ops bulk ${suffix}-00`;
  for (let index = 0; index < 21; index += 1) {
    await seedRequest(
      request,
      context,
      `Admin ops bulk ${suffix}-${String(index).padStart(2, '0')}`,
    );
  }

  await signIn(page, 'owner@aurora.test');
  await page.goto(`/en/properties/${context.propertyId}/operations/requests`);
  await page.getByTestId('admin-ops-status').selectOption('submitted');
  await expect(page.getByTestId('admin-ops-load-more')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('admin-ops-load-more').click();
  await expect(page.getByTestId('admin-ops-item').filter({ hasText: oldestTitle })).toBeVisible({
    timeout: 30_000,
  });
});

test('content manager cannot open admin operations queues', async ({ page, request }) => {
  const context = await createGuestContext(request);
  await signIn(page, 'content@aurora.test');
  await page.goto(`/en/properties/${context.propertyId}/operations/requests`);
  await expect(page.getByTestId('admin-ops-error')).toContainText('permission', {
    timeout: 30_000,
  });
});
