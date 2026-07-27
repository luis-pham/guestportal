import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  knowledgeSearchRequestSchema,
  knowledgeSourceCreateSchema,
  knowledgeSourceUpdateSchema,
  type KnowledgeSourceSummary,
} from '@guestportal/contracts';
import { assets, auditLogs, knowledgeSources, properties } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { hybridSearchKnowledge } from '../knowledge-search.js';
import { processKnowledgeSource } from '../knowledge-process.js';

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

async function loadReadyAsset(
  app: FastifyInstance,
  property: { id: string; organizationId: string },
  assetId: string,
) {
  const rows = await app.db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.organizationId, property.organizationId),
        eq(assets.propertyId, property.id),
        eq(assets.purpose, 'knowledge_source'),
        eq(assets.status, 'ready'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function toSummary(
  row: typeof knowledgeSources.$inferSelect,
  asset?: typeof assets.$inferSelect | null,
): KnowledgeSourceSummary {
  return {
    id: row.id,
    propertyId: row.propertyId,
    type: row.type as KnowledgeSourceSummary['type'],
    title: row.title,
    sourceLanguage: row.sourceLanguage,
    assetId: row.assetId,
    version: row.version,
    status: row.status as KnowledgeSourceSummary['status'],
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    originalFilename: asset?.originalFilename ?? null,
    mimeType: asset?.mimeType ?? null,
    sizeBytes: asset?.sizeBytes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function registerKnowledgeRoutes(app: FastifyInstance) {
  app.get('/v1/properties/:propertyId/knowledge-sources', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'knowledge.read', property.id);

    const rows = await app.db
      .select({ source: knowledgeSources, asset: assets })
      .from(knowledgeSources)
      .leftJoin(assets, eq(assets.id, knowledgeSources.assetId))
      .where(
        and(
          eq(knowledgeSources.propertyId, property.id),
          eq(knowledgeSources.organizationId, property.organizationId),
        ),
      )
      .orderBy(desc(knowledgeSources.createdAt));

    return {
      sources: rows.map((row) => toSummary(row.source, row.asset)),
    };
  });

  app.post('/v1/properties/:propertyId/knowledge-sources', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = knowledgeSourceCreateSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'knowledge.create', property.id);

    let asset: typeof assets.$inferSelect | null = null;
    let status: KnowledgeSourceSummary['status'] = 'draft';
    let r2ObjectKey: string | null = null;
    let checksumSha256: string | null = null;

    if (body.assetId) {
      asset = await loadReadyAsset(app, property, body.assetId);
      if (!asset) {
        throw new ApiError(
          400,
          'ASSET_INVALID',
          'Knowledge asset must be a ready knowledge_source upload for this property.',
        );
      }
      status = 'uploaded';
      r2ObjectKey = asset.objectKey;
      checksumSha256 = asset.checksumSha256;
    } else if (body.type === 'file') {
      status = 'pending_upload';
    }

    const [row] = await app.db
      .insert(knowledgeSources)
      .values({
        organizationId: property.organizationId,
        propertyId: property.id,
        type: body.type,
        title: body.title,
        sourceLanguage: body.sourceLanguage ?? null,
        assetId: asset?.id ?? null,
        r2ObjectKey,
        checksumSha256,
        status,
        createdBy: request.auth.userId,
      })
      .returning();
    if (!row) {
      throw new ApiError(500, 'KNOWLEDGE_CREATE_FAILED', 'Could not create knowledge source.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'knowledge.create',
      resourceType: 'knowledge_source',
      resourceId: row.id,
      metadata: { propertyId: property.id, status },
    });

    return { source: toSummary(row, asset) };
  });

  app.get('/v1/properties/:propertyId/knowledge-sources/:sourceId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), sourceId: z.string().uuid() })
      .parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'knowledge.read', property.id);

    const rows = await app.db
      .select({ source: knowledgeSources, asset: assets })
      .from(knowledgeSources)
      .leftJoin(assets, eq(assets.id, knowledgeSources.assetId))
      .where(
        and(
          eq(knowledgeSources.id, params.sourceId),
          eq(knowledgeSources.propertyId, property.id),
          eq(knowledgeSources.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      throw new ApiError(404, 'KNOWLEDGE_NOT_FOUND', 'Knowledge source not found.');
    }
    return { source: toSummary(rows[0].source, rows[0].asset) };
  });

  app.patch('/v1/properties/:propertyId/knowledge-sources/:sourceId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), sourceId: z.string().uuid() })
      .parse(request.params);
    const body = knowledgeSourceUpdateSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'knowledge.create', property.id);

    const existing = await app.db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, params.sourceId),
          eq(knowledgeSources.propertyId, property.id),
          eq(knowledgeSources.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      throw new ApiError(404, 'KNOWLEDGE_NOT_FOUND', 'Knowledge source not found.');
    }

    let asset: typeof assets.$inferSelect | null = null;
    let nextStatus = existing[0].status;
    let r2ObjectKey = existing[0].r2ObjectKey;
    let checksumSha256 = existing[0].checksumSha256;
    let assetId = existing[0].assetId;

    if (body.assetId) {
      asset = await loadReadyAsset(app, property, body.assetId);
      if (!asset) {
        throw new ApiError(
          400,
          'ASSET_INVALID',
          'Knowledge asset must be a ready knowledge_source upload for this property.',
        );
      }
      assetId = asset.id;
      r2ObjectKey = asset.objectKey;
      checksumSha256 = asset.checksumSha256;
      nextStatus = 'uploaded';
    }

    if (body.status === 'failed') {
      nextStatus = 'failed';
    }
    if (body.status === 'draft') {
      nextStatus = 'draft';
    }

    const [row] = await app.db
      .update(knowledgeSources)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.sourceLanguage !== undefined ? { sourceLanguage: body.sourceLanguage } : {}),
        assetId,
        r2ObjectKey,
        checksumSha256,
        status: nextStatus,
        errorCode: body.errorCode !== undefined ? body.errorCode : existing[0].errorCode,
        errorMessage:
          body.errorMessage !== undefined ? body.errorMessage : existing[0].errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, params.sourceId))
      .returning();
    if (!row) {
      throw new ApiError(500, 'KNOWLEDGE_UPDATE_FAILED', 'Could not update knowledge source.');
    }

    if (!asset && row.assetId) {
      const assetRows = await app.db.select().from(assets).where(eq(assets.id, row.assetId)).limit(1);
      asset = assetRows[0] ?? null;
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'knowledge.update',
      resourceType: 'knowledge_source',
      resourceId: row.id,
      metadata: { status: row.status },
    });

    return { source: toSummary(row, asset) };
  });

  app.post('/v1/properties/:propertyId/knowledge-sources/:sourceId/process', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), sourceId: z.string().uuid() })
      .parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'knowledge.create', property.id);

    const result = await processKnowledgeSource(app, {
      organizationId: property.organizationId,
      propertyId: property.id,
      sourceId: params.sourceId,
    });

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'knowledge.process',
      resourceType: 'knowledge_source',
      resourceId: params.sourceId,
      metadata: { chunkCount: result.chunkCount, version: result.version },
    });

    return {
      source: toSummary(result.source!),
      chunkCount: result.chunkCount,
      version: result.version,
      language: result.language,
    };
  });

  app.post('/v1/properties/:propertyId/knowledge/search', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = knowledgeSearchRequestSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'knowledge.read', property.id);

    const result = await hybridSearchKnowledge({
      sql: app.sql,
      organizationId: property.organizationId,
      propertyId: property.id,
      query: body.query,
      limit: body.limit,
    });

    return {
      query: result.query,
      sanitizedQuery: result.sanitizedQuery,
      blocked: result.blocked,
      hits: result.hits.map((hit) => ({
        chunkId: hit.chunkId,
        sourceId: hit.sourceId,
        content: hit.content,
        headingPath: hit.headingPath,
        sourceLanguage: hit.sourceLanguage,
        score: hit.score,
        channels: hit.channels,
      })),
      citations: result.citations,
      noResult: result.noResult,
    };
  });
}
