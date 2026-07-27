import { expect, test, type Page } from '@playwright/test';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible();
}

async function signInApi() {
  const response = await fetch(`${apiBase}/v1/auth/login`, {
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

test('branding upload UI shows controls and rejects invalid files', async ({ page }) => {
  await signIn(page);
  const apiCookie = await signInApi();
  await page.getByRole('link', { name: 'Property settings' }).click();
  await expect(page.getByTestId('property-settings-form')).toBeVisible();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();

  await page.goto(`/en/properties/${propertyId}/portal/branding`);
  await expect(page.getByTestId('branding-form')).toBeVisible();
  await expect(page.getByTestId('branding-logo-upload')).toBeVisible();
  await expect(page.getByTestId('branding-cover-upload')).toBeVisible();

  const dir = mkdtempSync(join(tmpdir(), 'gp-upload-'));
  const badFile = join(dir, 'notes.txt');
  writeFileSync(badFile, 'not-an-image');

  await page.getByTestId('branding-logo-upload-input').setInputFiles(badFile);
  await expect(page.getByTestId('branding-logo-upload-error')).toBeVisible();

  // Happy-path upload uses Playwright request (no browser CORS) against real R2 via API.
  // Browser direct PUT requires Cloudflare R2 bucket CORS for admin origins.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const presign = await fetch(`${apiBase}/v1/uploads/presign`, {
    method: 'POST',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purpose: 'branding_logo',
      filename: 'logo-e2e.png',
      mimeType: 'image/png',
      sizeBytes: png.length,
      propertyId,
    }),
  });
  expect(presign.status).toBe(200);
  const body = (await presign.json()) as {
    assetId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  };

  const put = await fetch(body.uploadUrl, {
    method: 'PUT',
    headers: body.requiredHeaders,
    body: png,
  });
  expect(put.ok).toBeTruthy();

  const complete = await fetch(`${apiBase}/v1/uploads/complete`, {
    method: 'POST',
    headers: { Cookie: apiCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId: body.assetId }),
  });
  expect(complete.status).toBe(200);

  const del = await fetch(`${apiBase}/v1/assets/${body.assetId}`, {
    method: 'DELETE',
    headers: { Cookie: apiCookie },
  });
  expect(del.status).toBe(200);
});
