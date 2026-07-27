import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { guestSessionCreateRequestSchema } from '@guestportal/contracts';
import { locations, properties, qrCodes } from '@guestportal/db';
import { ApiError } from '../errors.js';
import {
  GUEST_SESSION_COOKIE,
  createGuestSessionRow,
  resolveGuestSession,
} from '../services/guest-sessions.js';
import { guestPathForToken, hashQrToken } from '../services/qr-tokens.js';
import { consumeRateLimit } from '../services/rate-limit.js';

const SESSION_CREATE_LIMIT = 20;
const SESSION_CREATE_WINDOW_MS = 60_000;

function pickLocale(
  requested: string | undefined,
  property: { defaultLocale: string; supportedLocales: string[] },
) {
  if (requested && property.supportedLocales.includes(requested)) {
    return requested;
  }
  if (property.supportedLocales.includes(property.defaultLocale)) {
    return property.defaultLocale;
  }
  return property.supportedLocales[0] ?? 'en';
}

export async function registerGuestSessionRoutes(app: FastifyInstance) {
  app.post('/v1/guest/sessions', async (request, reply) => {
    const body = guestSessionCreateRequestSchema.parse(request.body);
    const clientIp = request.ip || 'unknown';
    const limit = consumeRateLimit(
      `guest-session:${clientIp}`,
      SESSION_CREATE_LIMIT,
      SESSION_CREATE_WINDOW_MS,
    );
    if (!limit.allowed) {
      reply.header('Retry-After', String(limit.retryAfterSeconds));
      throw new ApiError(429, 'RATE_LIMITED', 'Too many guest session attempts.');
    }

    const tokenHash = hashQrToken(body.token);
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
    if (
      !row ||
      !row.qr.enabled ||
      row.property.status !== 'active' ||
      row.location.status !== 'active'
    ) {
      throw new ApiError(404, 'QR_INVALID', 'QR code is not available.');
    }

    const locale = pickLocale(body.locale, row.property);
    const { token, session } = await createGuestSessionRow(app.db, {
      organizationId: row.property.organizationId,
      propertyId: row.property.id,
      locationId: row.location.id,
      qrCodeId: row.qr.id,
      locale,
      // Privacy-conscious: no PII — only coarse client hints.
      metadata: {
        createdVia: 'qr',
      },
    });

    await app.db
      .update(qrCodes)
      .set({
        scanCount: sql`${qrCodes.scanCount} + 1`,
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(qrCodes.id, row.qr.id));

    reply.setCookie(GUEST_SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: session.expiresAt,
    });

    return {
      locale: session.locale,
      expiresAt: session.expiresAt.toISOString(),
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

  app.get('/v1/guest/session', async (request) => {
    const cookieToken = request.cookies[GUEST_SESSION_COOKIE];
    if (!cookieToken) {
      throw new ApiError(401, 'GUEST_SESSION_REQUIRED', 'Guest session required.');
    }

    const session = await resolveGuestSession(app.db, cookieToken);
    if (!session) {
      throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
    }

    const propertyRows = await app.db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.id, session.propertyId),
          eq(properties.organizationId, session.organizationId),
        ),
      )
      .limit(1);
    const locationRows = await app.db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, session.locationId),
          eq(locations.propertyId, session.propertyId),
          eq(locations.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    const property = propertyRows[0];
    const location = locationRows[0];
    if (!property || !location || property.status !== 'active' || location.status !== 'active') {
      throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
    }

    let destinationType:
      | 'portal_home'
      | 'guide'
      | 'explore'
      | 'catalog'
      | 'request' = 'portal_home';
    if (session.qrCodeId) {
      const qrRows = await app.db
        .select()
        .from(qrCodes)
        .where(
          and(eq(qrCodes.id, session.qrCodeId), eq(qrCodes.propertyId, session.propertyId)),
        )
        .limit(1);
      if (qrRows[0]) {
        destinationType = qrRows[0].destinationType as typeof destinationType;
      }
    }

    return {
      locale: session.locale,
      expiresAt: session.expiresAt.toISOString(),
      guestPath: '/g',
      property: {
        name: property.name,
        slug: property.slug,
        timezone: property.timezone,
        defaultLocale: property.defaultLocale,
        supportedLocales: property.supportedLocales,
      },
      location: {
        code: location.code,
        name: location.name,
      },
      destination: {
        type: destinationType,
      },
    };
  });
}
