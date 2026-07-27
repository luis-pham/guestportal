import { expect, type APIResponse, type Page } from '@playwright/test';

export const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function cookieValue(response: APIResponse, name: string) {
  const header = response
    .headersArray()
    .find((item) => item.name.toLowerCase() === 'set-cookie' && item.value.startsWith(`${name}=`));
  const value = header?.value.split(';')[0]?.split('=').slice(1).join('=');
  expect(value).toBeTruthy();
  return value!;
}

function cookieUrls() {
  const urls = new Set([apiBase()]);
  const parsed = new URL(apiBase());
  if (parsed.hostname === 'localhost') {
    parsed.hostname = '127.0.0.1';
    urls.add(parsed.toString());
  } else if (parsed.hostname === '127.0.0.1') {
    parsed.hostname = 'localhost';
    urls.add(parsed.toString());
  }
  return [...urls];
}

export async function signIn(page: Page, email: string, locale = 'en') {
  const login = await page.request.post(`${apiBase()}/v1/auth/login`, {
    data: { email, password: 'Password123!' },
  });
  expect(login.ok()).toBeTruthy();
  const value = cookieValue(login, 'gp_session');
  await page.setExtraHTTPHeaders({ Cookie: `gp_session=${value}` });
  await page.context().addCookies(
    cookieUrls().map((url) => ({
      name: 'gp_session',
      value,
      url,
      httpOnly: true,
      sameSite: 'Lax',
    })),
  );
  await page.goto(`/${locale}/inbox`);
  await expect(page.getByTestId('staff-workspace')).toBeVisible({ timeout: 30_000 });
}
