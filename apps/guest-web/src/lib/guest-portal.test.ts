import { describe, expect, it } from 'vitest';
import { locationSafeHref, pickLocalized } from './guest-portal';

describe('guest portal helpers', () => {
  it('keeps relative links under the QR token path', () => {
    expect(locationSafeHref('tok', '/explore')).toBe('/g/tok/explore');
    expect(locationSafeHref('tok', 'guide')).toBe('/g/tok/guide');
    expect(locationSafeHref('tok', 'https://example.com')).toBe('https://example.com');
  });

  it('picks VI/EN localized copy', () => {
    expect(pickLocalized({ vi: 'Xin chào', en: 'Hello' }, 'vi')).toBe('Xin chào');
    expect(pickLocalized({ vi: 'Xin chào', en: 'Hello' }, 'en')).toBe('Hello');
  });
});
