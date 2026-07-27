import { describe, expect, it } from 'vitest';
import {
  qrCreateRequestSchema,
  qrResolveRequestSchema,
  qrResolveResponseSchema,
  qrUpdateRequestSchema,
} from './qr.js';

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describe('qr contracts', () => {
  it('accepts create with location and default destination', () => {
    const parsed = qrCreateRequestSchema.parse({
      locationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(parsed.destinationType).toBe('portal_home');
  });

  it('rejects empty update payloads', () => {
    expect(() => qrUpdateRequestSchema.parse({})).toThrow();
  });

  it('rejects short resolve tokens', () => {
    expect(() => qrResolveRequestSchema.parse({ token: 'short' })).toThrow();
  });

  it('resolve response never includes internal ids', () => {
    const response = qrResolveResponseSchema.parse({
      valid: true,
      guestPath: '/g/opaque-token-value-with-enough-length',
      property: {
        name: 'Aurora',
        slug: 'aurora-city-hotel',
        timezone: 'Asia/Ho_Chi_Minh',
        defaultLocale: 'en',
        supportedLocales: ['en', 'vi'],
      },
      location: { code: 'lobby', name: { vi: 'Sảnh', en: 'Lobby' } },
      destination: { type: 'portal_home' },
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(UUID_RE);
    expect(serialized).not.toContain('organization');
    expect(serialized).not.toContain('propertyId');
  });
});
