import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signIn } from './helpers';

test('staff locale switch persists cookie and route', async ({ page, context }) => {
  await signIn(page, 'staff.hotel@aurora.test');
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
      await signIn(page, 'staff.hotel@aurora.test', locale);
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
