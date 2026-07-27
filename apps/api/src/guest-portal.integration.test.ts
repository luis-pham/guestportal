import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { resetRateLimits } from './services/rate-limit.js';
import { GUEST_SESSION_COOKIE } from './services/guest-sessions.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('guest portal homepage API', () => {
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
    const cookie = response.cookies.find((item) => item.name === 'gp_session');
    const body = response.json() as { activeOrganizationId: string };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  it('returns published branding with asset fallbacks', async () => {
    resetRateLimits();
    const owner = await login('owner@aurora.test');
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
    });
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;

    const draft = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: owner.cookie },
    });
    const draftVersion = draft.json().version as number;
    const publish = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/portal/publish`,
      headers: { cookie: owner.cookie },
      payload: {
        expectedDraftVersion: draftVersion,
        idempotencyKey: `guest-portal-${propertyId}-${Date.now()}`,
      },
    });
    expect(publish.statusCode).toBe(200);

    const locations = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/locations`,
      headers: { cookie: owner.cookie },
    });
    const locationId = (locations.json() as { locations: Array<{ id: string }> }).locations[0]!.id;
    const qr = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie: owner.cookie },
      payload: { locationId },
    });
    const token = qr.json().token as string;

    const session = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token },
    });
    expect(session.statusCode).toBe(200);
    const guestCookie = session.cookies.find((c) => c.name === GUEST_SESSION_COOKIE)!;

    const portal = await app.inject({
      method: 'GET',
      url: '/v1/guest/portal',
      headers: { cookie: `${GUEST_SESSION_COOKIE}=${guestCookie.value}` },
    });
    expect(portal.statusCode).toBe(200);
    const body = portal.json();
    expect(body.portal.versionNumber).toBeGreaterThanOrEqual(1);
    expect(body.fallbacks.missingLogo).toBe(true);
    expect(body.fallbacks.missingCover).toBe(true);
    expect(body.branding.logoUrl).toBeNull();
    expect(body.branding.coverUrl).toBeNull();
    expect(body.portal.config.sections.some((s: { type: string }) => s.type === 'hero')).toBe(true);
  });
});
