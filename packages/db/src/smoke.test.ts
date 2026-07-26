import { describe, expect, it } from 'vitest';
import { organizations } from './schema.js';

describe('db schema foundation', () => {
  it('exposes organizations table metadata', () => {
    expect(organizations).toBeTruthy();
  });
});
