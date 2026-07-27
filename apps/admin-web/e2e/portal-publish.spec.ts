import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible();
}

test('publish and rollback create auditable versions', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Property settings' }).click();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();

  await page.goto(`/en/properties/${propertyId}/portal/publish-history`);
  await expect(page.getByTestId('portal-publish-history')).toBeVisible();
  await page.getByTestId('portal-publish-button').click();
  await expect(page.getByTestId('portal-publish-status')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('portal-version-list').locator('li').first()).toBeVisible();

  const firstRestore = page.locator('[data-testid^="portal-restore-"]').first();
  await firstRestore.click();
  await expect(page.getByTestId('portal-publish-status')).toContainText(/Restored|khôi phục/i);
});
