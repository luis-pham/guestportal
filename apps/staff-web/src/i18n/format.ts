import { resolveLocale, type AppLocale } from './config';

export function formatDate(value: Date | string | number, locale: string, timeZone = 'Asia/Ho_Chi_Minh') {
  const resolved = resolveLocale(locale);
  return new Intl.DateTimeFormat(resolved === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export function formatNumber(value: number, locale: string) {
  const resolved = resolveLocale(locale);
  return new Intl.NumberFormat(resolved === 'vi' ? 'vi-VN' : 'en-US').format(value);
}

export function formatCurrency(value: number, locale: AppLocale | string, currency = 'VND') {
  const resolved = resolveLocale(locale);
  return new Intl.NumberFormat(resolved === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value);
}
