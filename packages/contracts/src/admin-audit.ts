import { z } from 'zod';

const datetimeWithOffsetSchema = z.string().datetime({ offset: true });

export const adminAuditResourceTypeSchema = z.enum([
  'organization',
  'property',
  'portal',
  'knowledge_source',
  'request',
  'order',
  'team_member',
  'asset',
  'system',
]);

export const adminAuditLogQuerySchema = z
  .object({
    propertyId: z.string().uuid().optional(),
    action: z.string().trim().min(1).max(120).optional(),
    resourceType: adminAuditResourceTypeSchema.optional(),
    actorUserId: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(120).optional(),
    dateFrom: datetimeWithOffsetSchema.optional(),
    dateTo: datetimeWithOffsetSchema.optional(),
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || Date.parse(input.dateFrom) <= Date.parse(input.dateTo),
    {
      message: 'dateFrom must be before dateTo',
      path: ['dateFrom'],
    },
  );

export const adminOperationExportQuerySchema = z
  .object({
    status: z.string().trim().min(1).max(40).optional().default('all'),
    dateFrom: datetimeWithOffsetSchema.optional(),
    dateTo: datetimeWithOffsetSchema.optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || Date.parse(input.dateFrom) <= Date.parse(input.dateTo),
    {
      message: 'dateFrom must be before dateTo',
      path: ['dateFrom'],
    },
  );

export const adminAuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  actorDisplayName: z.string().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export const adminAuditLogListResponseSchema = z.object({
  entries: z.array(adminAuditLogEntrySchema),
  nextCursor: z.string().nullable(),
});

export type AdminAuditResourceType = z.infer<typeof adminAuditResourceTypeSchema>;
export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;
export type AdminOperationExportQuery = z.infer<typeof adminOperationExportQuerySchema>;
export type AdminAuditLogEntry = z.infer<typeof adminAuditLogEntrySchema>;
export type AdminAuditLogListResponse = z.infer<typeof adminAuditLogListResponseSchema>;
