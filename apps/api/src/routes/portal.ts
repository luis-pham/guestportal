import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  portalConfigDocumentSchema,
  portalDraftUpdateSchema,
  portalNavUpdateSchema,
  portalPreviewQuerySchema,
  portalPublishRequestSchema,
  portalRestoreRequestSchema,
  portalValidateRequestSchema,
  templateForPropertyType,
  type PortalConfigDocument,
} from '@guestportal/contracts';
import {
  auditLogs,
  outboxEvents,
  portalDrafts,
  portalTemplates,
  portalVersions,
  properties,
} from '@guestportal/db';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { resolvePreviewLocation } from '../services/preview-locations.js';
import { ensureDefaultLocations } from '../services/locations.js';

function checksumConfig(config: PortalConfigDocument): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

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

async function resolveTemplateConfig(
  app: FastifyInstance,
  propertyType: string,
): Promise<PortalConfigDocument> {
  const rows = await app.db
    .select()
    .from(portalTemplates)
    .where(eq(portalTemplates.propertyType, propertyType))
    .limit(1);
  if (rows[0]) {
    return portalConfigDocumentSchema.parse(rows[0].config);
  }
  return templateForPropertyType(propertyType).config;
}

async function ensureDraft(
  app: FastifyInstance,
  property: { id: string; organizationId: string; type: string },
  userId: string | null,
) {
  const existing = await app.db
    .select()
    .from(portalDrafts)
    .where(
      and(
        eq(portalDrafts.propertyId, property.id),
        eq(portalDrafts.organizationId, property.organizationId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const config = await resolveTemplateConfig(app, property.type);
  const [created] = await app.db
    .insert(portalDrafts)
    .values({
      organizationId: property.organizationId,
      propertyId: property.id,
      version: 1,
      config,
      updatedBy: userId,
    })
    .returning();
  if (!created) {
    throw new ApiError(500, 'DRAFT_CREATE_FAILED', 'Could not create portal draft.');
  }
  return created;
}

export async function registerPortalRoutes(app: FastifyInstance) {
  app.get('/v1/properties/:propertyId/portal/draft', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.read', property.id);

    const draft = await ensureDraft(app, property, request.auth.userId);
    const config = portalConfigDocumentSchema.parse(draft.config);
    return {
      propertyId: property.id,
      version: draft.version,
      updatedAt: draft.updatedAt.toISOString(),
      config,
    };
  });

  app.put('/v1/properties/:propertyId/portal/draft', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = portalDraftUpdateSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.update', property.id);

    const draft = await ensureDraft(app, property, request.auth.userId);
    if (draft.version !== body.version) {
      throw new ApiError(
        409,
        'VERSION_CONFLICT',
        'Draft was updated elsewhere. Reload and retry autosave.',
        { currentVersion: draft.version },
      );
    }

    const [updated] = await app.db
      .update(portalDrafts)
      .set({
        config: body.config,
        version: draft.version + 1,
        updatedBy: request.auth.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalDrafts.id, draft.id),
          eq(portalDrafts.organizationId, property.organizationId),
          eq(portalDrafts.version, body.version),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Draft was updated elsewhere. Reload and retry.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'portal.draft.autosave',
      resourceType: 'portal_draft',
      resourceId: updated.id,
      metadata: { propertyId: property.id, version: updated.version },
    });

    return {
      propertyId: property.id,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
      config: portalConfigDocumentSchema.parse(updated.config),
    };
  });

  app.post('/v1/properties/:propertyId/portal/validate', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.read', property.id);

    const parsed = portalValidateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return {
        valid: false,
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }
    return { valid: true, errors: [] as Array<{ path: string; message: string }> };
  });

  app.get('/v1/portal/templates', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const rows = await app.db.select().from(portalTemplates);
    return {
      templates: rows.map((row) => ({
        id: row.id,
        propertyType: row.propertyType,
        name: row.name,
        config: portalConfigDocumentSchema.parse(row.config),
      })),
    };
  });

  app.get('/v1/properties/:propertyId/locations', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.read', property.id);
    const locationsList = await ensureDefaultLocations(app, property);
    return { locations: locationsList };
  });

  app.get('/v1/properties/:propertyId/portal/preview', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const query = portalPreviewQuerySchema.parse(request.query);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.read', property.id);

    if (query.locationId) {
      const location = resolvePreviewLocation(property.id, query.locationId);
      if (!location) {
        throw new ApiError(
          403,
          'LOCATION_PROPERTY_MISMATCH',
          'Location does not belong to this property.',
        );
      }
    }

    const draft = await ensureDraft(app, property, request.auth.userId);
    const location = resolvePreviewLocation(property.id, query.locationId);
    return {
      propertyId: property.id,
      version: draft.version,
      locale: query.locale,
      device: query.device,
      location,
      config: portalConfigDocumentSchema.parse(draft.config),
      source: 'draft' as const,
    };
  });

  app.put('/v1/properties/:propertyId/portal/navigation', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = portalNavUpdateSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.update', property.id);

    const draft = await ensureDraft(app, property, request.auth.userId);
    if (draft.version !== body.version) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Draft was updated elsewhere.');
    }
    const config = portalConfigDocumentSchema.parse({
      ...portalConfigDocumentSchema.parse(draft.config),
      primaryNavigation: body.primaryNavigation,
      secondaryNavigation: body.secondaryNavigation,
    });

    const [updated] = await app.db
      .update(portalDrafts)
      .set({
        config,
        version: draft.version + 1,
        updatedBy: request.auth.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalDrafts.id, draft.id),
          eq(portalDrafts.version, body.version),
          eq(portalDrafts.organizationId, property.organizationId),
        ),
      )
      .returning();
    if (!updated) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Draft was updated elsewhere.');
    }
    return {
      propertyId: property.id,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
      config: portalConfigDocumentSchema.parse(updated.config),
    };
  });

  app.post('/v1/properties/:propertyId/portal/publish', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = portalPublishRequestSchema.parse(request.body ?? {});
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.publish', property.id);

    const idempotencyKey =
      body.idempotencyKey ?? `publish:${property.id}:${body.expectedDraftVersion}`;
    const existingEvent = await app.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.idempotencyKey, idempotencyKey))
      .limit(1);
    if (existingEvent[0]) {
      const versionId = String(existingEvent[0].payload.versionId ?? '');
      const versionRows = await app.db
        .select()
        .from(portalVersions)
        .where(eq(portalVersions.id, versionId))
        .limit(1);
      if (versionRows[0]) {
        return {
          version: {
            id: versionRows[0].id,
            versionNumber: versionRows[0].versionNumber,
            checksumSha256: versionRows[0].checksumSha256,
            publishedAt: versionRows[0].publishedAt.toISOString(),
            publishedBy: versionRows[0].publishedBy,
            restoredFromVersionId: versionRows[0].restoredFromVersionId,
            note: versionRows[0].note,
          },
          idempotentReplay: true,
        };
      }
    }

    const draft = await ensureDraft(app, property, request.auth.userId);
    if (draft.version !== body.expectedDraftVersion) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Draft version mismatch for publish.', {
        currentVersion: draft.version,
      });
    }

    const config = portalConfigDocumentSchema.parse(draft.config);
    const checksum = checksumConfig(config);
    const maxRows = await app.db
      .select({ max: sql<number>`coalesce(max(${portalVersions.versionNumber}), 0)` })
      .from(portalVersions)
      .where(eq(portalVersions.propertyId, property.id));
    const nextNumber = Number(maxRows[0]?.max ?? 0) + 1;

    const [created] = await app.db
      .insert(portalVersions)
      .values({
        organizationId: property.organizationId,
        propertyId: property.id,
        versionNumber: nextNumber,
        config,
        checksumSha256: checksum,
        publishedBy: request.auth.userId,
        note: body.note ?? null,
      })
      .returning();
    if (!created) {
      throw new ApiError(500, 'PUBLISH_FAILED', 'Could not publish portal version.');
    }

    await app.db.insert(outboxEvents).values({
      organizationId: property.organizationId,
      aggregateType: 'portal',
      aggregateId: property.id,
      eventType: 'portal.published',
      idempotencyKey,
      payload: {
        propertyId: property.id,
        versionId: created.id,
        versionNumber: created.versionNumber,
        checksumSha256: checksum,
      },
    });

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'portal.publish',
      resourceType: 'portal_version',
      resourceId: created.id,
      metadata: { versionNumber: created.versionNumber },
    });

    return {
      version: {
        id: created.id,
        versionNumber: created.versionNumber,
        checksumSha256: created.checksumSha256,
        publishedAt: created.publishedAt.toISOString(),
        publishedBy: created.publishedBy,
        restoredFromVersionId: created.restoredFromVersionId,
        note: created.note,
      },
      idempotentReplay: false,
    };
  });

  app.get('/v1/properties/:propertyId/portal/versions', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.read', property.id);

    const rows = await app.db
      .select()
      .from(portalVersions)
      .where(
        and(
          eq(portalVersions.propertyId, property.id),
          eq(portalVersions.organizationId, property.organizationId),
        ),
      )
      .orderBy(desc(portalVersions.versionNumber));

    return {
      versions: rows.map((row) => ({
        id: row.id,
        versionNumber: row.versionNumber,
        checksumSha256: row.checksumSha256,
        publishedAt: row.publishedAt.toISOString(),
        publishedBy: row.publishedBy,
        restoredFromVersionId: row.restoredFromVersionId,
        note: row.note,
      })),
    };
  });

  app.post('/v1/properties/:propertyId/portal/versions/:versionId/restore', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), versionId: z.string().uuid() })
      .parse(request.params);
    const body = portalRestoreRequestSchema.parse(request.body ?? {});
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'portal.publish', property.id);

    const sourceRows = await app.db
      .select()
      .from(portalVersions)
      .where(
        and(
          eq(portalVersions.id, params.versionId),
          eq(portalVersions.propertyId, property.id),
          eq(portalVersions.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    const source = sourceRows[0];
    if (!source) {
      throw new ApiError(404, 'VERSION_NOT_FOUND', 'Portal version not found.');
    }

    // Immutability: never update source row; copy config into a new published version
    // and reset draft to that snapshot.
    const config = portalConfigDocumentSchema.parse(source.config);
    const maxRows = await app.db
      .select({ max: sql<number>`coalesce(max(${portalVersions.versionNumber}), 0)` })
      .from(portalVersions)
      .where(eq(portalVersions.propertyId, property.id));
    const nextNumber = Number(maxRows[0]?.max ?? 0) + 1;

    const [created] = await app.db
      .insert(portalVersions)
      .values({
        organizationId: property.organizationId,
        propertyId: property.id,
        versionNumber: nextNumber,
        config,
        checksumSha256: checksumConfig(config),
        publishedBy: request.auth.userId,
        restoredFromVersionId: source.id,
        note: body.note ?? `Restored from v${source.versionNumber}`,
      })
      .returning();
    if (!created) {
      throw new ApiError(500, 'RESTORE_FAILED', 'Could not restore portal version.');
    }

    const draft = await ensureDraft(app, property, request.auth.userId);
    await app.db
      .update(portalDrafts)
      .set({
        config,
        version: draft.version + 1,
        updatedBy: request.auth.userId,
        updatedAt: new Date(),
      })
      .where(eq(portalDrafts.id, draft.id));

    const idempotencyKey = body.idempotencyKey ?? `restore:${property.id}:${source.id}:${created.versionNumber}`;
    await app.db.insert(outboxEvents).values({
      organizationId: property.organizationId,
      aggregateType: 'portal',
      aggregateId: property.id,
      eventType: 'portal.published',
      idempotencyKey,
      payload: {
        propertyId: property.id,
        versionId: created.id,
        versionNumber: created.versionNumber,
        restoredFromVersionId: source.id,
      },
    });

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'portal.restore',
      resourceType: 'portal_version',
      resourceId: created.id,
      metadata: { restoredFromVersionId: source.id },
    });

    return {
      version: {
        id: created.id,
        versionNumber: created.versionNumber,
        checksumSha256: created.checksumSha256,
        publishedAt: created.publishedAt.toISOString(),
        publishedBy: created.publishedBy,
        restoredFromVersionId: created.restoredFromVersionId,
        note: created.note,
      },
    };
  });
}
