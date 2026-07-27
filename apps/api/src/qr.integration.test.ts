import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { resetRateLimits } from './services/rate-limit.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describeIntegration('qr token lifecycle', () => {
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

  async function firstProperty(cookie: string, organizationId: string) {
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    return (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;
  }

  it('creates opaque tokens, resolves, disables, downloads, and enforces permissions', async () => {
    const owner = await login('owner@aurora.test');
    const propertyId = await firstProperty(owner.cookie, owner.body.activeOrganizationId);

    const locations = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/locations`,
      headers: { cookie: owner.cookie },
    });
    expect(locations.statusCode).toBe(200);
    const locationId = (
      locations.json() as { locations: Array<{ id: string }> }
    ).locations[0]!.id;

    const created = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie: owner.cookie },
      payload: { locationId, destinationType: 'portal_home' },
    });
    expect(created.statusCode).toBe(200);
    const createBody = created.json() as {
      token: string;
      guestPath: string;
      qrCode: { id: string; scanCount: number };
    };
    expect(createBody.token.length).toBeGreaterThanOrEqual(43);
    expect(createBody.token).not.toMatch(UUID_RE);
    expect(createBody.token).not.toContain(propertyId);
    expect(createBody.token).not.toContain(locationId);
    expect(createBody.guestPath).toBe(`/g/${createBody.token}`);

    const resolveOk = await app.inject({
      method: 'POST',
      url: '/v1/guest/resolve-qr',
      payload: { token: createBody.token },
    });
    expect(resolveOk.statusCode).toBe(200);
    const resolved = resolveOk.json();
    expect(resolved.valid).toBe(true);
    expect(JSON.stringify(resolved)).not.toMatch(UUID_RE);
    expect(resolved.destination.type).toBe('portal_home');

    const reassigned = await app.inject({
      method: 'PATCH',
      url: `/v1/properties/${propertyId}/qr-codes/${createBody.qrCode.id}`,
      headers: { cookie: owner.cookie },
      payload: { destinationType: 'guide' },
    });
    expect(reassigned.statusCode).toBe(200);

    const resolveGuide = await app.inject({
      method: 'POST',
      url: '/v1/guest/resolve-qr',
      payload: { token: createBody.token },
    });
    expect(resolveGuide.statusCode).toBe(200);
    expect(resolveGuide.json().destination.type).toBe('guide');

    const svg = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/qr-codes/${createBody.qrCode.id}/download?format=svg`,
      headers: { cookie: owner.cookie },
    });
    expect(svg.statusCode).toBe(200);
    expect(svg.headers['content-type']).toContain('image/svg+xml');
    expect(svg.body).toContain('<svg');

    const disabled = await app.inject({
      method: 'PATCH',
      url: `/v1/properties/${propertyId}/qr-codes/${createBody.qrCode.id}`,
      headers: { cookie: owner.cookie },
      payload: { enabled: false },
    });
    expect(disabled.statusCode).toBe(200);

    const resolveDisabled = await app.inject({
      method: 'POST',
      url: '/v1/guest/resolve-qr',
      payload: { token: createBody.token },
    });
    expect(resolveDisabled.statusCode).toBe(404);
    expect(resolveDisabled.json().error.code).toBe('QR_INVALID');

    const unknown = await app.inject({
      method: 'POST',
      url: '/v1/guest/resolve-qr',
      payload: { token: 'unknown-token-value-with-enough-length-abc' },
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('QR_INVALID');

    const viewer = await login('viewer@aurora.test');
    const viewerCreate = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie: viewer.cookie },
      payload: { locationId },
    });
    expect(viewerCreate.statusCode).toBe(403);

    const nomad = await login('owner@nomad.test');
    const cross = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie: nomad.cookie },
    });
    expect(cross.statusCode).toBe(403);
  });

  it('rate limits QR resolution', async () => {
    resetRateLimits();
    let blocked = false;
    for (let i = 0; i < 40; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/guest/resolve-qr',
        payload: { token: `rate-limit-probe-token-${String(i).padStart(3, '0')}-xxxxxx` },
        remoteAddress: '203.0.113.50',
      });
      if (response.statusCode === 429) {
        blocked = true;
        expect(response.json().error.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(blocked).toBe(true);
  });
});
