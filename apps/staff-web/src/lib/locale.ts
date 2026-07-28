import { localeCookieName, type AppLocale } from '../i18n/config';
import { appHref } from './base-path';

export function persistLocalePreference(locale: AppLocale) {
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=31536000; samesite=lax`;
  try {
    window.localStorage.setItem(localeCookieName, locale);
  } catch {
    // ignore private-mode storage failures
  }
}

export function localeHref(locale: AppLocale, pathname: string) {
  const stripped = pathname.replace(/^\/(vi|en)/, '') || '/inbox';
  return appHref(`/${locale}${stripped.startsWith('/') ? stripped : `/${stripped}`}`);
}
