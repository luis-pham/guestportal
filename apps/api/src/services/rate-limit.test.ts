import { describe, expect, it, beforeEach } from 'vitest';
import { consumeRateLimit, resetRateLimits } from './rate-limit.js';

describe('rate limit', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows traffic under the limit and blocks after', () => {
    const key = 'test-key';
    for (let i = 0; i < 3; i += 1) {
      expect(consumeRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = consumeRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
