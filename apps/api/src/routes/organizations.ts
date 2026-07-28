import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  adminTeamMemberUpdateSchema,
  organizationAdminSettingsUpdateSchema,
  type AdminTeamMember,
} from '@guestportal/contracts';
import {
  auditLogs,
  organizationMemberships,
  organizations,
  properties,
  propertyAssignments,
  sessions,
  users,
} from '@guestportal/db';
import { isOrgWideRole, visiblePropertyIds, type Role } from '@guestportal/auth';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';

const orgParamsSchema = z.object({ organizationId: z.string().uuid() });
const memberParamsSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

async function listTeamMembers(app: FastifyInstance, organizationId: string) {
  const membershipRows = await app.db
    .select({
      membership: organizationMemberships,
      user: users,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(eq(organizationMemberships.organizationId, organizationId));

  const userIds = membershipRows.map((row) => row.user.id);
  const assignmentRows =
    userIds.length > 0
      ? await app.db
          .select()
          .from(propertyAssignments)
          .where(
            and(
              eq(propertyAssignments.organizationId, organizationId),
              inArray(propertyAssignments.userId, userIds),
            ),
          )
      : [];
  const sessionRows =
    userIds.length > 0
      ? await app.db.select().from(sessions).where(inArray(sessions.userId, userIds))
      : [];

  return membershipRows.map(({ membership, user }) => {
    const memberSessions = sessionRows
      .filter((session) => session.userId === user.id)
      .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      role: membership.role as Role,
      status: membership.status as AdminTeamMember['status'],
      propertyIds: assignmentRows
        .filter((assignment) => assignment.userId === user.id)
        .map((assignment) => assignment.propertyId),
      lastActiveAt: memberSessions[0]?.lastSeenAt.toISOString() ?? null,
      createdAt: membership.createdAt.toISOString(),
    };
  });
}

async function assertNotLastActiveOwner(
  app: FastifyInstance,
  organizationId: string,
  userId: string,
  next: { role?: Role; status?: 'active' | 'revoked' },
) {
  const currentRows = await app.db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .limit(1);
  const current = currentRows[0];
  if (!current) {
    throw new ApiError(404, 'TEAM_MEMBER_NOT_FOUND', 'Team member not found.');
  }
  if (current.role !== 'organization_owner' || current.status !== 'active') return current;
  const roleAfter = next.role ?? current.role;
  const statusAfter = next.status ?? current.status;
  if (roleAfter === 'organization_owner' && statusAfter === 'active') return current;

  const owners = await app.db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.role, 'organization_owner'),
        eq(organizationMemberships.status, 'active'),
      ),
    );
  if (owners.length <= 1) {
    throw new ApiError(
      400,
      'LAST_OWNER_REQUIRED',
      'The last active organization owner cannot be changed or revoked.',
    );
  }
  return current;
}

