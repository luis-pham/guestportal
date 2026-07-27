import { describe, expect, it } from 'vitest';
import {
  guestPublicContextSchema,
  guestSessionCreateRequestSchema,
} from './guest-session.js';

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describe('guest session contracts', () => {
  it('rejects malformed QR tokens on session create', () => {
    expect(() => guestSessionCreateRequestSchema.parse({ token: 'short' })).toThrow();
  });

  it('public context excludes internal ids', () => {
    const parsed = guestPublicContextSchema.parse({
      locale: 'en',
      expiresAt: new Date().toISOString(),
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
    expect(JSON.stringify(parsed)).not.toMatch(UUID_RE);
  });
});
