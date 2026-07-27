import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function signIn(page: Page, email: string) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible();
}

test('owner can navigate the shell and use the keyboard collapse control', async ({ page }) => {
  await signIn(page, 'owner@aurora.test');

  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toContainText('Portal');
  await page.getByRole('link', { name: 'Portal' }).click();
  await expect(page).toHaveURL(/\/properties\/[^/]+\/portal$/);

  const collapse = page.getByRole('button', { name: 'Collapse primary navigation' });
  await collapse.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Expand primary navigation' })).toBeVisible();
});

test('viewer sees only permitted navigation', async ({ page }) => {
  await signIn(page, 'viewer@aurora.test');

  await expect(page.getByRole('link', { name: 'Team and access management' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Organization settings and security controls' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Portal' })).toBeVisible();
});

for (const width of [1024, 1280, 1440]) {
  test(`shell has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, 'owner@aurora.test');
    const screenshotPath = fileURLToPath(
      new URL(`../../../evidence/phase-02/02.3/screenshots/admin-shell-${width}.png`, import.meta.url),
    );
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

test('Vietnamese labels remain usable', async ({ page }) => {
  await signIn(page, 'owner@aurora.test');
  await page.getByTestId('locale-switch').click();
  await expect(page.getByRole('link', { name: 'Phân tích và báo cáo hiệu suất vận hành chuyên sâu' })).toBeVisible();
});
