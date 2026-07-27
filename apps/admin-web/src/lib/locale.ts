import { localeCookieName, type AppLocale } from '../i18n/config';

export function persistLocalePreference(locale: AppLocale) {
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
  try {
    window.localStorage.setItem(localeCookieName, locale);
  } catch {
    // ignore private-mode storage failures
  }
}

export function localeHref(locale: AppLocale, pathname: string) {
  const stripped = pathname.replace(/^\/(vi|en)/, '');
  if (!stripped || stripped === '/') {
    return `/${locale}`;
  }
  return `/${locale}${stripped}`;
}
