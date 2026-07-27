import createMiddleware from 'next-intl/middleware';
import { defaultLocale, localeCookieName, locales } from './i18n/config';

export default createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
  localeCookie: {
    name: localeCookieName,
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const config = {
  matcher: ['/', '/(vi|en)/:path*'],
};
