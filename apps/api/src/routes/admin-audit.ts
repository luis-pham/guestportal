import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  adminAuditLogListResponseSchema,
  adminAuditLogQuerySchema,
  adminOperationExportQuerySchema,
} from '@guestportal/contracts';
import { auditLogs, organizations, properties } from '@guestportal/db';
import { visiblePropertyIds } from '@guestportal/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { ApiError } from '../errors.js';
import { exportOperationRows, listAuditLogs } from '../services/admin-audit.js';

const organizationParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

const operationExportParamsSchema = z.object({
  propertyId: z.string().uuid(),
});

async function loadOrganization(app: FastifyInstance, organizationId: string) {
  const rows = await app.db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const organization = rows[0];
  if (!organization) {
    throw new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }
  return organization;
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

export async function registerAdminAuditRoutes(app: FastifyInstance) {
  app.get('/v1/admin/organizations/:organizationId/audit-logs', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const params = organizationParamsSchema.parse(request.params);
    await loadOrganization(app, params.organizationId);
    const query = adminAuditLogQuerySchema.parse(request.query);
    const authz = toAuthzContext(request.auth, params.organizationId);
    assertCan(authz, 'audit.read', query.propertyId);

    if (query.propertyId) {
      const property = await loadProperty(app, query.propertyId);
      if (property.organizationId !== params.organizationId) {
        throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
      }
    }

    const response = await listAuditLogs(app.sql, {
      ...query,
      organizationId: params.organizationId,
      visiblePropertyIds: visiblePropertyIds(authz),
    });
    return adminAuditLogListResponseSchema.parse(response);
  });

  async function exportOperations(
    request: FastifyRequest,
    reply: FastifyReply,
    collection: 'requests' | 'orders',
  ) {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const params = operationExportParamsSchema.parse(request.params);
    const query = adminOperationExportQuerySchema.parse(request.query);
    const property = await loadProperty(app, params.propertyId);
    const authz = toAuthzContext(request.auth, property.organizationId);
    assertCan(authz, collection === 'requests' ? 'request.read' : 'order.read', property.id);
    assertCan(authz, 'audit.read', property.id);

    const result = await exportOperationRows(app.sql, {
      ...query,
      organizationId: property.organizationId,
      propertyId: property.id,
      kind: collection === 'requests' ? 'request' : 'order',
    });

    await app.db.insert(auditLogs).values({
      organizationId: property.organizationId,
      actorUserId: request.auth.userId,
      action: 'operations.export',
      resourceType: 'property',
      resourceId: property.id,
      metadata: {
        propertyId: property.id,
        kind: collection,
        rowCount: result.rowCount,
        truncated: result.truncated,
        filters: query,
      },
    });

    const filename = `guestportal-${collection}-${property.slug}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .header('x-export-row-count', String(result.rowCount))
      .header('x-export-limit', String(query.limit))
      .header('x-export-truncated', String(result.truncated));
    return reply.send(result.csv);
  }

  app.get('/v1/admin/properties/:propertyId/operations/requests/export', async (request, reply) => {
    return exportOperations(request, reply, 'requests');
  });

  app.get('/v1/admin/properties/:propertyId/operations/orders/export', async (request, reply) => {
    return exportOperations(request, reply, 'orders');
  });
}
