import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatNumber } from './format';
import { getMessageFallback, resolveLocale } from './config';

describe('admin i18n formatting', () => {
  it('formats dates by locale', () => {
    const value = new Date('2026-07-26T10:30:00+07:00');
    expect(formatDate(value, 'en')).toMatch(/Jul/);
    expect(formatDate(value, 'vi')).toMatch(/2026/);
  });

  it('formats numbers and currency by locale', () => {
    expect(formatNumber(1234567.89, 'en')).toMatch(/1,234,567/);
    expect(formatNumber(1234567.89, 'vi')).toMatch(/1\.234\.567/);
    expect(formatCurrency(150000, 'vi')).toMatch(/150/);
    expect(formatCurrency(150000, 'en', 'USD')).toMatch(/150/);
  });

  it('falls back unknown locales to vi and missing keys to dotted paths', () => {
    expect(resolveLocale('fr')).toBe('vi');
    expect(getMessageFallback({ namespace: 'shell', key: 'missingExample' })).toBe(
      'shell.missingExample',
    );
  });
});
