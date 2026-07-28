import { describe, expect, it } from 'vitest';
import {
  adminAnalyticsDashboardResponseSchema,
  adminAnalyticsQuerySchema,
} from './analytics.js';

describe('analytics contracts', () => {
  it('validates date ranges with timezone', () => {
    expect(
      adminAnalyticsQuerySchema.parse({
        dateFrom: '2026-07-01T00:00:00.000+07:00',
        dateTo: '2026-07-31T23:59:59.999+07:00',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    ).toMatchObject({ timezone: 'Asia/Ho_Chi_Minh' });

    expect(() =>
      adminAnalyticsQuerySchema.parse({
        dateFrom: '2026-08-01T00:00:00.000Z',
        dateTo: '2026-07-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('accepts the dashboard response shape', () => {
    expect(
      adminAnalyticsDashboardResponseSchema.parse({
        dashboard: {
          propertyId: 'a7f0b10f-2b68-4d0f-a0a9-3205a7de2ee2',
          timezone: 'Asia/Ho_Chi_Minh',
          dateFrom: '2026-07-01T00:00:00.000Z',
          dateTo: '2026-08-01T00:00:00.000Z',
          summary: {
            guestSessions: 4,
            qrScanTotal: 9,
            recentlyScannedQrCodes: 2,
            requests: 3,
            openRequests: 1,
            completedRequests: 2,
            orders: 5,
            openOrders: 3,
            completedOrders: 2,
            revenueMinor: 125000,
            medianRequestResponseSeconds: 240,
            medianOrderFulfillmentSeconds: null,
          },
          requestsByStatus: [{ status: 'submitted', count: 1 }],
          ordersByStatus: [{ status: 'completed', count: 2 }],
          daily: [
            {
              date: '2026-07-27',
              guestSessions: 2,
              requests: 1,
              orders: 2,
              revenueMinor: 50000,
            },
          ],
          topServices: [
            {
              label: 'Breakfast tray',
              quantity: 2,
              orderCount: 2,
              revenueMinor: 50000,
            },
          ],
        },
      }),
    ).toBeTruthy();
  });
});
