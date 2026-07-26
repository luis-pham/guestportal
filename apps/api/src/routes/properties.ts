import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditLogs, properties } from '@guestportal/db';
import { visiblePropertyIds } from '@guestportal/auth';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';

export async function registerPropertyRoutes(app: FastifyInstance) {
  app.get('/v1/properties', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const query = z
      .object({
        organizationId: z.string().uuid(),
      })
      .parse(request.query);

    const authz = toAuthzContext(request.auth, query.organizationId);
    assertCan(authz, 'property.read');

    const rows = await app.db
      .select()
      .from(properties)
      .where(eq(properties.organizationId, query.organizationId));

    const scope = visiblePropertyIds(authz);
    const filtered = scope === 'all' ? rows : rows.filter((row) => scope.includes(row.id));

    return { properties: filtered };
  });

  app.get('/v1/properties/:propertyId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const rows = await app.db
      .select()
      .from(properties)
      .where(eq(properties.id, params.propertyId))
      .limit(1);
    const property = rows[0];
    if (!property) {
      throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
    }

    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.read', property.id);
    return { property };
  });

  app.post('/v1/properties', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const body = z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().min(1),
        slug: z.string().min(1),
        type: z.enum([
          'hotel',
          'resort',
          'cruise',
          'airbnb',
          'serviced_apartment',
          'restaurant',
          'spa',
          'other',
        ]),
        timezone: z.string().min(1),
        currency: z.string().length(3),
        defaultLocale: z.string().min(2),
        supportedLocales: z.array(z.string()).min(1),
      })
      .parse(request.body);

    const authz = toAuthzContext(request.auth, body.organizationId);
    assertCan(authz, 'property.create');

    const [created] = await app.db
      .insert(properties)
      .values({
        organizationId: body.organizationId,
        name: body.name,
        slug: body.slug,
        type: body.type,
        timezone: body.timezone,
        currency: body.currency,
        defaultLocale: body.defaultLocale,
        supportedLocales: body.supportedLocales,
      })
      .returning();

    if (!created) {
      throw new ApiError(500, 'PROPERTY_CREATE_FAILED', 'Could not create property.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: body.organizationId,
      actorUserId: request.auth.userId,
      action: 'property.create',
      resourceType: 'property',
      resourceId: created.id,
      metadata: { slug: created.slug },
    });

    return { property: created };
  });

  app.patch('/v1/properties/:propertyId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        status: z.enum(['active', 'suspended']).optional(),
      })
      .parse(request.body);

    const existing = await app.db
      .select()
      .from(properties)
      .where(eq(properties.id, params.propertyId))
      .limit(1);
    const property = existing[0];
    if (!property) {
      throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
    }

    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.update', property.id);

    const [updated] = await app.db
      .update(properties)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.status ? { status: body.status } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(properties.id, params.propertyId),
          eq(properties.organizationId, property.organizationId),
        ),
      )
      .returning();

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'property.update',
      resourceType: 'property',
      resourceId: params.propertyId,
      metadata: body,
    });

    return { property: updated };
  });
}
