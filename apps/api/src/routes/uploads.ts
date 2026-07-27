import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  uploadCompleteRequestSchema,
  uploadPresignRequestSchema,
} from '@guestportal/contracts';
import { assets, auditLogs, properties } from '@guestportal/db';
import {
  assertKeyBelongsToTenant,
  buildAssetObjectKey,
  createR2Storage,
  validateUploadConstraints,
} from '@guestportal/storage';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';

let storageSingleton: ReturnType<typeof createR2Storage> | null = null;
let corsReady: Promise<void> | null = null;

function getStorage() {
  try {
    if (!storageSingleton) {
      storageSingleton = createR2Storage();
    }
    return storageSingleton;
  } catch (error) {
    throw new ApiError(
      503,
      'STORAGE_MISCONFIGURED',
      error instanceof Error ? error.message : 'R2 storage is not configured.',
    );
  }
}

async function ensureCors(storage: ReturnType<typeof createR2Storage>) {
  if (!corsReady) {
    corsReady = storage.ensureBrowserCors().catch((error) => {
      // Token may lack PutBucketCors — configure CORS in Cloudflare dashboard for browser PUTs.
      corsReady = Promise.resolve();
      void error;
    });
  }
  await corsReady;
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

export async function registerUploadRoutes(app: FastifyInstance) {
  app.post('/v1/uploads/presign', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const body = uploadPresignRequestSchema.parse(request.body);
    const constraints = validateUploadConstraints({
      purpose: body.purpose,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });
    if (!constraints.ok) {
      throw new ApiError(400, constraints.code, constraints.message);
    }

    const property = await loadProperty(app, body.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    if (body.purpose === 'knowledge_source') {
      assertCan(authz, 'knowledge.create', property.id);
    } else {
      assertCan(authz, 'portal.update', property.id);
    }

    const storage = getStorage();
    await ensureCors(storage);
    const assetId = crypto.randomUUID();
    const objectKey = buildAssetObjectKey({
      organizationId: property.organizationId,
      propertyId: property.id,
      purpose: body.purpose,
      assetId,
      filename: body.filename,
    });

    const [created] = await app.db
      .insert(assets)
      .values({
        id: assetId,
        organizationId: property.organizationId,
        propertyId: property.id,
        bucket: storage.config.bucket,
        objectKey,
        originalFilename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        visibility: body.purpose === 'knowledge_source' ? 'private' : 'public',
        status: 'pending',
        purpose: body.purpose,
        createdBy: request.auth.userId,
      })
      .returning();

    if (!created) {
      throw new ApiError(500, 'ASSET_CREATE_FAILED', 'Could not create asset record.');
    }

    // Do not bind ContentLength into the signature — browsers set it independently
    // and a mismatch causes silent PUT failures. Size is verified on complete via HEAD.
    const signed = await storage.createPresignedPut({
      objectKey,
      contentType: body.mimeType,
    });

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'asset.presign',
      resourceType: 'asset',
      resourceId: created.id,
      metadata: { purpose: body.purpose, propertyId: property.id },
    });

    return {
      assetId: created.id,
      method: signed.method,
      uploadUrl: signed.uploadUrl,
      requiredHeaders: signed.requiredHeaders,
      expiresAt: signed.expiresAt,
      publicUrl: signed.publicUrl,
    };
  });

  app.post('/v1/uploads/complete', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const body = uploadCompleteRequestSchema.parse(request.body);
    const rows = await app.db.select().from(assets).where(eq(assets.id, body.assetId)).limit(1);
    const asset = rows[0];
    if (!asset || asset.status === 'deleted') {
      throw new ApiError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    }

    const authz = toAuthzContext(request.auth, asset.organizationId);
    if (asset.purpose === 'knowledge_source') {
      assertCan(authz, 'knowledge.create', asset.propertyId ?? undefined);
    } else {
      assertCan(authz, 'portal.update', asset.propertyId ?? undefined);
    }

    if (!assertKeyBelongsToTenant(asset.objectKey, asset.organizationId, asset.propertyId ?? undefined)) {
      throw new ApiError(403, 'FORBIDDEN', 'Asset key does not belong to this tenant.');
    }

    const storage = getStorage();
    const head = await storage.headObject(asset.objectKey);
    if (!head) {
      throw new ApiError(400, 'UPLOAD_MISSING', 'Object not found in storage. Upload may have failed.');
    }
    if (head.contentType && head.contentType.split(';')[0]!.trim() !== asset.mimeType) {
      throw new ApiError(
        400,
        'CONTENT_TYPE_MISMATCH',
        `Expected ${asset.mimeType}, got ${head.contentType}.`,
      );
    }
    if (head.contentLength !== undefined && head.contentLength !== asset.sizeBytes) {
      throw new ApiError(
        400,
        'SIZE_MISMATCH',
        `Expected ${asset.sizeBytes} bytes, got ${head.contentLength}.`,
      );
    }

    const [updated] = await app.db
      .update(assets)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(and(eq(assets.id, asset.id), eq(assets.organizationId, asset.organizationId)))
      .returning();

    if (!updated) {
      throw new ApiError(500, 'ASSET_UPDATE_FAILED', 'Could not finalize asset.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: asset.organizationId,
      actorUserId: request.auth.userId,
      action: 'asset.complete',
      resourceType: 'asset',
      resourceId: asset.id,
      metadata: { purpose: asset.purpose },
    });

    return {
      asset: {
        id: updated.id,
        organizationId: updated.organizationId,
        propertyId: updated.propertyId,
        purpose: updated.purpose,
        mimeType: updated.mimeType,
        sizeBytes: updated.sizeBytes,
        status: updated.status,
        publicUrl: storage.publicUrlFor(updated.objectKey),
        originalFilename: updated.originalFilename,
      },
    };
  });

  app.get('/v1/assets/:assetId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ assetId: z.string().uuid() }).parse(request.params);
    const rows = await app.db.select().from(assets).where(eq(assets.id, params.assetId)).limit(1);
    const asset = rows[0];
    if (!asset || asset.status === 'deleted') {
      throw new ApiError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    }

    const authz = toAuthzContext(request.auth, asset.organizationId);
    if (asset.purpose === 'knowledge_source') {
      assertCan(authz, 'knowledge.read', asset.propertyId ?? undefined);
    } else {
      assertCan(authz, 'portal.read', asset.propertyId ?? undefined);
    }

    const storage = getStorage();
    return {
      asset: {
        id: asset.id,
        organizationId: asset.organizationId,
        propertyId: asset.propertyId,
        purpose: asset.purpose,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        status: asset.status,
        publicUrl: storage.publicUrlFor(asset.objectKey),
        originalFilename: asset.originalFilename,
      },
    };
  });

  app.delete('/v1/assets/:assetId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ assetId: z.string().uuid() }).parse(request.params);
    const rows = await app.db.select().from(assets).where(eq(assets.id, params.assetId)).limit(1);
    const asset = rows[0];
    if (!asset || asset.status === 'deleted') {
      throw new ApiError(404, 'ASSET_NOT_FOUND', 'Asset not found.');
    }

    const authz = toAuthzContext(request.auth, asset.organizationId);
    if (asset.purpose === 'knowledge_source') {
      assertCan(authz, 'knowledge.create', asset.propertyId ?? undefined);
    } else {
      assertCan(authz, 'portal.update', asset.propertyId ?? undefined);
    }

    const storage = getStorage();
    await storage.deleteObject(asset.objectKey);
    await app.db
      .update(assets)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(assets.id, asset.id));

    await app.db.insert(auditLogs).values({
      organizationId: asset.organizationId,
      actorUserId: request.auth.userId,
      action: 'asset.delete',
      resourceType: 'asset',
      resourceId: asset.id,
      metadata: {},
    });

    return { ok: true };
  });
}
