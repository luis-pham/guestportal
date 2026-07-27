import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  defaultPropertyBranding,
  propertyBrandingUpdateSchema,
} from '@guestportal/contracts';
import { auditLogs, properties, propertyBranding } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';

async function loadProperty(app: FastifyInstance, propertyId: string) {
  const rows = await app.db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  const property = rows[0];
  if (!property) {
    throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
  }
  return property;
}

export async function registerBrandingRoutes(app: FastifyInstance) {
  app.get('/v1/properties/:propertyId/branding', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.read', property.id);

    const rows = await app.db
      .select()
      .from(propertyBranding)
      .where(
        and(
          eq(propertyBranding.propertyId, property.id),
          eq(propertyBranding.organizationId, property.organizationId),
        ),
      )
      .limit(1);

    const branding = rows[0]?.config ?? {
      ...defaultPropertyBranding(),
      displayName: property.name,
    };

    return { branding };
  });

  app.put('/v1/properties/:propertyId/branding', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = propertyBrandingUpdateSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.update', property.id);

    const existing = await app.db
      .select()
      .from(propertyBranding)
      .where(eq(propertyBranding.propertyId, property.id))
      .limit(1);

    let saved;
    if (existing[0]) {
      const [updated] = await app.db
        .update(propertyBranding)
        .set({
          config: body,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(propertyBranding.propertyId, property.id),
            eq(propertyBranding.organizationId, property.organizationId),
          ),
        )
        .returning();
      saved = updated;
    } else {
      const [created] = await app.db
        .insert(propertyBranding)
        .values({
          organizationId: property.organizationId,
          propertyId: property.id,
          config: body,
        })
        .returning();
      saved = created;
    }

    if (!saved) {
      throw new ApiError(500, 'BRANDING_SAVE_FAILED', 'Could not save branding.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'property.branding.update',
      resourceType: 'property_branding',
      resourceId: property.id,
      metadata: { displayName: body.displayName },
    });

    return { branding: saved.config };
  });
}
