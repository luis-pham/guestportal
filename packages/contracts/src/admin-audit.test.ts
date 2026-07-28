import { describe, expect, it } from 'vitest';
import {
  adminAuditLogListResponseSchema,
  adminAuditLogQuerySchema,
  adminOperationExportQuerySchema,
} from './admin-audit.js';

describe('admin audit and export contracts', () => {
  it('validates audit filters and cursor pagination', () => {
    expect(
      adminAuditLogQuerySchema.parse({
        propertyId: crypto.randomUUID(),
        resourceType: 'request',
        action: 'request.status_changed',
        q: 'status',
        limit: '50',
      }),
    ).toMatchObject({ resourceType: 'request', limit: 50 });

    expect(() =>
      adminAuditLogQuerySchema.parse({
        dateFrom: '2026-07-29T00:00:00.000Z',
        dateTo: '2026-07-28T00:00:00.000Z',
      }),
    ).toThrow();
    expect(() => adminAuditLogQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('validates operation export bounds', () => {
    expect(adminOperationExportQuerySchema.parse({ status: 'submitted' })).toMatchObject({
      status: 'submitted',
      limit: 1000,
    });
    expect(adminOperationExportQuerySchema.parse({ limit: '5000' }).limit).toBe(5000);
    expect(() => adminOperationExportQuerySchema.parse({ limit: 5001 })).toThrow();
  });

  it('serializes redacted audit log entries', () => {
    const entry = adminAuditLogListResponseSchema.parse({
      entries: [
        {
          id: crypto.randomUUID(),
          organizationId: crypto.randomUUID(),
          actorUserId: crypto.randomUUID(),
          actorDisplayName: 'Aurora Owner',
          action: 'request.status_changed',
          resourceType: 'request',
          resourceId: crypto.randomUUID(),
          metadata: { propertyId: crypto.randomUUID(), token: '[REDACTED]' },
          createdAt: '2026-07-28T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    expect(entry.entries[0]?.metadata).toMatchObject({ token: '[REDACTED]' });
  });
});
