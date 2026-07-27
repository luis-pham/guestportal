import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import {
  defaultPropertyBranding,
  portalConfigDocumentSchema,
  propertyBrandingSchema,
} from '@guestportal/contracts';
import {
  assets,
  locations,
  portalVersions,
  properties,
  propertyBranding,
  qrCodes,
} from '@guestportal/db';
import { ApiError } from '../errors.js';
import {
  GUEST_SESSION_COOKIE,
  resolveGuestSession,
} from '../services/guest-sessions.js';

function publicUrlForKey(objectKey: string): string | null {
  const base = (process.env.ASSETS_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL || '').replace(
    /\/$/,
    '',
  );
  if (!base) return null;
  return `${base}/${objectKey}`;
}

async function resolveAssetUrl(
  app: FastifyInstance,
  assetId: string | null,
  organizationId: string,
  propertyId: string,
): Promise<string | null> {
  if (!assetId) return null;
  const rows = await app.db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId),
        eq(assets.propertyId, propertyId),
        eq(assets.status, 'ready'),
      ),
    )
    .limit(1);
  const asset = rows[0];
  if (!asset) return null;
  return publicUrlForKey(asset.objectKey);
}

export async function registerGuestPortalRoutes(app: FastifyInstance) {
  app.get('/v1/guest/portal', async (request) => {
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
          eq(properties.status, 'active'),
        ),
      )
      .limit(1);
    const property = propertyRows[0];
    if (!property) {
      throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
    }

    const locationRows = await app.db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, session.locationId),
          eq(locations.propertyId, session.propertyId),
          eq(locations.status, 'active'),
        ),
      )
      .limit(1);
    const location = locationRows[0];
    if (!location) {
      throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
    }

    const published = await app.db
      .select()
      .from(portalVersions)
      .where(
        and(
          eq(portalVersions.propertyId, property.id),
          eq(portalVersions.organizationId, property.organizationId),
        ),
      )
      .orderBy(desc(portalVersions.versionNumber))
      .limit(1);
    const version = published[0];
    if (!version) {
      throw new ApiError(404, 'PORTAL_NOT_PUBLISHED', 'No published portal is available.');
    }

    const brandingRows = await app.db
      .select()
      .from(propertyBranding)
      .where(
        and(
          eq(propertyBranding.propertyId, property.id),
          eq(propertyBranding.organizationId, property.organizationId),
        ),
      )
      .limit(1);
    const branding = propertyBrandingSchema.parse(
      brandingRows[0]?.config ?? {
        ...defaultPropertyBranding(),
        displayName: property.name,
      },
    );

    const logoUrl = await resolveAssetUrl(
      app,
      branding.logoAssetId,
      property.organizationId,
      property.id,
    );
    const coverUrl = await resolveAssetUrl(
      app,
      branding.coverAssetId,
      property.organizationId,
      property.id,
    );

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
        .where(and(eq(qrCodes.id, session.qrCodeId), eq(qrCodes.propertyId, property.id)))
        .limit(1);
      if (qrRows[0]) {
        destinationType = qrRows[0].destinationType as typeof destinationType;
      }
    }

    const config = portalConfigDocumentSchema.parse(version.config);

    return {
      locale: session.locale,
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
      destination: { type: destinationType },
      branding: {
        ...branding,
        logoUrl,
        coverUrl,
      },
      portal: {
        versionNumber: version.versionNumber,
        publishedAt: version.publishedAt.toISOString(),
        config,
      },
      fallbacks: {
        missingLogo: !logoUrl,
        missingCover: !coverUrl,
      },
    };
  });
}
