import type { FastifyInstance } from 'fastify';
import {
  adminAnalyticsDashboardResponseSchema,
  adminAnalyticsQuerySchema,
} from '@guestportal/contracts';
import { getAdminAnalyticsDashboard } from '@guestportal/analytics';
import { properties } from '@guestportal/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { ApiError } from '../errors.js';

const paramsSchema = z.object({
  propertyId: z.string().uuid(),
});

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

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get('/v1/admin/properties/:propertyId/analytics', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const params = paramsSchema.parse(request.params);
    const query = adminAnalyticsQuerySchema.parse(request.query);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, 'analytics.read', property.id);

    const dashboard = await getAdminAnalyticsDashboard(app.sql, {
      organizationId: property.organizationId,
      propertyId: property.id,
      propertyTimezone: property.timezone,
      ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
      ...(query.dateTo ? { dateTo: query.dateTo } : {}),
      ...(query.timezone ? { timezone: query.timezone } : {}),
    });

    return adminAnalyticsDashboardResponseSchema.parse({ dashboard });
  });
}
