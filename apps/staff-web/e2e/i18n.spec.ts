import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('staff.hotel@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('staff-workspace')).toBeVisible();
}

test('staff locale switch persists cookie and route', async ({ page, context }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'My work' }).first().click();
  await expect(page).toHaveURL(/\/en\/my-work$/);
  await page.getByTestId('locale-switch').click();
  await expect(page).toHaveURL(/\/vi\/my-work$/);
  await expect(page.getByTestId('long-fixture')).toContainText('Hướng dẫn phối hợp nhân viên');
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === 'NEXT_LOCALE' && cookie.value === 'vi')).toBe(true);
});

for (const width of [360, 1024, 1440]) {
  for (const locale of ['en', 'vi'] as const) {
    test(`staff long translation has no overflow at ${width}px (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/login`);
      await page.getByTestId('login-email').fill('staff.hotel@aurora.test');
      await page.getByTestId('login-password').fill('Password123!');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('long-fixture')).toBeVisible();
      const screenshotPath = fileURLToPath(
        new URL(
          `../../../evidence/phase-02/02.5/screenshots/staff-i18n-${locale}-${width}.png`,
          import.meta.url,
        ),
      );
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBe(false);
    });
  }
}
