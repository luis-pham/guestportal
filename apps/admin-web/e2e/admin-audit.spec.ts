import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-09/09.4');
const screenshotDir = resolve(evidenceDir, 'screenshots');
const accessibilityDir = resolve(evidenceDir, 'accessibility');
const exportDir = resolve(evidenceDir, 'exports');

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

async function auroraProperty(request: APIRequestContext, organizationId: string) {
  const properties = await request.get(`${apiBase()}/v1/properties?organizationId=${organizationId}`);
  expect(properties.ok()).toBeTruthy();
  const property = ((await properties.json()) as { properties: Array<{ id: string; slug: string }> })
    .properties.find((item) => item.slug === 'aurora-city-hotel');
  expect(property).toBeTruthy();
  return property!;
}

async function seedExportRequest(request: APIRequestContext, propertyId: string) {
  const locations = await request.get(`${apiBase()}/v1/properties/${propertyId}/locations`);
  expect(locations.ok()).toBeTruthy();
  const locationId = ((await locations.json()) as { locations: Array<{ id: string }> }).locations[0]!.id;
  const qr = await request.post(`${apiBase()}/v1/properties/${propertyId}/qr-codes`, {
    data: { locationId, destinationType: 'portal_home' },
  });
  expect(qr.ok()).toBeTruthy();
  const token = ((await qr.json()) as { token: string }).token;
  const session = await request.post(`${apiBase()}/v1/guest/sessions`, {
    data: { token, locale: 'en' },
  });
  expect(session.ok()).toBeTruthy();
  const guestCookie = responseCookie(session, 'gp_guest_session');
  const conversation = await request.post(`${apiBase()}/v1/guest/conversations`, {
    headers: { Cookie: guestCookie },
    data: { locale: 'en', retentionPolicy: 'standard_30_days' },
  });
  expect(conversation.ok()).toBeTruthy();
  const conversationId = ((await conversation.json()) as { conversation: { id: string } }).conversation.id;
  const marker = Date.now().toString(36);
  const title = `=Export audit ${marker}`;
  const draft = await request.post(`${apiBase()}/v1/guest/request-drafts`, {
    headers: { Cookie: guestCookie },
    data: {
      conversationId,
      requestType: 'housekeeping',
      title,
      details: `+CSV proof ${marker}`,
    },
  });
  expect(draft.ok()).toBeTruthy();
  const draftId = ((await draft.json()) as { draft: { id: string } }).draft.id;
  const confirmed = await request.post(`${apiBase()}/v1/guest/request-drafts/${draftId}/confirm`, {
    headers: { Cookie: guestCookie },
    data: { idempotencyKey: `audit-export-${draftId}` },
  });
  expect(confirmed.ok()).toBeTruthy();
  return { title, marker };
}

test('owner exports operations and reviews audit log with evidence', async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(accessibilityDir, { recursive: true });
  mkdirSync(exportDir, { recursive: true });
  const owner = await signIn(page, 'owner@aurora.test');
  const property = await auroraProperty(page.request, owner.activeOrganizationId);
  const seeded = await seedExportRequest(page.request, property.id);

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`/en/properties/${property.id}/operations/requests`);
  await page.getByTestId('admin-ops-status').selectOption('submitted');
  await expect(page.getByTestId('admin-ops-list')).toContainText(seeded.title, {
    timeout: 30_000,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('admin-ops-export').click();
  const download = await downloadPromise;
  const exportPath = resolve(exportDir, download.suggestedFilename());
  await download.saveAs(exportPath);
  const csv = readFileSync(exportPath, 'utf8');
  expect(csv).toContain(`"'${seeded.title}"`);
  await expect(page.getByTestId('admin-ops-export-status')).toContainText('Exported', {
    timeout: 30_000,
  });

  await page.goto('/en/settings/audit-log');
  await expect(page.getByTestId('admin-audit-panel')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('audit-action-filter').fill('operations.export');
  await page.getByTestId('audit-search').fill(property.id);
  await expect(page.getByTestId('audit-log-table')).toContainText('operations.export', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('audit-log-table')).toContainText('requests');

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(accessibilityDir, 'axe-admin-audit.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);
  await page.screenshot({ path: resolve(screenshotDir, 'admin-audit-1280.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vi/settings/audit-log');
  await expect(page.getByTestId('admin-audit-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('audit-log-table')).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: resolve(screenshotDir, 'admin-audit-390.png'), fullPage: true });
});

test('content manager sees audit permission error', async ({ page }) => {
  await signIn(page, 'content@aurora.test');
  await page.goto('/en/settings/audit-log');
  await expect(page.getByTestId('audit-error')).toContainText('permission', { timeout: 30_000 });
});
