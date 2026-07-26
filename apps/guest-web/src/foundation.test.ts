import { describe, expect, it } from 'vitest';
import { colorTokens } from '@guestportal/ui';

describe('guest-web foundation', () => {
  it('shares semantic color tokens', () => {
    expect(colorTokens).toContain('brand');
  });
});
