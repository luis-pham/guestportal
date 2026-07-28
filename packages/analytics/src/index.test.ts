import { describe, expect, it } from 'vitest';
import { resolveAnalyticsBounds } from './index.js';

const scope = {
  organizationId: 'org-1',
  propertyId: 'property-1',
  propertyTimezone: 'Asia/Ho_Chi_Minh',
};

describe('resolveAnalyticsBounds', () => {
  it('defaults to a 30 day window ending at now', () => {
    const bounds = resolveAnalyticsBounds(scope, new Date('2026-07-28T10:00:00.000Z'));

    expect(bounds.dateTo.toISOString()).toBe('2026-07-28T10:00:00.000Z');
    expect(bounds.dateFrom.toISOString()).toBe('2026-06-28T10:00:00.000Z');
    expect(bounds.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('uses explicit range and timezone overrides', () => {
    const bounds = resolveAnalyticsBounds({
      ...scope,
      dateFrom: '2026-07-01T00:00:00.000Z',
      dateTo: '2026-07-02T00:00:00.000Z',
      timezone: 'UTC',
    });

    expect(bounds.dateFrom.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(bounds.dateTo.toISOString()).toBe('2026-07-02T00:00:00.000Z');
    expect(bounds.timezone).toBe('UTC');
  });

  it('rejects invalid or reversed ranges', () => {
    expect(() =>
      resolveAnalyticsBounds({
        ...scope,
        dateFrom: 'not-a-date',
      }),
    ).toThrow('Invalid analytics date range');

    expect(() =>
      resolveAnalyticsBounds({
        ...scope,
        dateFrom: '2026-07-03T00:00:00.000Z',
        dateTo: '2026-07-02T00:00:00.000Z',
      }),
    ).toThrow('dateFrom must be before dateTo');
  });
});
