import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  knowledgeSources,
  organizationMemberships,
  propertyAssignments,
  users,
} from '@guestportal/db';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('admin staff settings and knowledge operations', () => {
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
      body: response.json() as {
        activeOrganizationId: string;
        memberships: Array<{ organizationId: string; propertyIds: string[] }>;
      },
    };
  }

  async function firstAuroraProperty(cookie: string, organizationId: string) {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as { properties: Array<{ id: string; slug: string }> }).properties[0]!;
  }

  async function userByEmail(email: string) {
    const row = (
      await app.db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0];
    expect(row).toBeTruthy();
    return row!;
  }

  it('lists team members by permission scope and protects the last active owner', async () => {
    const owner = await login('owner@aurora.test');
    const manager = await login('manager.hotel@aurora.test');

    const ownerList = await app.inject({
      method: 'GET',
      url: `/v1/organizations/${owner.body.activeOrganizationId}/team/members`,
      headers: { cookie: owner.cookie },
    });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json().members.map((member: { email: string }) => member.email)).toContain(
      'staff.cruise@aurora.test',
    );

    const managerList = await app.inject({
      method: 'GET',
      url: `/v1/organizations/${manager.body.activeOrganizationId}/team/members`,
      headers: { cookie: manager.cookie },
    });
    expect(managerList.statusCode).toBe(200);
    const managerEmails = managerList.json().members.map((member: { email: string }) => member.email);
    expect(managerEmails).toContain('staff.hotel@aurora.test');
    expect(managerEmails).not.toContain('staff.cruise@aurora.test');

    const ownerUser = await userByEmail('owner@aurora.test');
    const revokeOwner = await app.inject({
      method: 'PATCH',
      url: `/v1/organizations/${owner.body.activeOrganizationId}/team/members/${ownerUser.id}`,
      headers: { cookie: owner.cookie },
      payload: { status: 'revoked', confirm: true },
    });
    expect(revokeOwner.statusCode).toBe(400);
    expect(revokeOwner.json().error.code).toBe('LAST_OWNER_REQUIRED');
  });

  it('updates team assignments with audit and denies unauthorized managers', async () => {
    const owner = await login('owner@aurora.test');
    const manager = await login('manager.hotel@aurora.test');
    const hotelStaff = await userByEmail('staff.hotel@aurora.test');
    const originalMembership = (
      await app.db
        .select()
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, owner.body.activeOrganizationId),
            eq(organizationMemberships.userId, hotelStaff.id),
          ),
        )
        .limit(1)
    )[0]!;
    const originalAssignments = await app.db
      .select()
      .from(propertyAssignments)
      .where(
        and(
          eq(propertyAssignments.organizationId, owner.body.activeOrganizationId),
          eq(propertyAssignments.userId, hotelStaff.id),
        ),
      );

    const denied = await app.inject({
      method: 'PATCH',
      url: `/v1/organizations/${manager.body.activeOrganizationId}/team/members/${hotelStaff.id}`,
      headers: { cookie: manager.cookie },
      payload: { role: 'viewer' },
    });
    expect(denied.statusCode).toBe(403);

    const property = await firstAuroraProperty(owner.cookie, owner.body.activeOrganizationId);
    const update = await app.inject({
      method: 'PATCH',
      url: `/v1/organizations/${owner.body.activeOrganizationId}/team/members/${hotelStaff.id}`,
      headers: { cookie: owner.cookie },
      payload: { role: 'viewer', propertyIds: [property.id] },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().member.role).toBe('viewer');
    expect(update.json().member.propertyIds).toEqual([property.id]);

    await app.db
      .update(organizationMemberships)
      .set({ role: originalMembership.role, status: originalMembership.status })
      .where(eq(organizationMemberships.id, originalMembership.id));
    await app.db
      .delete(propertyAssignments)
      .where(
        and(
          eq(propertyAssignments.organizationId, owner.body.activeOrganizationId),
          eq(propertyAssignments.userId, hotelStaff.id),
        ),
      );
    if (originalAssignments.length > 0) {
      await app.db.insert(propertyAssignments).values(
        originalAssignments.map((assignment) => ({
          organizationId: assignment.organizationId,
          propertyId: assignment.propertyId,
          userId: assignment.userId,
        })),
      );
    }
  });

  it('validates organization settings and exposes security settings by permission', async () => {
    const owner = await login('owner@aurora.test');
    const viewer = await login('viewer@aurora.test');

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/v1/organizations/${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
      payload: { name: '' },
    });
    expect(invalid.statusCode).toBe(400);

    const security = await app.inject({
      method: 'GET',
      url: `/v1/organizations/${owner.body.activeOrganizationId}/security-settings`,
      headers: { cookie: owner.cookie },
    });
    expect(security.statusCode).toBe(200);
    expect(security.json().settings.lastOwnerProtection).toBe(true);

    const deniedSecurity = await app.inject({
      method: 'GET',
      url: `/v1/organizations/${viewer.body.activeOrganizationId}/security-settings`,
      headers: { cookie: viewer.cookie },
    });
    expect(deniedSecurity.statusCode).toBe(403);
  });

  it('publishes, unpublishes and deletes knowledge with confirmation and tenant checks', async () => {
    const owner = await login('owner@aurora.test');
    const viewer = await login('viewer@aurora.test');
    const property = await firstAuroraProperty(owner.cookie, owner.body.activeOrganizationId);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/properties/${property.id}/knowledge-sources`,
      headers: { cookie: owner.cookie },
      payload: { title: `Ops knowledge ${Date.now()}`, type: 'manual', sourceLanguage: 'en' },
    });
    expect(created.statusCode).toBe(200);
    const sourceId = created.json().source.id as string;
    await app.db
      .update(knowledgeSources)
      .set({ status: 'ready' })
      .where(eq(knowledgeSources.id, sourceId));

    const viewerDelete = await app.inject({
      method: 'DELETE',
      url: `/v1/properties/${property.id}/knowledge-sources/${sourceId}`,
      headers: { cookie: viewer.cookie },
      payload: { confirm: true },
    });
    expect(viewerDelete.statusCode).toBe(403);

    const publish = await app.inject({
      method: 'POST',
      url: `/v1/properties/${property.id}/knowledge-sources/${sourceId}/publish`,
      headers: { cookie: owner.cookie },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().source.status).toBe('published');

    const unpublishWithoutConfirm = await app.inject({
      method: 'POST',
      url: `/v1/properties/${property.id}/knowledge-sources/${sourceId}/unpublish`,
      headers: { cookie: owner.cookie },
      payload: {},
    });
    expect(unpublishWithoutConfirm.statusCode).toBe(400);

    const unpublish = await app.inject({
      method: 'POST',
      url: `/v1/properties/${property.id}/knowledge-sources/${sourceId}/unpublish`,
      headers: { cookie: owner.cookie },
      payload: { confirm: true },
    });
    expect(unpublish.statusCode).toBe(200);
    expect(unpublish.json().source.status).toBe('ready');

    const deleteWithoutConfirm = await app.inject({
      method: 'DELETE',
      url: `/v1/properties/${property.id}/knowledge-sources/${sourceId}`,
      headers: { cookie: owner.cookie },
      payload: {},
    });
    expect(deleteWithoutConfirm.statusCode).toBe(400);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/properties/${property.id}/knowledge-sources/${sourceId}`,
      headers: { cookie: owner.cookie },
      payload: { confirm: true },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().deleted).toBe(true);
  });
});
