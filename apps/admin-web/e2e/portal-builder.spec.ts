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

async function openBuilder(page: Page) {
  await signIn(page);
  await page.getByRole('link', { name: 'Property settings' }).click();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();
  await page.goto(`/en/properties/${propertyId}/portal/homepage`);
  await expect(page.getByTestId('portal-builder')).toBeVisible();
  return propertyId!;
}

test('builder supports selection, reorder, inspector and keyboard smoke', async ({ page }) => {
  await openBuilder(page);

  const first = page.locator('[data-testid^="builder-section-"]').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('builder-inspector-type')).toBeVisible();

  const firstId = (await first.getAttribute('data-testid'))?.replace('builder-section-', '');
  expect(firstId).toBeTruthy();
  await page.getByTestId(`builder-move-down-${firstId}`).click();
  await expect(page.getByTestId('builder-save-state')).toBeVisible();

  await page.getByTestId('builder-add-hero').click();
  const heroes = page.locator('[data-section-type="hero"]');
  await expect(heroes.last()).toBeVisible();
  await heroes.last().click();
  await page.getByTestId('builder-inspector-title-en').fill('Builder Hero Title');
  await expect(page.getByTestId('builder-save-state')).toContainText(/Saving|Saved|Unsaved/i);

  // Invalid HTML blocked client-side
  await page.getByTestId('builder-inspector-title-en').fill('<script>x</script>');
  await expect(page.getByTestId('portal-builder-error')).toBeVisible({ timeout: 5000 });
});

test('builder autosave failure is recoverable via retry', async ({ page }) => {
  const propertyId = await openBuilder(page);

  await page.route(`**/v1/properties/${propertyId}/portal/draft`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'fail' } }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByTestId('builder-add-contact_help').click();
  await expect(page.getByTestId('builder-save-state')).toHaveAttribute('data-state', 'error', {
    timeout: 10_000,
  });

  await page.unroute(`**/v1/properties/${propertyId}/portal/draft`);
  await page.getByTestId('builder-retry-save').click();
  await expect(page.getByTestId('builder-save-state')).toHaveAttribute('data-state', 'saved', {
    timeout: 10_000,
  });
});

test('builder visual snapshots at 1280 and 1440', async ({ page }) => {
  await openBuilder(page);
  const dir = join(process.cwd(), '../../evidence/phase-03/03.4/screenshots');
  mkdirSync(dir, { recursive: true });

  for (const width of [1280, 1440] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: join(dir, `portal-builder-${width}.png`),
      fullPage: true,
    });
  }
});
