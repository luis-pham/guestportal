import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

type LoginBody = {
  activeOrganizationId: string;
};

type PropertySummary = {
  id: string;
  slug: string;
};

type AnalyticsResponse = {
  dashboard: {
    summary: {
      guestSessions: number;
      qrScanTotal: number;
      recentlyScannedQrCodes: number;
      requests: number;
      openRequests: number;
      completedRequests: number;
      orders: number;
      openOrders: number;
      completedOrders: number;
      revenueMinor: number;
      medianRequestResponseSeconds: number | null;
      medianOrderFulfillmentSeconds: number | null;
    };
    requestsByStatus: Array<{ status: string; count: number }>;
    ordersByStatus: Array<{ status: string; count: number }>;
    daily: Array<{ date: string; guestSessions: number; requests: number; orders: number }>;
    topServices: Array<{ label: string; quantity: number; revenueMinor: number }>;
  };
};

describeIntegration('admin analytics dashboard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((item) => item.name === 'gp_session');
    expect(cookie?.value).toBeTruthy();
    return {
      cookie: `gp_session=${cookie!.value}`,
      body: response.json() as LoginBody,
    };
  }

  async function propertyBySlug(cookie: string, organizationId: string, slug: string) {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const property = (response.json() as { properties: PropertySummary[] }).properties.find(
      (item) => item.slug === slug,
    );
    expect(property).toBeTruthy();
    return property!;
  }

  async function firstLocation(propertyId: string) {
    const rows = await app.sql<{ id: string }[]>`
      SELECT id
      FROM locations
      WHERE property_id = ${propertyId}::uuid
      ORDER BY code
      LIMIT 1
    `;
    expect(rows[0]).toBeTruthy();
    return rows[0]!.id;
  }

  async function insertDashboardFixture(input: {
    organizationId: string;
    propertyId: string;
    locationId: string;
    marker: string;
    submittedAt: string;
    status?: string;
    orderStatus?: string;
  }) {
    const requestStatus = input.status ?? 'completed';
    const orderStatus = input.orderStatus ?? 'completed';
    await app.sql`
      WITH qr AS (
        INSERT INTO qr_codes (
          organization_id,
          property_id,
          location_id,
          public_token,
          public_token_hash,
          destination_type,
          enabled,
          scan_count,
          last_scanned_at
        )
        VALUES (
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          ${input.locationId}::uuid,
          ${`analytics-${input.marker}`},
          ${`analytics-hash-${input.marker}`},
          'portal_home',
          true,
          7,
          ${input.submittedAt}::timestamptz
        )
        RETURNING id
      ),
      session AS (
        INSERT INTO guest_sessions (
          organization_id,
          property_id,
          location_id,
          qr_code_id,
          token_hash,
          locale,
          expires_at,
          created_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          ${input.locationId}::uuid,
          qr.id,
          ${`session-hash-${input.marker}`},
          'en',
          ${input.submittedAt}::timestamptz + interval '1 day',
          ${input.submittedAt}::timestamptz
        FROM qr
        RETURNING id
      ),
      conversation AS (
        INSERT INTO conversations (
          organization_id,
          property_id,
          guest_session_id,
          locale,
          retention_policy,
          retention_expires_at,
          created_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          session.id,
          'en',
          'standard_30_days',
          ${input.submittedAt}::timestamptz + interval '30 days',
          ${input.submittedAt}::timestamptz
        FROM session
        RETURNING id, guest_session_id
      ),
      request_draft AS (
        INSERT INTO request_drafts (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          status,
          request_type,
          title,
          details,
          locale,
          expires_at,
          created_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          conversation.guest_session_id,
          conversation.id,
          'confirmed',
          'housekeeping',
          ${`Analytics request ${input.marker}`},
          'Need assistance',
          'en',
          ${input.submittedAt}::timestamptz + interval '1 day',
          ${input.submittedAt}::timestamptz
        FROM conversation
        RETURNING id, conversation_id, guest_session_id
      ),
      inserted_request AS (
        INSERT INTO guest_requests (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          request_draft_id,
          status,
          request_type,
          title,
          details,
          locale,
          idempotency_key,
          submitted_at,
          accepted_at,
          completed_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          request_draft.guest_session_id,
          request_draft.conversation_id,
          request_draft.id,
          ${requestStatus}::text,
          'housekeeping',
          ${`Analytics request ${input.marker}`},
          'Need assistance',
          'en',
          ${`request-key-${input.marker}`},
          ${input.submittedAt}::timestamptz,
          ${input.submittedAt}::timestamptz + interval '4 minutes',
          CASE
            WHEN ${requestStatus}::text = 'completed'
              THEN ${input.submittedAt}::timestamptz + interval '18 minutes'
            ELSE NULL::timestamptz
          END
        FROM request_draft
        RETURNING id
      ),
      order_draft AS (
        INSERT INTO order_drafts (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          status,
          title,
          items,
          locale,
          expires_at,
          created_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          conversation.guest_session_id,
          conversation.id,
          'confirmed',
          ${`Analytics order ${input.marker}`},
          jsonb_build_array(
            jsonb_build_object(
              'itemId', ${`svc-${input.marker}`}::text,
              'label', ${`Analytics breakfast ${input.marker}`}::text,
              'quantity', 2,
              'unitPriceMinor', 12500,
              'currency', 'USD',
              'optionsSnapshot', jsonb_build_object(),
              'notes', '',
              'metadata', jsonb_build_object()
            )
          ),
          'en',
          ${input.submittedAt}::timestamptz + interval '1 day',
          ${input.submittedAt}::timestamptz
        FROM conversation
        RETURNING id, conversation_id, guest_session_id, items
      )
      INSERT INTO guest_orders (
        organization_id,
        property_id,
        guest_session_id,
        conversation_id,
        order_draft_id,
        status,
        title,
        items,
        currency,
        subtotal_minor,
        total_minor,
        locale,
        idempotency_key,
        submitted_at,
        confirmed_at,
        completed_at
      )
      SELECT
        ${input.organizationId}::uuid,
        ${input.propertyId}::uuid,
        order_draft.guest_session_id,
        order_draft.conversation_id,
        order_draft.id,
        ${orderStatus}::text,
        ${`Analytics order ${input.marker}`},
        order_draft.items,
        'USD',
        25000,
        25000,
        'en',
        ${`order-key-${input.marker}`},
        ${input.submittedAt}::timestamptz,
        ${input.submittedAt}::timestamptz + interval '5 minutes',
        CASE
          WHEN ${orderStatus}::text = 'completed'
            THEN ${input.submittedAt}::timestamptz + interval '32 minutes'
          ELSE NULL::timestamptz
        END
      FROM order_draft
    `;
  }

  it('aggregates QR, sessions, requests, orders and top services from tenant data', async () => {
    const owner = await login('owner@aurora.test');
    const property = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-city-hotel',
    );
    await insertDashboardFixture({
      organizationId: owner.body.activeOrganizationId,
      propertyId: property.id,
      locationId: await firstLocation(property.id),
      marker: crypto.randomUUID(),
      submittedAt: '2026-02-14T03:00:00.000Z',
    });

    const started = performance.now();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/analytics?dateFrom=2026-02-14T00:00:00.000Z&dateTo=2026-02-15T00:00:00.000Z`,
      headers: { cookie: owner.cookie },
    });
    const durationMs = performance.now() - started;
    expect(response.statusCode).toBe(200);
    expect(durationMs).toBeLessThan(1500);

    const body = response.json() as AnalyticsResponse;
    expect(body.dashboard.summary.guestSessions).toBeGreaterThanOrEqual(1);
    expect(body.dashboard.summary.qrScanTotal).toBeGreaterThanOrEqual(7);
    expect(body.dashboard.summary.recentlyScannedQrCodes).toBeGreaterThanOrEqual(1);
    expect(body.dashboard.summary.requests).toBeGreaterThanOrEqual(1);
    expect(body.dashboard.summary.completedRequests).toBeGreaterThanOrEqual(1);
    expect(body.dashboard.summary.orders).toBeGreaterThanOrEqual(1);
    expect(body.dashboard.summary.completedOrders).toBeGreaterThanOrEqual(1);
    expect(body.dashboard.summary.revenueMinor).toBeGreaterThanOrEqual(25000);
    expect(body.dashboard.summary.medianRequestResponseSeconds).toBe(240);
    expect(body.dashboard.summary.medianOrderFulfillmentSeconds).toBe(1920);
    expect(
      body.dashboard.requestsByStatus.find((item) => item.status === 'completed')?.count,
    ).toBeGreaterThanOrEqual(1);
    expect(
      body.dashboard.ordersByStatus.find((item) => item.status === 'completed')?.count,
    ).toBeGreaterThanOrEqual(1);
    expect(
      body.dashboard.topServices.some((item) => item.label.includes('Analytics breakfast')),
    ).toBe(true);
  });

  it('respects property timezone day boundaries', async () => {
    const owner = await login('owner@aurora.test');
    const property = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-city-hotel',
    );
    const locationId = await firstLocation(property.id);
    await insertDashboardFixture({
      organizationId: owner.body.activeOrganizationId,
      propertyId: property.id,
      locationId,
      marker: crypto.randomUUID(),
      submittedAt: '2026-02-13T17:10:00.000Z',
    });
    await insertDashboardFixture({
      organizationId: owner.body.activeOrganizationId,
      propertyId: property.id,
      locationId,
      marker: crypto.randomUUID(),
      submittedAt: '2026-02-13T16:50:00.000Z',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/analytics?dateFrom=2026-02-13T17:00:00.000Z&dateTo=2026-02-14T17:00:00.000Z&timezone=Asia%2FHo_Chi_Minh`,
      headers: { cookie: owner.cookie },
    });
    expect(response.statusCode).toBe(200);
    const localDay = (response.json() as AnalyticsResponse).dashboard.daily.find(
      (bucket) => bucket.date === '2026-02-14',
    );
    expect(localDay?.requests).toBeGreaterThanOrEqual(1);
    expect(localDay?.orders).toBeGreaterThanOrEqual(1);
  });

  it('prevents tenant leakage and enforces analytics permission', async () => {
    const owner = await login('owner@aurora.test');
    const content = await login('content@aurora.test');
    const nomadOwner = await login('owner@nomad.test');
    const property = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-city-hotel',
    );
    const nomadProperty = await propertyBySlug(
      nomadOwner.cookie,
      nomadOwner.body.activeOrganizationId,
      'old-quarter-loft',
    );
    const marker = crypto.randomUUID();
    await insertDashboardFixture({
      organizationId: nomadOwner.body.activeOrganizationId,
      propertyId: nomadProperty.id,
      locationId: await firstLocation(nomadProperty.id),
      marker,
      submittedAt: '2026-02-14T04:00:00.000Z',
    });

    const denied = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/analytics?dateFrom=2026-02-14T00:00:00.000Z&dateTo=2026-02-15T00:00:00.000Z`,
      headers: { cookie: content.cookie },
    });
    expect(denied.statusCode).toBe(403);

    const crossTenant = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${nomadProperty.id}/analytics?dateFrom=2026-02-14T00:00:00.000Z&dateTo=2026-02-15T00:00:00.000Z`,
      headers: { cookie: owner.cookie },
    });
    expect(crossTenant.statusCode).toBe(403);

    const auroraResponse = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/analytics?dateFrom=2026-02-14T00:00:00.000Z&dateTo=2026-02-15T00:00:00.000Z`,
      headers: { cookie: owner.cookie },
    });
    expect(auroraResponse.statusCode).toBe(200);
    const labels = (auroraResponse.json() as AnalyticsResponse).dashboard.topServices.map(
      (item) => item.label,
    );
    expect(labels.some((label) => label.includes(marker))).toBe(false);
  });

  it('keeps analytics predicates backed by database indexes', async () => {
    const rows = await app.sql<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY(${[
          'guest_requests_property_status_idx',
          'guest_orders_property_status_idx',
          'guest_sessions_property_idx',
          'qr_codes_property_idx',
        ]})
    `;
    expect(rows.map((row) => row.indexname).sort()).toEqual([
      'guest_orders_property_status_idx',
      'guest_requests_property_status_idx',
      'guest_sessions_property_idx',
      'qr_codes_property_idx',
    ]);
  });
});
