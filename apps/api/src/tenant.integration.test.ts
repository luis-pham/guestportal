import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { organizations, withTenantTransaction } from '@guestportal/db';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';

const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('tenant isolation integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      databaseUrl: databaseUrl!,
      cookieSecret,
    });
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
      body: response.json() as {
        memberships: Array<{ organizationId: string; propertyIds: string[] }>;
        activeOrganizationId: string;
      },
    };
  }

  it('prevents aurora owner from listing nomad properties', async () => {
    const aurora = await login('owner@aurora.test');
    const nomad = await login('owner@nomad.test');

    const nomadOrgId = nomad.body.activeOrganizationId;
    const response = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${nomadOrgId}`,
      headers: { cookie: aurora.cookie },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('scopes property manager to assigned properties only', async () => {
    const manager = await login('manager.hotel@aurora.test');
    const orgId = manager.body.activeOrganizationId;
    const response = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${orgId}`,
      headers: { cookie: manager.cookie },
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as { properties: Array<{ slug: string }> };
    const slugs = payload.properties.map((p) => p.slug);
    expect(slugs).toContain('aurora-city-hotel');
    expect(slugs).not.toContain('aurora-bay-cruise');
  });

  it('supports logout and session revocation', async () => {
    const session = await login('admin@aurora.test');
    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { cookie: session.cookie },
    });
    expect(me.statusCode).toBe(200);

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { cookie: session.cookie },
    });
    expect(logout.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { cookie: session.cookie },
    });
    expect(meAfter.statusCode).toBe(401);
  });

  it('enforces RLS organization isolation for properties', async () => {
    const auroraOrg = (
      await app.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, 'aurora-hospitality'))
        .limit(1)
    )[0];
    const nomadOrg = (
      await app.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, 'nomad-homes'))
        .limit(1)
    )[0];
    expect(auroraOrg && nomadOrg).toBeTruthy();

    const rows = await withTenantTransaction(app.sql, auroraOrg!.id, null, async (tx) => {
      return tx<{ id: string; organization_id: string }[]>`
        select id, organization_id from properties
      `;
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.organization_id === auroraOrg!.id)).toBe(true);
    expect(rows.some((row) => row.organization_id === nomadOrg!.id)).toBe(false);
  });

  it('blocks IDOR property fetch across tenants', async () => {
    const aurora = await login('owner@aurora.test');
    const nomad = await login('owner@nomad.test');
    const nomadProps = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${nomad.body.activeOrganizationId}`,
      headers: { cookie: nomad.cookie },
    });
    const propertyId = (nomadProps.json() as { properties: Array<{ id: string }> }).properties[0]
      ?.id;
    expect(propertyId).toBeTruthy();

    const idor = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}`,
      headers: { cookie: aurora.cookie },
    });
    expect(idor.statusCode).toBe(403);
  });
});
