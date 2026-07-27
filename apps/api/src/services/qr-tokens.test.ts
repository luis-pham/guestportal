import { describe, expect, it } from 'vitest';
import { assertOpaqueQrToken, createOpaqueQrToken, hashQrToken } from './qr-tokens.js';

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describe('qr tokens', () => {
  it('mints high-entropy opaque tokens without UUID shapes', () => {
    const samples = Array.from({ length: 20 }, () => createOpaqueQrToken());
    const unique = new Set(samples);
    expect(unique.size).toBe(20);
    for (const token of samples) {
      expect(token.length).toBeGreaterThanOrEqual(43);
      expect(token).not.toMatch(UUID_RE);
      assertOpaqueQrToken(token);
      expect(hashQrToken(token)).toHaveLength(64);
    }
  });
});
