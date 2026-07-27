import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';

async function signIn(page: Page, email: string) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('staff-workspace')).toBeVisible();
}

test('staff can navigate mobile and desktop shell routes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, 'staff.hotel@aurora.test');

  await expect(page.getByRole('navigation', { name: 'Staff navigation' })).toContainText('Inbox');
  await page.getByRole('link', { name: 'My work' }).first().click();
  await expect(page).toHaveURL(/\/my-work$/);
  await page.getByRole('link', { name: 'Messages' }).first().click();
  await expect(page).toHaveURL(/\/messages$/);

  const history = page.getByRole('link', { name: 'History and completed work archive' });
  await history.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/history$/);

  await expect(page.getByTestId('admin-only-note')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Portal' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Analytics and operational performance reporting' })).toHaveCount(0);
});

test('content manager without request access is denied staff workspace', async ({ page }) => {
  await signIn(page, 'content@aurora.test');
  await expect(page.getByTestId('access-denied')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Staff navigation' })).toHaveCount(0);
});

test('mobile bottom nav meets touch target size at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await signIn(page, 'staff.hotel@aurora.test');

  const mobileNav = page.getByRole('navigation', { name: 'Mobile staff navigation' });
  await expect(mobileNav).toBeVisible();
  const box = await mobileNav.getByRole('link').first().boundingBox();
  expect(box).toBeTruthy();
  expect((box?.height ?? 0) >= 44).toBe(true);
  expect((box?.width ?? 0) >= 44).toBe(true);

  await mobileNav.getByRole('link', { name: 'More' }).click();
  await expect(page).toHaveURL(/\/more$/);
});

test('staff shell has no critical axe violations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, 'staff.hotel@aurora.test');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious).toEqual([]);
});

for (const width of [360, 390, 768, 1280]) {
  test(`shell has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, 'staff.hotel@aurora.test');
    const screenshotPath = fileURLToPath(
      new URL(`../../../evidence/phase-02/02.4/screenshots/staff-shell-${width}.png`, import.meta.url),
    );
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
}