export async function registerOrganizationRoutes(app: FastifyInstance) {
  app.get('/v1/organizations', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    if (request.auth.isPlatformAdmin) {
      const rows = await app.db.select().from(organizations);
      return { organizations: rows };
    }

    const ids = request.auth.memberships.map((m) => m.organizationId);
    const rows = await app.db.select().from(organizations);
    return {
      organizations: rows.filter((row) => ids.includes(row.id)),
    };
  });

  app.get('/v1/organizations/:organizationId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const authz = toAuthzContext(request.auth, params.organizationId);
    assertCan(authz, 'organization.read');

    const rows = await app.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.organizationId))
      .limit(1);
    const org = rows[0];
    if (!org) {
      throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
    }
    return { organization: org };
  });

  app.patch('/v1/organizations/:organizationId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = orgParamsSchema.parse(request.params);
    const body = organizationAdminSettingsUpdateSchema.parse(request.body);

    const authz = toAuthzContext(request.auth, params.organizationId);
    assertCan(authz, 'organization.update');

    const [updated] = await app.db
      .update(organizations)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.defaultLocale ? { defaultLocale: body.defaultLocale } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, params.organizationId))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: params.organizationId,
      actorUserId: request.auth.userId,
      action: 'organization.update',
      resourceType: 'organization',
      resourceId: params.organizationId,
      metadata: body,
    });

    return { organization: updated };
  });

  app.get('/v1/organizations/:organizationId/team/members', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = orgParamsSchema.parse(request.params);
    const authz = toAuthzContext(request.auth, params.organizationId);
    assertCan(authz, 'team.read');

    const scope = visiblePropertyIds(authz);
    const members = await listTeamMembers(app, params.organizationId);
    return {
      members:
        scope === 'all'
          ? members
          : members.filter((member) =>
              member.propertyIds.some((propertyId) => scope.includes(propertyId)),
            ),
    };
  });

  app.patch('/v1/organizations/:organizationId/team/members/:userId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = memberParamsSchema.parse(request.params);
    const body = adminTeamMemberUpdateSchema.parse(request.body);
    const authz = toAuthzContext(request.auth, params.organizationId);
    assertCan(authz, 'team.manage');

    const nextRole = body.role as Role | undefined;
    const ownerCheckInput: { role?: Role; status?: 'active' | 'revoked' } = {};
    if (nextRole !== undefined) ownerCheckInput.role = nextRole;
    if (body.status !== undefined) ownerCheckInput.status = body.status;
    const current = await assertNotLastActiveOwner(
      app,
      params.organizationId,
      params.userId,
      ownerCheckInput,
    );

    if (body.propertyIds) {
      const propertyRows =
        body.propertyIds.length > 0
          ? await app.db
              .select()
              .from(properties)
              .where(
                and(
                  eq(properties.organizationId, params.organizationId),
                  inArray(properties.id, body.propertyIds),
                ),
              )
          : [];
      if (propertyRows.length !== body.propertyIds.length) {
        throw new ApiError(
          400,
          'PROPERTY_ASSIGNMENT_INVALID',
          'Every assigned property must belong to this organization.',
        );
      }
    }

    const roleAfter = nextRole ?? (current.role as Role);
    const propertiesAfter = body.propertyIds;
    if (!isOrgWideRole(roleAfter) && propertiesAfter && propertiesAfter.length === 0) {
      throw new ApiError(
        400,
        'PROPERTY_ASSIGNMENT_REQUIRED',
        'Property-scoped roles require at least one property assignment.',
      );
    }

    await app.db
      .update(organizationMemberships)
      .set({
        ...(body.role ? { role: body.role } : {}),
        ...(body.status ? { status: body.status } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationMemberships.organizationId, params.organizationId),
          eq(organizationMemberships.userId, params.userId),
        ),
      );

    if (body.propertyIds) {
      await app.db
        .delete(propertyAssignments)
        .where(
          and(
            eq(propertyAssignments.organizationId, params.organizationId),
            eq(propertyAssignments.userId, params.userId),
          ),
        );
      if (body.propertyIds.length > 0) {
        await app.db.insert(propertyAssignments).values(
          body.propertyIds.map((propertyId: string) => ({
            organizationId: params.organizationId,
            propertyId,
            userId: params.userId,
          })),
        );
      }
    }

    await app.db.insert(auditLogs).values({
      organizationId: params.organizationId,
      actorUserId: request.auth.userId,
      action: body.status === 'revoked' ? 'team.member.revoke' : 'team.member.update',
      resourceType: 'team_member',
      resourceId: params.userId,
      metadata: {
        role: body.role,
        status: body.status,
        propertyIds: body.propertyIds,
      },
    });

    const updated = (await listTeamMembers(app, params.organizationId)).find(
      (member) => member.userId === params.userId,
    );
    return { member: updated };
  });

  app.get('/v1/organizations/:organizationId/security-settings', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = orgParamsSchema.parse(request.params);
    const authz = toAuthzContext(request.auth, params.organizationId);
    assertCan(authz, 'security.manage');

    return {
      settings: {
        sessionCookie: 'httpOnly:lax',
        tenantIsolation: 'postgres-rls',
        passwordPolicy: 'seeded-test-users:12-round-bcrypt',
        lastOwnerProtection: true,
      },
    };
  });
}
