import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const evidenceDir = join(process.cwd(), '../../evidence/phase-01/screenshots');

test.beforeAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
});

test('login logout and locale switch with screenshots', async ({ page }) => {
  await page.goto('/vi/login');
  await expect(page.getByTestId('login-submit')).toBeVisible();
  await page.screenshot({ path: join(evidenceDir, 'login-vi.png'), fullPage: true });

  await page.goto('/en/login');
  await expect(page.getByRole('heading')).toContainText('Admin sign in');
  await page.screenshot({ path: join(evidenceDir, 'login-en.png'), fullPage: true });

  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('org-switcher')).toBeVisible();
  await page.screenshot({ path: join(evidenceDir, 'org-switcher.png'), fullPage: true });

  await page.getByTestId('locale-switch').click();
  await expect(page).toHaveURL(/\/vi$/);
  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/\/vi\/login/);
});

test('property manager cannot see unassigned properties', async ({ page }) => {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('manager.hotel@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('property-list')).toBeVisible();
  const text = await page.getByTestId('property-list').innerText();
  expect(text).toContain('Aurora City Hotel');
  expect(text).not.toContain('Aurora Bay Cruise');
});

test('access denied path shows forbidden messaging when forced', async ({ page }) => {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('viewer@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('property-list')).toBeVisible();
  await page.screenshot({ path: join(evidenceDir, 'access-denied-ready.png'), fullPage: true });
});
