import { expect, test, type APIResponse, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const evidenceDir = resolve(process.cwd(), '../../evidence/phase-09/09.2');
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
    .properties[0]!;
}

test('admin manages team, settings and security controls with evidence', async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(accessibilityDir, { recursive: true });
  const owner = await signIn(page, 'owner@aurora.test');

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/en/team');
  await expect(page.getByTestId('team-members-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('team-member-row').filter({ hasText: 'staff.hotel@aurora.test' })).toBeVisible();
  await expect(page.getByTestId('team-member-row').filter({ hasText: 'staff.cruise@aurora.test' })).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Aurora Owner');
    await dialog.accept();
  });
  await page.getByTestId('team-revoke-owner@aurora.test').click();
  await expect(page.getByTestId('team-error')).toBeVisible({ timeout: 30_000 });

  const roleSelect = page.getByTestId('team-role-staff.hotel@aurora.test');
  await roleSelect.selectOption('viewer');
  await expect(page.getByTestId('team-saved')).toBeVisible({ timeout: 30_000 });
  await roleSelect.selectOption('staff');
  await expect(page.getByTestId('team-saved')).toBeVisible({ timeout: 30_000 });

  const accessibility = await new AxeBuilder({ page }).analyze();
  const blocking = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  writeFileSync(
    resolve(accessibilityDir, 'axe-admin-team.json'),
    JSON.stringify({ violations: blocking }, null, 2),
  );
  expect(blocking).toEqual([]);
  await page.screenshot({ path: resolve(screenshotDir, 'admin-team-1280.png'), fullPage: true });

  await page.goto('/en/settings/organization');
  await expect(page.getByTestId('organization-settings-panel')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('organization-name').fill('   ');
  await page.getByTestId('organization-settings-submit').click();
  await expect(page.getByTestId('organization-settings-error')).toContainText('required');
  await page.getByTestId('organization-name').fill('Aurora Hospitality');
  await page.getByTestId('organization-settings-submit').click();
  await expect(page.getByTestId('organization-settings-saved')).toBeVisible({ timeout: 30_000 });

  await page.goto('/en/settings/security');
  await expect(page.getByTestId('security-settings-list')).toContainText('postgres-rls', {
    timeout: 30_000,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vi/team/invitations');
  await expect(page.getByTestId('team-invitations-empty')).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: resolve(screenshotDir, 'admin-invitations-390.png'), fullPage: true });

  expect(owner.activeOrganizationId).toBeTruthy();
});

test('knowledge operations filter and delete a source with confirmation', async ({ page }) => {
  const owner = await signIn(page, 'owner@aurora.test');
  const property = await auroraProperty(page, owner.activeOrganizationId);
  const title = `E2E delete source ${Date.now()}`;
  const created = await page.request.post(
    `${apiBase()}/v1/properties/${property.id}/knowledge-sources`,
    {
      data: { title, type: 'manual', sourceLanguage: 'en' },
    },
  );
  expect(created.ok()).toBeTruthy();
  const sourceId = ((await created.json()) as { source: { id: string } }).source.id;

  await page.goto(`/en/properties/${property.id}/knowledge`);
  await page.getByTestId('knowledge-status-filter').selectOption('draft');
  await page.getByTestId('knowledge-language-filter').selectOption('en');
  await expect(page.getByTestId(`knowledge-source-${sourceId}`)).toContainText(title, {
    timeout: 30_000,
  });

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain(title);
    await dialog.accept();
  });
  await page.getByTestId(`knowledge-delete-${sourceId}`).click();
  await expect(page.getByTestId(`knowledge-source-${sourceId}`)).toHaveCount(0, {
    timeout: 30_000,
  });
});

test('viewer sees permission errors for team management', async ({ page }) => {
  await signIn(page, 'viewer@aurora.test');
  await page.goto('/en/team');
  await expect(page.getByTestId('team-error')).toContainText('permission', { timeout: 30_000 });
});
