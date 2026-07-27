import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, getMessageFallback, resolveLocale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale((await requestLocale) ?? defaultLocale);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    getMessageFallback,
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[i18n]', error.message);
      }
    },
  };
});
