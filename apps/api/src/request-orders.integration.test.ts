import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { GUEST_SESSION_COOKIE } from './services/guest-sessions.js';
import { resetRateLimits } from './services/rate-limit.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('request/order lifecycle operations', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetRateLimits();
  });

  async function login(email: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((item) => item.name === 'gp_session');
    const body = response.json() as { activeOrganizationId: string };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  async function createGuestContext() {
    const owner = await login('owner@aurora.test');
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
    });
    expect(list.statusCode).toBe(200);
    const property = (
      list.json() as { properties: Array<{ id: string; slug: string }> }
    ).properties.find((item) => item.slug === 'aurora-city-hotel');
    expect(property).toBeTruthy();
    const propertyId = property!.id;
    const locations = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/locations`,
      headers: { cookie: owner.cookie },
    });
    expect(locations.statusCode).toBe(200);
    const locationId = (locations.json() as { locations: Array<{ id: string }> }).locations[0]!.id;
    const qr = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie: owner.cookie },
      payload: { locationId },
    });
    expect(qr.statusCode).toBe(200);
    const session = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: qr.json().token, locale: 'vi' },
    });
    expect(session.statusCode).toBe(200);
    const guestCookie = session.cookies.find((item) => item.name === GUEST_SESSION_COOKIE);
    return {
      propertyId,
      guestCookie: `${GUEST_SESSION_COOKIE}=${guestCookie!.value}`,
    };
  }

  async function createConversation(guestCookie: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/guest/conversations',
      headers: { cookie: guestCookie },
      payload: { locale: 'vi', retentionPolicy: 'standard_30_days' },
    });
    expect(response.statusCode).toBe(200);
    return response.json().conversation.id as string;
  }

  async function createSubmittedRequest() {
    const context = await createGuestContext();
    const conversationId = await createConversation(context.guestCookie);
    const draft = await app.inject({
      method: 'POST',
      url: '/v1/guest/request-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId,
        requestType: 'housekeeping',
        title: 'Extra towels',
        details: 'Please bring two towels.',
      },
    });
    expect(draft.statusCode).toBe(200);
    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/request-drafts/${draft.json().draft.id}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `phase08-request-${draft.json().draft.id}` },
    });
    expect(confirm.statusCode).toBe(200);
    return { context, requestId: confirm.json().request.id as string };
  }

  it('transitions requests with optimistic versioning, history, outbox, and audit', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const { requestId } = await createSubmittedRequest();

    const acceptPayload = { expectedVersion: 1, idempotencyKey: `accept-${requestId}` };
    const accepted = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/accept`,
      headers: { cookie: staff.cookie },
      payload: acceptPayload,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().request).toMatchObject({
      id: requestId,
      status: 'accepted',
      version: 2,
    });
    expect(accepted.json().request.acceptedAt).toBeTruthy();

    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/accept`,
      headers: { cookie: staff.cookie },
      payload: acceptPayload,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({ idempotentReplay: true });
    expect(duplicate.json().request.version).toBe(2);

    const invalid = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/complete`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 2, idempotencyKey: `invalid-complete-${requestId}` },
    });
    expect(invalid.statusCode).toBe(409);
    expect(invalid.json().error.code).toBe('REQUEST_INVALID_TRANSITION');

    const stale = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/start`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `stale-start-${requestId}` },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('VERSION_CONFLICT');

    const started = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/start`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 2, idempotencyKey: `start-${requestId}` },
    });
    expect(started.statusCode).toBe(200);
    expect(started.json().request).toMatchObject({ status: 'in_progress', version: 3 });

    const completed = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/complete`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 3, idempotencyKey: `complete-${requestId}` },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().request).toMatchObject({ status: 'completed', version: 4 });
    expect(completed.json().request.completedAt).toBeTruthy();

    const rows = await app.sql<
      {
        history_count: string;
        status_event_count: string;
        audit_count: string;
      }[]
    >`
      SELECT
        (
          SELECT count(*)::text
          FROM request_status_history
          WHERE request_id = ${requestId}::uuid
        ) AS history_count,
        (
          SELECT count(*)::text
          FROM outbox_events
          WHERE aggregate_id = ${requestId}
            AND event_type = 'request.status_changed.v1'
        ) AS status_event_count,
        (
          SELECT count(*)::text
          FROM audit_logs
          WHERE resource_type = 'request'
            AND resource_id = ${requestId}
            AND action = 'request.status_changed'
        ) AS audit_count
    `;
    expect(rows[0]).toEqual({ history_count: '4', status_event_count: '3', audit_count: '3' });
  });

  it('keeps order item and price snapshots immutable after confirmation', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const context = await createGuestContext();
    const conversationId = await createConversation(context.guestCookie);
    const draft = await app.inject({
      method: 'POST',
      url: '/v1/guest/order-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId,
        title: 'Coffee order',
        items: [
          {
            itemId: 'coffee',
            label: 'Vietnamese coffee',
            quantity: 2,
            unitPriceMinor: 450,
            currency: 'USD',
            optionsSnapshot: { size: 'small' },
          },
        ],
      },
    });
    expect(draft.statusCode).toBe(200);
    const draftId = draft.json().draft.id as string;
    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/order-drafts/${draftId}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `phase08-order-${draftId}` },
    });
    expect(confirm.statusCode).toBe(200);
    const orderId = confirm.json().order.id as string;
    expect(confirm.json().order).toMatchObject({
      status: 'submitted',
      version: 1,
      subtotalMinor: 900,
      totalMinor: 900,
    });

    await app.sql`
      UPDATE order_drafts
      SET items = ${JSON.stringify([
        {
          itemId: 'coffee',
          label: 'Mutated catalog label',
          quantity: 9,
          unitPriceMinor: 99999,
          currency: 'USD',
          optionsSnapshot: { size: 'large' },
          notes: '',
          metadata: {},
        },
      ])}::jsonb
      WHERE id = ${draftId}::uuid
    `;

    const rows = await app.sql<
      {
        items: Array<{ label: string; quantity: number; unitPriceMinor: number }>;
        subtotal_minor: number;
        total_minor: number;
      }[]
    >`
      SELECT items, subtotal_minor, total_minor
      FROM guest_orders
      WHERE id = ${orderId}::uuid
    `;
    expect(rows[0]?.items).toEqual([
      expect.objectContaining({
        label: 'Vietnamese coffee',
        quantity: 2,
        unitPriceMinor: 450,
      }),
    ]);
    expect(rows[0]).toMatchObject({ subtotal_minor: 900, total_minor: 900 });

    const confirmed = await app.inject({
      method: 'POST',
      url: `/v1/staff/orders/${orderId}/confirm`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `confirm-order-${orderId}` },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().order).toMatchObject({ status: 'confirmed', version: 2 });

    const invalid = await app.inject({
      method: 'POST',
      url: `/v1/staff/orders/${orderId}/ready`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 2, idempotencyKey: `invalid-ready-${orderId}` },
    });
    expect(invalid.statusCode).toBe(409);
    expect(invalid.json().error.code).toBe('ORDER_INVALID_TRANSITION');
  });

  it('denies staff transitions outside assigned tenant property', async () => {
    const cruiseStaff = await login('staff.cruise@aurora.test');
    const { requestId } = await createSubmittedRequest();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/accept`,
      headers: { cookie: cruiseStaff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `foreign-staff-${requestId}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });
});
