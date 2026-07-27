import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { GUEST_SESSION_COOKIE } from './services/guest-sessions.js';
import { resetRateLimits } from './services/rate-limit.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('realtime outbox delivery', () => {
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
    const message = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversationId}/messages`,
      headers: { cookie: context.guestCookie },
      payload: {
        text: 'Realtime towel request',
        originalLanguage: 'en',
        clientMessageId: `realtime-message-${conversationId}`,
      },
    });
    expect(message.statusCode).toBe(200);
    const draft = await app.inject({
      method: 'POST',
      url: '/v1/guest/request-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId,
        requestType: 'housekeeping',
        title: `Realtime towels ${Date.now()}`,
        details: 'Please bring two towels.',
      },
    });
    expect(draft.statusCode).toBe(200);
    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/request-drafts/${draft.json().draft.id}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `realtime-request-${draft.json().draft.id}` },
    });
    expect(confirm.statusCode).toBe(200);
    return {
      ...context,
      conversationId,
      requestId: confirm.json().request.id as string,
    };
  }

  it('replays tenant-scoped staff events and converges after reconnect without duplicates', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const foreignStaff = await login('staff.cruise@aurora.test');
    const created = await createSubmittedRequest();

    const denied = await app.inject({
      method: 'GET',
      url: `/v1/staff/realtime/events?propertyId=${created.propertyId}`,
      headers: { cookie: foreignStaff.cookie },
    });
    expect(denied.statusCode).toBe(403);

    const first = await app.inject({
      method: 'GET',
      url: `/v1/staff/realtime/events?propertyId=${created.propertyId}&limit=20`,
      headers: { cookie: staff.cookie },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      reconnectAfterMs: 1500,
      notificationsSupported: ['in_app'],
    });
    const submitted = (first.json().events as Array<{ id: string; type: string; aggregateId: string }>)
      .find((event) => event.type === 'request.submitted.v1' && event.aggregateId === created.requestId);
    expect(submitted).toBeTruthy();

    const accept = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${created.requestId}/accept`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `realtime-accept-${created.requestId}` },
    });
    expect(accept.statusCode).toBe(200);

    const replay = await app.inject({
      method: 'GET',
      url: `/v1/staff/realtime/events?propertyId=${created.propertyId}&lastEventId=${submitted!.id}&limit=20`,
      headers: { cookie: staff.cookie },
    });
    expect(replay.statusCode).toBe(200);
    const replayEvents = replay.json().events as Array<{ id: string; type: string; aggregateId: string }>;
    expect(replayEvents.some((event) => event.id === submitted!.id)).toBe(false);
    const statusChanged = replayEvents.find(
      (event) => event.type === 'request.status_changed.v1' && event.aggregateId === created.requestId,
    );
    expect(statusChanged).toBeTruthy();

    const empty = await app.inject({
      method: 'GET',
      url: `/v1/staff/realtime/events?propertyId=${created.propertyId}&lastEventId=${statusChanged!.id}&limit=20`,
      headers: { cookie: staff.cookie },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().events).toEqual([]);
  });

  it('delivers only the guest session events needed for status convergence', async () => {
    const staff = await login('staff.hotel@aurora.test');
    const created = await createSubmittedRequest();
    const foreignGuest = await createGuestContext();

    const guestEvents = await app.inject({
      method: 'GET',
      url: '/v1/guest/realtime/events?limit=20',
      headers: { cookie: created.guestCookie },
    });
    expect(guestEvents.statusCode).toBe(200);
    const submitted = (
      guestEvents.json().events as Array<{ id: string; type: string; aggregateId: string; payload: Record<string, string> }>
    ).find((event) => event.type === 'request.submitted.v1' && event.aggregateId === created.requestId);
    expect(submitted?.payload.guestSessionId).toBeTruthy();

    const accept = await app.inject({
      method: 'POST',
      url: `/v1/staff/requests/${created.requestId}/accept`,
      headers: { cookie: staff.cookie },
      payload: { expectedVersion: 1, idempotencyKey: `guest-realtime-accept-${created.requestId}` },
    });
    expect(accept.statusCode).toBe(200);

    const statusEvents = await app.inject({
      method: 'GET',
      url: `/v1/guest/realtime/events?lastEventId=${submitted!.id}&limit=20`,
      headers: { cookie: created.guestCookie },
    });
    expect(statusEvents.statusCode).toBe(200);
    expect(statusEvents.json().events).toEqual([
      expect.objectContaining({
        type: 'request.status_changed.v1',
        aggregateId: created.requestId,
        payload: expect.objectContaining({
          guestSessionId: expect.any(String),
          nextStatus: 'accepted',
        }),
      }),
    ]);

    const foreignEvents = await app.inject({
      method: 'GET',
      url: '/v1/guest/realtime/events?limit=20',
      headers: { cookie: foreignGuest.guestCookie },
    });
    expect(foreignEvents.statusCode).toBe(200);
    expect(
      (foreignEvents.json().events as Array<{ aggregateId: string }>).some(
        (event) => event.aggregateId === created.requestId,
      ),
    ).toBe(false);
  });
});
