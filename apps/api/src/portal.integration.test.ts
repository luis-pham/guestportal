import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDefaultPortalConfig } from '@guestportal/contracts';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('portal draft and templates', () => {
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
    const body = response.json() as {
      memberships: Array<{ organizationId: string; propertyIds: string[] }>;
      activeOrganizationId: string;
    };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  async function firstPropertyId(cookie: string, organizationId: string) {
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    return (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;
  }

  it('creates draft from template and autosaves with optimistic versioning', async () => {
    const owner = await login('owner@aurora.test');
    const propertyId = await firstPropertyId(owner.cookie, owner.body.activeOrganizationId);

    const get1 = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: owner.cookie },
    });
    expect(get1.statusCode).toBe(200);
    const draft1 = get1.json() as {
      version: number;
      config: ReturnType<typeof createDefaultPortalConfig>;
    };
    expect(draft1.version).toBeGreaterThanOrEqual(1);
    expect(draft1.config.schemaVersion).toBe(1);
    expect(draft1.config.sections.length).toBeGreaterThan(0);

    const next = {
      ...draft1.config,
      greeting: { vi: 'Xin chào autosave', en: 'Hello autosave' },
    };
    const put1 = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: owner.cookie },
      payload: { version: draft1.version, config: next },
    });
    expect(put1.statusCode).toBe(200);
    expect(put1.json().version).toBe(draft1.version + 1);
    expect(put1.json().config.greeting.en).toBe('Hello autosave');

    const conflict = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: owner.cookie },
      payload: { version: draft1.version, config: next },
    });
    expect(conflict.statusCode).toBe(409);

    const invalidHtml = {
      ...next,
      greeting: { vi: 'ok', en: '<script>x</script>' },
    };
    const bad = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: owner.cookie },
      payload: { version: put1.json().version, config: invalidHtml },
    });
    expect(bad.statusCode).toBe(400);

    const validate = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/portal/validate`,
      headers: { cookie: owner.cookie },
      payload: { config: next },
    });
    expect(validate.statusCode).toBe(200);
    expect(validate.json().valid).toBe(true);
  });

  it('enforces tenant isolation and portal.update permission', async () => {
    const owner = await login('owner@aurora.test');
    const propertyId = await firstPropertyId(owner.cookie, owner.body.activeOrganizationId);

    const viewer = await login('viewer@aurora.test');
    const forbidden = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: viewer.cookie },
      payload: {
        version: 1,
        config: createDefaultPortalConfig(),
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const nomad = await login('owner@nomad.test');
    const cross = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: nomad.cookie },
    });
    expect(cross.statusCode).toBe(403);

    const templates = await app.inject({
      method: 'GET',
      url: '/v1/portal/templates',
      headers: { cookie: owner.cookie },
    });
    expect(templates.statusCode).toBe(200);
    expect(templates.json().templates.length).toBeGreaterThan(0);
  });

  it('previews draft by locale/device and blocks cross-property locations', async () => {
    const owner = await login('owner@aurora.test');
    const propertyId = await firstPropertyId(owner.cookie, owner.body.activeOrganizationId);
    const locs = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/locations`,
      headers: { cookie: owner.cookie },
    });
    expect(locs.statusCode).toBe(200);
    const locationId = (locs.json() as { locations: Array<{ id: string }> }).locations[0]!.id;

    const preview = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/preview?locale=vi&device=phone&locationId=${locationId}`,
      headers: { cookie: owner.cookie },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().source).toBe('draft');
    expect(preview.json().locale).toBe('vi');
    expect(preview.json().location.id).toBe(locationId);

    const foreignLocation = crypto.randomUUID();
    const denied = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/preview?locationId=${foreignLocation}`,
      headers: { cookie: owner.cookie },
    });
    expect(denied.statusCode).toBe(403);

    const nav = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/portal/navigation`,
      headers: { cookie: owner.cookie },
      payload: {
        version: preview.json().version,
        primaryNavigation: preview.json().config.primaryNavigation,
        secondaryNavigation: preview.json().config.secondaryNavigation,
      },
    });
    expect(nav.statusCode).toBe(200);
  });
});
