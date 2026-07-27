import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const evidenceDir = resolve(process.cwd(), '../../evidence/phase-05/05.1/screenshots');

async function signIn(page: Page) {
  await page.goto('/en/login');
  await page.getByTestId('login-email').fill('owner@aurora.test');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('module-workspace')).toBeVisible({ timeout: 30_000 });
}

test('knowledge sources panel shows upload failure for unsupported mime', async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true });
  await signIn(page);
  await page.getByRole('link', { name: 'Property settings' }).click();
  const propertyId = page.url().match(/\/properties\/([^/]+)\//)?.[1];
  expect(propertyId).toBeTruthy();

  await page.goto(`/en/properties/${propertyId}/knowledge`);
  await expect(page.getByTestId('knowledge-sources-panel')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('knowledge-title').fill('Bad file');
  await page.setInputFiles('[data-testid="knowledge-file"]', {
    name: 'malware.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('not-a-document'),
  });
  await expect(page.getByTestId('knowledge-error')).toBeVisible();
  await expect(page.getByTestId('knowledge-error')).toContainText(/PDF|DOCX|TXT|HTML|Markdown/i);
  await page.screenshot({
    path: resolve(evidenceDir, 'knowledge-upload-failure-1280.png'),
    fullPage: true,
  });
});
