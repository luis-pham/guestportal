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
    const token = qr.json().token as string;
    const session = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token, locale: 'vi' },
    });
    expect(session.statusCode).toBe(200);
    const guestCookie = session.cookies.find((item) => item.name === GUEST_SESSION_COOKIE);
    return {
      propertyId,
      token,
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

  async function createSubmittedOrder() {
    const context = await createGuestContext();
    const conversationId = await createConversation(context.guestCookie);
    const draft = await app.inject({
      method: 'POST',
      url: '/v1/guest/order-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId,
        title: 'Breakfast tray',
        items: [
          {
            itemId: 'breakfast-tray',
            label: 'Breakfast tray',
            quantity: 1,
            unitPriceMinor: 0,
            currency: 'USD',
          },
        ],
      },
    });
    expect(draft.statusCode).toBe(200);
    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/order-drafts/${draft.json().draft.id}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `phase08-order-${draft.json().draft.id}` },
    });
    expect(confirm.statusCode).toBe(200);
    return { context, orderId: confirm.json().order.id as string };
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

  it('atomically claims requests with race safety, optimistic concurrency, permissions, and audit', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const manager = await login('manager.hotel@aurora.test');
    const viewer = await login('viewer@aurora.test');
    const { context, requestId } = await createSubmittedRequest();

    const stale = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/claim`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 99, idempotencyKey: `stale-claim-${requestId}` },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('VERSION_CONFLICT');

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/claim`,
      headers: { cookie: viewer.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `viewer-claim-${requestId}` },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('FORBIDDEN');

    const [staffClaim, managerClaim] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/staff/requests/${requestId}/claim`,
        headers: { cookie: staff.cookie },
        payload: { expectedVersion: 1, idempotencyKey: `race-staff-${requestId}` },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/staff/requests/${requestId}/claim`,
        headers: { cookie: manager.cookie },
        payload: { expectedVersion: 1, idempotencyKey: `race-manager-${requestId}` },
      }),
    ]);
    const successes = [staffClaim, managerClaim].filter((response) => response.statusCode === 200);
    const conflicts = [staffClaim, managerClaim].filter((response) => response.statusCode === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.json().error.code).toBe('ALREADY_CLAIMED');
    expect(successes[0]!.json().request).toMatchObject({
      id: requestId,
      status: 'submitted',
      version: 2,
    });

    const winnerCookie = successes[0] === staffClaim ? staff.cookie : manager.cookie;
    const loserCookie = successes[0] === staffClaim ? manager.cookie : staff.cookie;
    const winnerReplayKey = successes[0] === staffClaim ? `race-staff-${requestId}` : `race-manager-${requestId}`;
    const winnerReplay = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/claim`,
      headers: { cookie: winnerCookie },
      payload: { expectedVersion: 1, idempotencyKey: winnerReplayKey },
    });
    expect(winnerReplay.statusCode).toBe(200);
    expect(winnerReplay.json()).toMatchObject({
      idempotentReplay: true,
      request: { id: requestId, version: 2 },
    });

    const loserTransition = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${requestId}/accept`,
      headers: { cookie: loserCookie },
      payload: { expectedVersion: 2, idempotencyKey: `loser-accept-${requestId}` },
    });
    expect(loserTransition.statusCode).toBe(409);
    expect(loserTransition.json().error.code).toBe('ALREADY_CLAIMED');

    const rows = await app.sql<
      {
        assigned_staff_id: string | null;
        version: number;
        assignment_event_count: string;
        audit_count: string;
      }[]
    >`
      SELECT
        r.assigned_staff_id,
        r.version,
        (
          SELECT count(*)::text
          FROM outbox_events
          WHERE aggregate_id = ${requestId}
            AND event_type = 'staff.assignment_changed.v1'
        ) AS assignment_event_count,
        (
          SELECT count(*)::text
          FROM audit_logs
          WHERE resource_type = 'request'
            AND resource_id = ${requestId}
            AND action = 'request.claimed'
        ) AS audit_count
      FROM guest_requests r
      WHERE r.id = ${requestId}::uuid
        AND r.property_id = ${context.propertyId}::uuid
    `;
    expect(rows[0]?.assigned_staff_id).toBe(successes[0]!.json().request.assignedStaffId);
    expect(rows[0]).toMatchObject({
      version: 2,
      assignment_event_count: '1',
      audit_count: '1',
    });
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

  it('claims orders once and denies cross-property staff', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const cruiseStaff = await login('staff.cruise@aurora.test');
    const { orderId } = await createSubmittedOrder();

    const claimed = await app.inject({
      method: 'POST',
      url: `/v1/staff/orders/${orderId}/claim`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `claim-order-${orderId}` },
    });
    expect(claimed.statusCode).toBe(200);
    expect(claimed.json()).toMatchObject({
      idempotentReplay: false,
      order: { id: orderId, status: 'submitted', version: 2 },
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/staff/orders/${orderId}/claim`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `claim-order-${orderId}` },
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      idempotentReplay: true,
      order: { id: orderId, version: 2 },
    });

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/staff/orders/${orderId}/claim`,
      headers: { cookie: cruiseStaff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `foreign-order-claim-${orderId}` },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('FORBIDDEN');
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

  it('lets guests list, inspect, and idempotently cancel their own submitted work', async () => {
    const { context, requestId } = await createSubmittedRequest();
    const conversationId = await createConversation(context.guestCookie);
    const orderDraft = await app.inject({
      method: 'POST',
      url: '/v1/guest/order-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId,
        title: 'Tea service',
        items: [
          {
            itemId: 'tea-service',
            label: 'Tea service',
            quantity: 2,
            unitPriceMinor: 0,
            currency: 'USD',
          },
        ],
      },
    });
    expect(orderDraft.statusCode).toBe(200);
    const orderConfirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/order-drafts/${orderDraft.json().draft.id}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `guest-list-order-${orderDraft.json().draft.id}` },
    });
    expect(orderConfirm.statusCode).toBe(200);
    const orderId = orderConfirm.json().order.id as string;

    const requests = await app.inject({
      method: 'GET',
      url: '/v1/guest/requests',
      headers: { cookie: context.guestCookie },
    });
    expect(requests.statusCode).toBe(200);
    expect(requests.json().requests).toEqual([
      expect.objectContaining({ id: requestId, status: 'submitted', title: 'Extra towels' }),
    ]);
    expect(requests.json().requests[0].kind).toBeUndefined();

    const orders = await app.inject({
      method: 'GET',
      url: '/v1/guest/orders',
      headers: { cookie: context.guestCookie },
    });
    expect(orders.statusCode).toBe(200);
    expect(orders.json().orders).toEqual([
      expect.objectContaining({ id: orderId, status: 'submitted', title: 'Tea service' }),
    ]);
    expect(orders.json().orders[0].kind).toBeUndefined();

    const reopened = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      headers: { cookie: context.guestCookie },
      payload: { token: context.token, locale: 'vi' },
    });
    expect(reopened.statusCode).toBe(200);
    const reopenedCookie =
      reopened.cookies.find((item) => item.name === GUEST_SESSION_COOKIE)?.value ??
      context.guestCookie.replace(`${GUEST_SESSION_COOKIE}=`, '');
    const reloadedRequests = await app.inject({
      method: 'GET',
      url: '/v1/guest/requests',
      headers: { cookie: `${GUEST_SESSION_COOKIE}=${reopenedCookie}` },
    });
    expect(reloadedRequests.statusCode).toBe(200);
    expect(reloadedRequests.json().requests).toEqual([
      expect.objectContaining({ id: requestId, status: 'submitted' }),
    ]);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/guest/requests/${requestId}`,
      headers: { cookie: context.guestCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().request).toMatchObject({ id: requestId, requestType: 'housekeeping' });

    const foreign = await createGuestContext();
    const denied = await app.inject({
      method: 'GET',
      url: `/v1/guest/orders/${orderId}`,
      headers: { cookie: foreign.guestCookie },
    });
    expect(denied.statusCode).toBe(404);
    expect(denied.json().error.code).toBe('ORDER_NOT_FOUND');

    const cancelPayload = { idempotencyKey: `guest-cancel-${requestId}`, reason: 'No longer needed' };
    const cancelled = await app.inject({
      method: 'POST',
      url: `/v1/guest/requests/${requestId}/cancel`,
      headers: { cookie: context.guestCookie },
      payload: cancelPayload,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({
      idempotentReplay: false,
      request: { id: requestId, status: 'cancelled', version: 2 },
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/guest/requests/${requestId}/cancel`,
      headers: { cookie: context.guestCookie },
      payload: cancelPayload,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      idempotentReplay: true,
      request: { id: requestId, status: 'cancelled', version: 2 },
    });

    const rows = await app.sql<{ cancel_count: string; status_event_count: string }[]>`
      SELECT
        (
          SELECT count(*)::text
          FROM request_status_history
          WHERE request_id = ${requestId}::uuid
            AND idempotency_key = ${cancelPayload.idempotencyKey}
        ) AS cancel_count,
        (
          SELECT count(*)::text
          FROM outbox_events
          WHERE aggregate_id = ${requestId}
            AND event_type = 'request.status_changed.v1'
        ) AS status_event_count
    `;
    expect(rows[0]).toEqual({ cancel_count: '1', status_event_count: '1' });
  });

  it('lets guests cancel submitted orders without creating duplicate transitions', async () => {
    const { context, orderId } = await createSubmittedOrder();
    const payload = { idempotencyKey: `guest-order-cancel-${orderId}` };
    const cancelled = await app.inject({
      method: 'POST',
      url: `/v1/guest/orders/${orderId}/cancel`,
      headers: { cookie: context.guestCookie },
      payload,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({
      idempotentReplay: false,
      order: { id: orderId, status: 'cancelled', version: 2 },
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/guest/orders/${orderId}/cancel`,
      headers: { cookie: context.guestCookie },
      payload,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      idempotentReplay: true,
      order: { id: orderId, status: 'cancelled', version: 2 },
    });
  });

  it('lists staff inbox items with details only for assigned properties', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const foreignStaff = await login('staff.cruise@aurora.test');
    const { context, requestId } = await createSubmittedRequest();
    const conversationId = await createConversation(context.guestCookie);
    const orderDraft = await app.inject({
      method: 'POST',
      url: '/v1/guest/order-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId,
        title: 'Fresh juice',
        items: [
          {
            itemId: 'fresh-juice',
            label: 'Fresh juice',
            quantity: 1,
            unitPriceMinor: 0,
            currency: 'USD',
          },
        ],
      },
    });
    expect(orderDraft.statusCode).toBe(200);
    const orderConfirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/order-drafts/${orderDraft.json().draft.id}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `staff-inbox-order-${orderDraft.json().draft.id}` },
    });
    expect(orderConfirm.statusCode).toBe(200);
    const orderId = orderConfirm.json().order.id as string;

    const inbox = await app.inject({
      method: 'GET',
      url: `/v1/staff/work-items?propertyId=${context.propertyId}&queue=inbox`,
      headers: { cookie: staff.cookie },
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'request',
          id: requestId,
          title: 'Extra towels',
          location: expect.objectContaining({ code: expect.any(String) }),
        }),
        expect.objectContaining({
          kind: 'order',
          id: orderId,
          title: 'Fresh juice',
          totalMinor: 0,
        }),
      ]),
    );

    const requestDetail = await app.inject({
      method: 'GET',
      url: `/v1/staff/requests/${requestId}`,
      headers: { cookie: staff.cookie },
    });
    expect(requestDetail.statusCode).toBe(200);
    expect(requestDetail.json()).toMatchObject({
      kind: 'request',
      request: { id: requestId, status: 'submitted' },
      assignee: null,
    });
    expect(requestDetail.json().messages.length).toBeGreaterThanOrEqual(1);
    expect(requestDetail.json().timeline).toEqual([
      expect.objectContaining({ nextStatus: 'submitted', actorType: 'guest' }),
    ]);

    const orderDetail = await app.inject({
      method: 'GET',
      url: `/v1/staff/orders/${orderId}`,
      headers: { cookie: staff.cookie },
    });
    expect(orderDetail.statusCode).toBe(200);
    expect(orderDetail.json()).toMatchObject({
      kind: 'order',
      order: { id: orderId, items: [expect.objectContaining({ label: 'Fresh juice' })] },
    });

    const denied = await app.inject({
      method: 'GET',
      url: `/v1/staff/work-items?propertyId=${context.propertyId}&queue=inbox`,
      headers: { cookie: foreignStaff.cookie },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('FORBIDDEN');
  });
});
