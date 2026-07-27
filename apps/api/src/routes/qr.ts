import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  qrCreateRequestSchema,
  qrDownloadFormatSchema,
  qrResolveRequestSchema,
  qrUpdateRequestSchema,
  type QrCodeSummary,
} from '@guestportal/contracts';
import { auditLogs, locations, properties, qrCodes } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { ensureDefaultLocations, loadPropertyLocation } from '../services/locations.js';
import { renderQrPng, renderQrSvg } from '../services/qr-render.js';
import {
  assertOpaqueQrToken,
  createOpaqueQrToken,
  guestPathForToken,
  guestUrlForToken,
  hashQrToken,
} from '../services/qr-tokens.js';
import { consumeRateLimit } from '../services/rate-limit.js';

const QR_RESOLVE_LIMIT = 30;
const QR_RESOLVE_WINDOW_MS = 60_000;

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

function toSummary(row: typeof qrCodes.$inferSelect): QrCodeSummary {
  return {
    id: row.id,
    propertyId: row.propertyId,
    locationId: row.locationId,
    destinationType: row.destinationType as QrCodeSummary['destinationType'],
    destinationId: row.destinationId,
    enabled: row.enabled,
    scanCount: row.scanCount,
    lastScannedAt: row.lastScannedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mintToken() {
  const token = createOpaqueQrToken();
  assertOpaqueQrToken(token);
  return { token, tokenHash: hashQrToken(token) };
}

export async function registerQrRoutes(app: FastifyInstance) {
  app.get('/v1/properties/:propertyId/qr-codes', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.read', property.id);
    await ensureDefaultLocations(app, property);

    const rows = await app.db
      .select()
      .from(qrCodes)
      .where(
        and(
          eq(qrCodes.propertyId, property.id),
          eq(qrCodes.organizationId, property.organizationId),
        ),
      )
      .orderBy(desc(qrCodes.createdAt));

    return { qrCodes: rows.map(toSummary) };
  });

  app.post('/v1/properties/:propertyId/qr-codes', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z.object({ propertyId: z.string().uuid() }).parse(request.params);
    const body = qrCreateRequestSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.update', property.id);
    await ensureDefaultLocations(app, property);

    const location = await loadPropertyLocation(app, property, body.locationId);
    if (!location) {
      throw new ApiError(400, 'LOCATION_INVALID', 'Location is not valid for this property.');
    }

    const { token, tokenHash } = mintToken();
    const [row] = await app.db
      .insert(qrCodes)
      .values({
        organizationId: property.organizationId,
        propertyId: property.id,
        locationId: location.id,
        publicToken: token,
        publicTokenHash: tokenHash,
        destinationType: body.destinationType,
        destinationId: body.destinationId ?? null,
        enabled: true,
      })
      .returning();
    if (!row) {
      throw new ApiError(500, 'QR_CREATE_FAILED', 'Could not create QR code.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'qr.create',
      resourceType: 'qr_code',
      resourceId: row.id,
      metadata: {
        propertyId: property.id,
        locationId: location.id,
        destinationType: body.destinationType,
      },
    });

    return {
      token,
      guestPath: guestPathForToken(token),
      qrCode: toSummary(row),
    };
  });

  app.patch('/v1/properties/:propertyId/qr-codes/:qrCodeId', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), qrCodeId: z.string().uuid() })
      .parse(request.params);
    const body = qrUpdateRequestSchema.parse(request.body);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.update', property.id);

    const existing = await app.db
      .select()
      .from(qrCodes)
      .where(
        and(
          eq(qrCodes.id, params.qrCodeId),
          eq(qrCodes.propertyId, property.id),
          eq(qrCodes.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      throw new ApiError(404, 'QR_NOT_FOUND', 'QR code not found.');
    }

    if (body.locationId) {
      const location = await loadPropertyLocation(app, property, body.locationId);
      if (!location) {
        throw new ApiError(400, 'LOCATION_INVALID', 'Location is not valid for this property.');
      }
    }

    const [row] = await app.db
      .update(qrCodes)
      .set({
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.locationId !== undefined ? { locationId: body.locationId } : {}),
        ...(body.destinationType !== undefined ? { destinationType: body.destinationType } : {}),
        ...(body.destinationId !== undefined ? { destinationId: body.destinationId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(qrCodes.id, params.qrCodeId))
      .returning();
    if (!row) {
      throw new ApiError(500, 'QR_UPDATE_FAILED', 'Could not update QR code.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: body.enabled === false ? 'qr.disable' : 'qr.update',
      resourceType: 'qr_code',
      resourceId: row.id,
      metadata: body,
    });

    return { qrCode: toSummary(row) };
  });

  app.post('/v1/properties/:propertyId/qr-codes/:qrCodeId/regenerate', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), qrCodeId: z.string().uuid() })
      .parse(request.params);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.update', property.id);

    const existing = await app.db
      .select()
      .from(qrCodes)
      .where(
        and(
          eq(qrCodes.id, params.qrCodeId),
          eq(qrCodes.propertyId, property.id),
          eq(qrCodes.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      throw new ApiError(404, 'QR_NOT_FOUND', 'QR code not found.');
    }

    const { token, tokenHash } = mintToken();
    const [row] = await app.db
      .update(qrCodes)
      .set({
        publicToken: token,
        publicTokenHash: tokenHash,
        updatedAt: new Date(),
      })
      .where(eq(qrCodes.id, params.qrCodeId))
      .returning();
    if (!row) {
      throw new ApiError(500, 'QR_REGENERATE_FAILED', 'Could not regenerate QR token.');
    }

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'qr.regenerate',
      resourceType: 'qr_code',
      resourceId: row.id,
      metadata: { propertyId: property.id },
    });

    return {
      token,
      guestPath: guestPathForToken(token),
      qrCode: toSummary(row),
    };
  });

  app.get('/v1/properties/:propertyId/qr-codes/:qrCodeId/download', async (request, reply) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const params = z
      .object({ propertyId: z.string().uuid(), qrCodeId: z.string().uuid() })
      .parse(request.params);
    const query = z.object({ format: qrDownloadFormatSchema.default('svg') }).parse(request.query);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'property.read', property.id);

    const existing = await app.db
      .select()
      .from(qrCodes)
      .where(
        and(
          eq(qrCodes.id, params.qrCodeId),
          eq(qrCodes.propertyId, property.id),
          eq(qrCodes.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    if (!existing[0]) {
      throw new ApiError(404, 'QR_NOT_FOUND', 'QR code not found.');
    }

    const content = guestUrlForToken(existing[0].publicToken);
    if (query.format === 'png') {
      const png = await renderQrPng(content);
      return reply
        .header('Content-Type', 'image/png')
        .header(
          'Content-Disposition',
          `attachment; filename="qr-${existing[0].id.slice(0, 8)}.png"`,
        )
        .send(png);
    }

    const svg = await renderQrSvg(content);
    return reply
      .header('Content-Type', 'image/svg+xml; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="qr-${existing[0].id.slice(0, 8)}.svg"`,
      )
      .send(svg);
  });

  app.post('/v1/guest/resolve-qr', async (request, reply) => {
    const body = qrResolveRequestSchema.parse(request.body);
    const clientIp = request.ip || 'unknown';
    const limit = consumeRateLimit(`qr-resolve:${clientIp}`, QR_RESOLVE_LIMIT, QR_RESOLVE_WINDOW_MS);
    if (!limit.allowed) {
      reply.header('Retry-After', String(limit.retryAfterSeconds));
      throw new ApiError(429, 'RATE_LIMITED', 'Too many QR resolution attempts.');
    }

    const tokenHash = hashQrToken(body.token);
    // Bootstrap lookup without tenant context (token is the tenancy key).
    const rows = await app.db
      .select({
        qr: qrCodes,
        property: properties,
        location: locations,
      })
      .from(qrCodes)
      .innerJoin(properties, eq(properties.id, qrCodes.propertyId))
      .innerJoin(locations, eq(locations.id, qrCodes.locationId))
      .where(eq(qrCodes.publicTokenHash, tokenHash))
      .limit(1);

    const row = rows[0];
    // Same safe failure for unknown/disabled/suspended to avoid token probing.
    if (!row || !row.qr.enabled || row.property.status !== 'active' || row.location.status !== 'active') {
      throw new ApiError(404, 'QR_INVALID', 'QR code is not available.');
    }

    await app.db
      .update(qrCodes)
      .set({
        scanCount: sql`${qrCodes.scanCount} + 1`,
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(qrCodes.id, row.qr.id));

    return {
      valid: true as const,
      guestPath: guestPathForToken(body.token),
      property: {
        name: row.property.name,
        slug: row.property.slug,
        timezone: row.property.timezone,
        defaultLocale: row.property.defaultLocale,
        supportedLocales: row.property.supportedLocales,
      },
      location: {
        code: row.location.code,
        name: row.location.name,
      },
      destination: {
        type: row.qr.destinationType,
      },
    };
  });
}
