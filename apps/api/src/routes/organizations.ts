import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { organizations, auditLogs } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';

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
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        defaultLocale: z.enum(['vi', 'en']).optional(),
      })
      .parse(request.body);

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
}
