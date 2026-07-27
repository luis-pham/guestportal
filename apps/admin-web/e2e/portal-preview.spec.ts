import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible();
}

async function openPreview(page: Page) {
  await signIn(page);
  await page.getByRole('link', { name: 'Property settings' }).click();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();
  await page.goto(`/en/properties/${propertyId}/portal/preview`);
  await expect(page.getByTestId('portal-preview-panel')).toBeVisible();
  return propertyId!;
}

test('preview switches locale/device and uses draft source', async ({ page }) => {
  await openPreview(page);
  await expect(page.getByTestId('portal-preview-frame')).toHaveAttribute('data-source', 'draft');
  await page.getByTestId('preview-locale').selectOption('vi');
  await expect(page.getByTestId('portal-preview-frame')).toHaveAttribute('data-locale', 'vi');
  await page.getByTestId('preview-device').selectOption('tablet');
  await expect(page.getByTestId('portal-preview-frame')).toHaveAttribute('data-device', 'tablet');
  await expect(page.getByTestId('preview-greeting')).toBeVisible();
  await expect(page.getByTestId('preview-primary-nav')).toBeVisible();
});

test('navigation editor persists primary href', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Property settings' }).click();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  await page.goto(`/en/properties/${propertyId}/portal/navigation`);
  await expect(page.getByTestId('portal-nav-editor')).toBeVisible();
  await page.getByTestId('nav-primary-href-0').fill('/home-preview');
  await page.getByTestId('portal-nav-save').click();
  await expect(page.getByTestId('portal-nav-saved')).toBeVisible();
});

test('preview responsive snapshots', async ({ page }) => {
  await openPreview(page);
  const dir = join(process.cwd(), '../../evidence/phase-03/03.5/screenshots');
  mkdirSync(dir, { recursive: true });
  for (const width of [390, 430, 1280, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(dir, `portal-preview-${width}.png`), fullPage: true });
  }
});
