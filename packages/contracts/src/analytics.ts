import { z } from 'zod';

const datetimeWithOffsetSchema = z.string().datetime({ offset: true });

export const adminAnalyticsQuerySchema = z
  .object({
    dateFrom: datetimeWithOffsetSchema.optional(),
    dateTo: datetimeWithOffsetSchema.optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || Date.parse(input.dateFrom) <= Date.parse(input.dateTo),
    {
      message: 'dateFrom must be before dateTo',
      path: ['dateFrom'],
    },
  );

export const analyticsStatusCountSchema = z.object({
  status: z.string(),
  count: z.number().int().min(0),
});

export const analyticsDailyBucketSchema = z.object({
  date: z.string(),
  guestSessions: z.number().int().min(0),
  requests: z.number().int().min(0),
  orders: z.number().int().min(0),
  revenueMinor: z.number().int().min(0),
});

export const analyticsTopServiceSchema = z.object({
  label: z.string(),
  quantity: z.number().int().min(0),
  orderCount: z.number().int().min(0),
  revenueMinor: z.number().int().min(0),
});

export const adminAnalyticsDashboardSchema = z.object({
  propertyId: z.string().uuid(),
  timezone: z.string(),
  dateFrom: datetimeWithOffsetSchema,
  dateTo: datetimeWithOffsetSchema,
  summary: z.object({
    guestSessions: z.number().int().min(0),
    qrScanTotal: z.number().int().min(0),
    recentlyScannedQrCodes: z.number().int().min(0),
    requests: z.number().int().min(0),
    openRequests: z.number().int().min(0),
    completedRequests: z.number().int().min(0),
    orders: z.number().int().min(0),
    openOrders: z.number().int().min(0),
    completedOrders: z.number().int().min(0),
    revenueMinor: z.number().int().min(0),
    medianRequestResponseSeconds: z.number().int().min(0).nullable(),
    medianOrderFulfillmentSeconds: z.number().int().min(0).nullable(),
  }),
  requestsByStatus: z.array(analyticsStatusCountSchema),
  ordersByStatus: z.array(analyticsStatusCountSchema),
  daily: z.array(analyticsDailyBucketSchema),
  topServices: z.array(analyticsTopServiceSchema),
});

export const adminAnalyticsDashboardResponseSchema = z.object({
  dashboard: adminAnalyticsDashboardSchema,
});

export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;
export type AnalyticsStatusCount = z.infer<typeof analyticsStatusCountSchema>;
export type AnalyticsDailyBucket = z.infer<typeof analyticsDailyBucketSchema>;
export type AnalyticsTopService = z.infer<typeof analyticsTopServiceSchema>;
export type AdminAnalyticsDashboard = z.infer<typeof adminAnalyticsDashboardSchema>;
export type AdminAnalyticsDashboardResponse = z.infer<
  typeof adminAnalyticsDashboardResponseSchema
>;
