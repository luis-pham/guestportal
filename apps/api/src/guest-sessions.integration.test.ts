import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { guestSessions } from '@guestportal/db';
import { buildApp } from './app.js';
import { resetRateLimits } from './services/rate-limit.js';
import { GUEST_SESSION_COOKIE, hashGuestSessionToken } from './services/guest-sessions.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describeIntegration('guest sessions', () => {
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
    const cookie = response.cookies.find((item) => item.name === 'gp_session');
    const body = response.json() as { activeOrganizationId: string };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  async function mintQr(cookie: string, organizationId: string) {
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;
    const locations = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/locations`,
      headers: { cookie },
    });
    const locationId = (locations.json() as { locations: Array<{ id: string }> }).locations[0]!
      .id;
    const created = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie },
      payload: { locationId },
    });
    return {
      propertyId,
      token: created.json().token as string,
      qrId: created.json().qrCode.id as string,
    };
  }

  it('creates scoped guest sessions with minimal public context', async () => {
    const owner = await login('owner@aurora.test');
    const qr = await mintQr(owner.cookie, owner.body.activeOrganizationId);

    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: 'too-short' },
    });
    expect(malformed.statusCode).toBe(400);

    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: 'unknown-token-value-with-enough-length-zzz' },
    });
    expect(invalid.statusCode).toBe(404);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: qr.token, locale: 'vi' },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json();
    expect(body.locale).toBe('vi');
    expect(JSON.stringify(body)).not.toMatch(UUID_RE);
    expect(body).not.toHaveProperty('organizationId');
    expect(body).not.toHaveProperty('propertyId');
    expect(body).not.toHaveProperty('sessionId');

    const guestCookie = created.cookies.find((item) => item.name === GUEST_SESSION_COOKIE);
    expect(guestCookie?.value).toBeTruthy();

    const me = await app.inject({
      method: 'GET',
      url: '/v1/guest/session',
      headers: { cookie: `${GUEST_SESSION_COOKIE}=${guestCookie!.value}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().property.slug).toBeTruthy();
    expect(JSON.stringify(me.json())).not.toContain(qr.token);

    const missing = await app.inject({
      method: 'GET',
      url: '/v1/guest/session',
    });
    expect(missing.statusCode).toBe(401);

    // Expire this session and ensure GET fails.
    await app.db
      .update(guestSessions)
      .set({ expiresAt: new Date(Date.now() - 1000), status: 'expired' })
      .where(eq(guestSessions.tokenHash, hashGuestSessionToken(guestCookie!.value)));

    const expired = await app.inject({
      method: 'GET',
      url: '/v1/guest/session',
      headers: { cookie: `${GUEST_SESSION_COOKIE}=${guestCookie!.value}` },
    });
    expect(expired.statusCode).toBe(401);
  });

  it('isolates guest sessions across properties/orgs', async () => {
    const aurora = await login('owner@aurora.test');
    const nomad = await login('owner@nomad.test');
    const auroraQr = await mintQr(aurora.cookie, aurora.body.activeOrganizationId);
    const nomadQr = await mintQr(nomad.cookie, nomad.body.activeOrganizationId);

    const auroraSession = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: auroraQr.token },
    });
    const nomadSession = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: nomadQr.token },
    });
    expect(auroraSession.statusCode).toBe(200);
    expect(nomadSession.statusCode).toBe(200);
    expect(auroraSession.json().property.slug).not.toBe(nomadSession.json().property.slug);

    const auroraCookie = auroraSession.cookies.find((c) => c.name === GUEST_SESSION_COOKIE)!;
    const me = await app.inject({
      method: 'GET',
      url: '/v1/guest/session',
      headers: { cookie: `${GUEST_SESSION_COOKIE}=${auroraCookie.value}` },
    });
    expect(me.json().property.slug).toBe(auroraSession.json().property.slug);
    expect(me.json().property.slug).not.toBe(nomadSession.json().property.slug);
  });
});
