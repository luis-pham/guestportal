import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { defaultPropertyBranding } from '@guestportal/contracts';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('property settings and branding', () => {
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

  it('allows owner to update property settings and branding', async () => {
    const owner = await login('owner@aurora.test');
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
    });
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/properties/${propertyId}`,
      headers: { cookie: owner.cookie },
      payload: { timezone: 'Asia/Bangkok', currency: 'USD' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().property.timezone).toBe('Asia/Bangkok');

    const brandingPayload = {
      ...defaultPropertyBranding(),
      displayName: 'Aurora Guest Stay',
      primaryColor: '#0B3D91',
    };
    const put = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/branding`,
      headers: { cookie: owner.cookie },
      payload: brandingPayload,
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().branding.displayName).toBe('Aurora Guest Stay');

    const get = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/branding`,
      headers: { cookie: owner.cookie },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().branding.primaryColor).toBe('#0B3D91');
  });

  it('rejects invalid branding and unauthorized content manager mutation', async () => {
    const owner = await login('owner@aurora.test');
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
    });
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;

    const invalid = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propertyId}/branding`,
      headers: { cookie: owner.cookie },
      payload: { ...defaultPropertyBranding(), primaryColor: 'blue' },
    });
    expect(invalid.statusCode).toBe(400);

    const content = await login('content@aurora.test');
    const contentPropertyId = content.body.memberships[0]?.propertyIds[0] ?? propertyId;
    const deniedSettings = await app.inject({
      method: 'PATCH',
      url: `/v1/properties/${contentPropertyId}`,
      headers: { cookie: content.cookie },
      payload: { name: 'Nope' },
    });
    expect(deniedSettings.statusCode).toBe(403);
  });

  it('isolates branding reads across organizations', async () => {
    const aurora = await login('owner@aurora.test');
    const nomad = await login('owner@nomad.test');
    const auroraList = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${aurora.body.activeOrganizationId}`,
      headers: { cookie: aurora.cookie },
    });
    const auroraPropertyId = (auroraList.json() as { properties: Array<{ id: string }> }).properties[0]!
      .id;

    const cross = await app.inject({
      method: 'GET',
      url: `/v1/properties/${auroraPropertyId}/branding`,
      headers: { cookie: nomad.cookie },
    });
    expect(cross.statusCode).toBe(403);
  });
});
