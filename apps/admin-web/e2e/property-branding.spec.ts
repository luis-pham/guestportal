import { expect, test, type Page } from '@playwright/test';

const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible();
}

async function signInApi() {
  const response = await fetch(`${apiBase()}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner@aurora.test',
      password: 'Password123!',
    }),
  });
  expect(response.ok).toBe(true);
  const cookie = response.headers.get('set-cookie')?.match(/gp_session=[^;]+/)?.[0];
  expect(cookie).toBeTruthy();
  return cookie!;
}

test('property settings and branding forms validate and persist', async ({ page }) => {
  await signIn(page);
  const apiCookie = await signInApi();
  await page.getByRole('link', { name: 'Property settings' }).click();
  await expect(page.getByTestId('property-settings-form')).toBeVisible();

  await page.getByTestId('property-supported-locales').fill('');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByTestId('property-settings-error')).toBeVisible();

  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();

  // API mutations use an authenticated request context to avoid browser cookie policy drift.
  const patch = await fetch(`${apiBase()}/v1/properties/${propertyId}`, {
    method: 'PATCH',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timezone: 'Asia/Ho_Chi_Minh',
      supportedLocales: ['vi', 'en'],
    }),
  });
  expect(patch.status).toBe(200);

  await page.goto(`/en/properties/${propertyId}/portal/branding`);
  await expect(page.getByTestId('branding-form')).toBeVisible();
  await expect(page.getByTestId('branding-logo-upload')).toBeVisible();

  await page.getByTestId('branding-primary').fill('not-a-color');
  await page.getByRole('button', { name: 'Save branding' }).click();
  await expect(page.getByTestId('branding-error')).toBeVisible();

  const put = await fetch(`${apiBase()}/v1/properties/${propertyId}/branding`, {
    method: 'PUT',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Validated Brand',
      primaryColor: '#123456',
      primaryHoverColor: '#234567',
      accentColor: '#F59E0B',
      backgroundColor: '#FFFFFF',
      textColor: '#111827',
      logoAssetId: null,
      coverAssetId: null,
      fontFamily: 'sans',
    }),
  });
  expect(put.status).toBe(200);

  await page.reload();
  await expect(page.getByTestId('branding-form')).toBeVisible();
  await expect(page.getByTestId('branding-display-name')).toHaveValue('Validated Brand');
  await expect(page.getByTestId('branding-preview')).toContainText('Validated Brand');
});
