import type { Sql } from 'postgres';
import type {
  AdminAnalyticsDashboard,
  AnalyticsDailyBucket,
  AnalyticsStatusCount,
  AnalyticsTopService,
} from '@guestportal/contracts';

export type AnalyticsDateRange = {
  dateFrom?: string;
  dateTo?: string;
  timezone?: string;
};

export type AnalyticsScope = {
  organizationId: string;
  propertyId: string;
  propertyTimezone: string;
};

type DashboardInput = AnalyticsScope & AnalyticsDateRange;

type QueryBounds = {
  dateFrom: Date;
  dateTo: Date;
  timezone: string;
};

const DEFAULT_WINDOW_DAYS = 30;

function asInteger(value: unknown) {
  if (typeof value === 'number') return Math.trunc(value);
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function asNullableSeconds(value: unknown) {
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : null;
}

function toIsoDate(date: Date) {
  return date.toISOString();
}

export function resolveAnalyticsBounds(input: DashboardInput, now = new Date()): QueryBounds {
  const dateTo = input.dateTo ? new Date(input.dateTo) : now;
  const dateFrom = input.dateFrom
    ? new Date(input.dateFrom)
    : new Date(dateTo.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    throw new Error('Invalid analytics date range');
  }
  if (dateFrom.getTime() > dateTo.getTime()) {
    throw new Error('dateFrom must be before dateTo');
  }
  return {
    dateFrom,
    dateTo,
    timezone: input.timezone ?? input.propertyTimezone,
  };
}

function whereScope(
  organizationId: string,
  propertyId: string,
  dateFrom: Date,
  dateTo: Date,
) {
  return {
    organizationId,
    propertyId,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  };
}

export async function getAdminAnalyticsDashboard(
  sql: Sql,
  input: DashboardInput,
): Promise<AdminAnalyticsDashboard> {
  const bounds = resolveAnalyticsBounds(input);
  const scope = whereScope(
    input.organizationId,
    input.propertyId,
    bounds.dateFrom,
    bounds.dateTo,
  );

  const [
    sessionRows,
    qrRows,
    requestSummaryRows,
    orderSummaryRows,
    requestStatusRows,
    orderStatusRows,
    dailyRows,
    topServiceRows,
  ] = await Promise.all([
    sql<{ count: string }[]>`
      SELECT count(*)::text AS count
      FROM guest_sessions
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
        AND created_at >= ${scope.dateFrom}
        AND created_at < ${scope.dateTo}
    `,
    sql<{ scan_total: string; recently_scanned: string }[]>`
      SELECT
        coalesce(sum(scan_count), 0)::text AS scan_total,
        count(*) FILTER (
          WHERE last_scanned_at >= ${scope.dateFrom}
            AND last_scanned_at < ${scope.dateTo}
        )::text AS recently_scanned
      FROM qr_codes
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
    `,
    sql<
      {
        total: string;
        open_count: string;
        completed_count: string;
        median_response_seconds: number | null;
      }[]
    >`
      SELECT
        count(*)::text AS total,
        count(*) FILTER (
          WHERE status NOT IN ('completed', 'cancelled', 'rejected')
        )::text AS open_count,
        count(*) FILTER (WHERE status = 'completed')::text AS completed_count,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY extract(epoch FROM (accepted_at - submitted_at))
        ) FILTER (WHERE accepted_at IS NOT NULL) AS median_response_seconds
      FROM guest_requests
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
        AND submitted_at >= ${scope.dateFrom}
        AND submitted_at < ${scope.dateTo}
    `,
    sql<
      {
        total: string;
        open_count: string;
        completed_count: string;
        revenue_minor: string;
        median_fulfillment_seconds: number | null;
      }[]
    >`
      SELECT
        count(*)::text AS total,
        count(*) FILTER (
          WHERE status NOT IN ('completed', 'cancelled')
        )::text AS open_count,
        count(*) FILTER (WHERE status = 'completed')::text AS completed_count,
        coalesce(sum(total_minor), 0)::text AS revenue_minor,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY extract(epoch FROM (completed_at - submitted_at))
        ) FILTER (WHERE completed_at IS NOT NULL) AS median_fulfillment_seconds
      FROM guest_orders
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
        AND submitted_at >= ${scope.dateFrom}
        AND submitted_at < ${scope.dateTo}
    `,
    sql<{ status: string; count: string }[]>`
      SELECT status, count(*)::text AS count
      FROM guest_requests
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
        AND submitted_at >= ${scope.dateFrom}
        AND submitted_at < ${scope.dateTo}
      GROUP BY status
      ORDER BY status
    `,
    sql<{ status: string; count: string }[]>`
      SELECT status, count(*)::text AS count
      FROM guest_orders
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
        AND submitted_at >= ${scope.dateFrom}
        AND submitted_at < ${scope.dateTo}
      GROUP BY status
      ORDER BY status
    `,
    sql<
      {
        date: string;
        guest_sessions: string;
        requests: string;
        orders: string;
        revenue_minor: string;
      }[]
    >`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${scope.dateFrom}::timestamptz AT TIME ZONE ${bounds.timezone}),
          date_trunc('day', (${scope.dateTo}::timestamptz - interval '1 millisecond') AT TIME ZONE ${bounds.timezone}),
          interval '1 day'
        )::date AS bucket_date
      ),
      sessions AS (
        SELECT
          date_trunc('day', created_at AT TIME ZONE ${bounds.timezone})::date AS bucket_date,
          count(*)::int AS total
        FROM guest_sessions
        WHERE organization_id = ${scope.organizationId}::uuid
          AND property_id = ${scope.propertyId}::uuid
          AND created_at >= ${scope.dateFrom}
          AND created_at < ${scope.dateTo}
        GROUP BY bucket_date
      ),
      requests AS (
        SELECT
          date_trunc('day', submitted_at AT TIME ZONE ${bounds.timezone})::date AS bucket_date,
          count(*)::int AS total
        FROM guest_requests
        WHERE organization_id = ${scope.organizationId}::uuid
          AND property_id = ${scope.propertyId}::uuid
          AND submitted_at >= ${scope.dateFrom}
          AND submitted_at < ${scope.dateTo}
        GROUP BY bucket_date
      ),
      orders AS (
        SELECT
          date_trunc('day', submitted_at AT TIME ZONE ${bounds.timezone})::date AS bucket_date,
          count(*)::int AS total,
          coalesce(sum(total_minor), 0)::int AS revenue_minor
        FROM guest_orders
        WHERE organization_id = ${scope.organizationId}::uuid
          AND property_id = ${scope.propertyId}::uuid
          AND submitted_at >= ${scope.dateFrom}
          AND submitted_at < ${scope.dateTo}
        GROUP BY bucket_date
      )
      SELECT
        days.bucket_date::text AS date,
        coalesce(sessions.total, 0)::text AS guest_sessions,
        coalesce(requests.total, 0)::text AS requests,
        coalesce(orders.total, 0)::text AS orders,
        coalesce(orders.revenue_minor, 0)::text AS revenue_minor
      FROM days
      LEFT JOIN sessions USING (bucket_date)
      LEFT JOIN requests USING (bucket_date)
      LEFT JOIN orders USING (bucket_date)
      ORDER BY days.bucket_date
      LIMIT 62
    `,
    sql<
      {
        label: string;
        quantity: string;
        order_count: string;
        revenue_minor: string;
      }[]
    >`
      SELECT
        coalesce(item->>'label', item->>'itemId', 'Unknown service') AS label,
        coalesce(sum((item->>'quantity')::int), 0)::text AS quantity,
        count(DISTINCT guest_orders.id)::text AS order_count,
        coalesce(sum(((item->>'quantity')::int) * ((item->>'unitPriceMinor')::int)), 0)::text AS revenue_minor
      FROM guest_orders
      CROSS JOIN LATERAL jsonb_array_elements(items) AS item
      WHERE organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
        AND submitted_at >= ${scope.dateFrom}
        AND submitted_at < ${scope.dateTo}
      GROUP BY label
      ORDER BY quantity DESC, label ASC
      LIMIT 10
    `,
  ]);

  const requestSummary = requestSummaryRows[0];
  const orderSummary = orderSummaryRows[0];

  const requestsByStatus: AnalyticsStatusCount[] = requestStatusRows.map((row) => ({
    status: row.status,
    count: asInteger(row.count),
  }));
  const ordersByStatus: AnalyticsStatusCount[] = orderStatusRows.map((row) => ({
    status: row.status,
    count: asInteger(row.count),
  }));
  const daily: AnalyticsDailyBucket[] = dailyRows.map((row) => ({
    date: row.date,
    guestSessions: asInteger(row.guest_sessions),
    requests: asInteger(row.requests),
    orders: asInteger(row.orders),
    revenueMinor: asInteger(row.revenue_minor),
  }));
  const topServices: AnalyticsTopService[] = topServiceRows.map((row) => ({
    label: row.label,
    quantity: asInteger(row.quantity),
    orderCount: asInteger(row.order_count),
    revenueMinor: asInteger(row.revenue_minor),
  }));

  return {
    propertyId: input.propertyId,
    timezone: bounds.timezone,
    dateFrom: toIsoDate(bounds.dateFrom),
    dateTo: toIsoDate(bounds.dateTo),
    summary: {
      guestSessions: asInteger(sessionRows[0]?.count),
      qrScanTotal: asInteger(qrRows[0]?.scan_total),
      recentlyScannedQrCodes: asInteger(qrRows[0]?.recently_scanned),
      requests: asInteger(requestSummary?.total),
      openRequests: asInteger(requestSummary?.open_count),
      completedRequests: asInteger(requestSummary?.completed_count),
      orders: asInteger(orderSummary?.total),
      openOrders: asInteger(orderSummary?.open_count),
      completedOrders: asInteger(orderSummary?.completed_count),
      revenueMinor: asInteger(orderSummary?.revenue_minor),
      medianRequestResponseSeconds: asNullableSeconds(requestSummary?.median_response_seconds),
      medianOrderFulfillmentSeconds: asNullableSeconds(
        orderSummary?.median_fulfillment_seconds,
      ),
    },
    requestsByStatus,
    ordersByStatus,
    daily,
    topServices,
  };
}
