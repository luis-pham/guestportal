import type {
  AdminAuditLogEntry,
  AdminAuditLogQuery,
  AdminOperationExportQuery,
} from '@guestportal/contracts';
import type { Sql } from '@guestportal/db';
import { ApiError } from '../errors.js';

type AuditCursor = {
  createdAt: string;
  id: string;
};

type AuditLogRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
};

type ExportKind = 'request' | 'order';

type ExportRow = {
  kind: ExportKind;
  id: string;
  status: string;
  title: string;
  summary: string;
  locale: string;
  location_code: string;
  location_name: { vi?: string; en?: string } | null;
  assignee_name: string | null;
  submitted_at: Date | string;
  total_minor: number | null;
  currency: string | null;
};

const sensitiveKeyPattern =
  /(?:password|passcode|secret|token|hash|cookie|authorization|credential|api[_-]?key|private[_-]?key)/i;

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function encodeAuditCursor(input: AuditCursor) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function decodeAuditCursor(cursor: string | undefined): AuditCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<AuditCursor>;
    if (
      typeof parsed.createdAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)
    ) {
      throw new Error('Invalid cursor.');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Audit cursor is invalid.');
  }
}

function sanitizeMetadataValue(value: unknown, key = ''): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeMetadataValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown>) {
  return sanitizeMetadataValue(metadata) as Record<string, unknown>;
}

function toAuditEntry(row: AuditLogRow): AdminAuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id,
    actorDisplayName: row.actor_display_name,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: sanitizeAuditMetadata(row.metadata ?? {}),
    createdAt: toIso(row.created_at),
  };
}

export async function listAuditLogs(
  sql: Sql,
  input: AdminAuditLogQuery & {
    organizationId: string;
    visiblePropertyIds: string[] | 'all';
  },
) {
  const cursor = decodeAuditCursor(input.cursor);
  const dateFrom = input.dateFrom ?? null;
  const dateTo = input.dateTo ?? null;
  const action = input.action ?? null;
  const resourceType = input.resourceType ?? null;
  const actorUserId = input.actorUserId ?? null;
  const propertyId = input.propertyId ?? null;
  const q = input.q ? `%${input.q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%` : null;
  const cursorCreatedAt = cursor?.createdAt ?? null;
  const cursorId = cursor?.id ?? null;
  const requestedLimit = input.limit;
  const queryLimit = requestedLimit + 1;
  const visiblePropertyIds =
    input.visiblePropertyIds === 'all' ? null : input.visiblePropertyIds.length > 0 ? input.visiblePropertyIds : [''];

  const rows = await sql<AuditLogRow[]>`
    SELECT
      a.id,
      a.organization_id,
      a.actor_user_id,
      u.display_name AS actor_display_name,
      a.action,
      a.resource_type,
      a.resource_id,
      a.metadata,
      a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
    WHERE a.organization_id = ${input.organizationId}::uuid
      AND (${dateFrom}::timestamptz IS NULL OR a.created_at >= ${dateFrom}::timestamptz)
      AND (${dateTo}::timestamptz IS NULL OR a.created_at <= ${dateTo}::timestamptz)
      AND (${action}::text IS NULL OR a.action = ${action})
      AND (${resourceType}::text IS NULL OR a.resource_type = ${resourceType})
      AND (${actorUserId}::uuid IS NULL OR a.actor_user_id = ${actorUserId}::uuid)
      AND (
        ${propertyId}::uuid IS NULL
        OR a.metadata->>'propertyId' = ${propertyId}
        OR (a.resource_type = 'property' AND a.resource_id = ${propertyId})
      )
      AND (
        ${visiblePropertyIds}::text[] IS NULL
        OR a.metadata->>'propertyId' = ANY(${visiblePropertyIds}::text[])
        OR (a.resource_type = 'property' AND a.resource_id = ANY(${visiblePropertyIds}::text[]))
      )
      AND (
        ${q}::text IS NULL
        OR a.action ILIKE ${q} ESCAPE '\\'
        OR a.resource_type ILIKE ${q} ESCAPE '\\'
        OR COALESCE(a.resource_id, '') ILIKE ${q} ESCAPE '\\'
        OR COALESCE(u.display_name, '') ILIKE ${q} ESCAPE '\\'
        OR a.metadata::text ILIKE ${q} ESCAPE '\\'
      )
      AND (
        ${cursorCreatedAt}::timestamptz IS NULL
        OR (a.created_at, a.id) < (${cursorCreatedAt}::timestamptz, ${cursorId}::uuid)
      )
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ${queryLimit}
  `;

  const entries = rows.slice(0, requestedLimit).map(toAuditEntry);
  const last = entries.at(-1);
  return {
    entries,
    nextCursor:
      rows.length > requestedLimit && last
        ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

function protectCsvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function operationRowsToCsv(rows: ExportRow[]) {
  const headers = [
    'kind',
    'id',
    'status',
    'title',
    'summary',
    'locale',
    'location_code',
    'location_name',
    'assignee',
    'submitted_at',
    'total_minor',
    'currency',
  ];
  const lines = rows.map((row) =>
    [
      row.kind,
      row.id,
      row.status,
      row.title,
      row.summary,
      row.locale,
      row.location_code,
      row.location_name?.en ?? row.location_name?.vi ?? '',
      row.assignee_name ?? '',
      toIso(row.submitted_at),
      row.total_minor ?? '',
      row.currency ?? '',
    ]
      .map(protectCsvCell)
      .join(','),
  );
  return `${headers.map(protectCsvCell).join(',')}\n${lines.join('\n')}${lines.length ? '\n' : ''}`;
}

export async function exportOperationRows(
  sql: Sql,
  input: AdminOperationExportQuery & {
    organizationId: string;
    propertyId: string;
    kind: ExportKind;
  },
) {
  const status = input.status ?? 'all';
  const dateFrom = input.dateFrom ?? null;
  const dateTo = input.dateTo ?? null;
  const rows =
    input.kind === 'request'
      ? await sql<ExportRow[]>`
          SELECT
            'request' AS kind,
            r.id,
            r.status,
            r.title,
            r.details AS summary,
            r.locale,
            l.code AS location_code,
            l.name AS location_name,
            u.display_name AS assignee_name,
            r.submitted_at,
            NULL::integer AS total_minor,
            NULL::char(3) AS currency
          FROM guest_requests r
          INNER JOIN guest_sessions s ON s.id = r.guest_session_id
          INNER JOIN locations l ON l.id = s.location_id
          LEFT JOIN users u ON u.id = r.assigned_staff_id
          WHERE r.organization_id = ${input.organizationId}::uuid
            AND r.property_id = ${input.propertyId}::uuid
            AND (${status} = 'all' OR r.status = ${status})
            AND (${dateFrom}::timestamptz IS NULL OR r.submitted_at >= ${dateFrom}::timestamptz)
            AND (${dateTo}::timestamptz IS NULL OR r.submitted_at <= ${dateTo}::timestamptz)
          ORDER BY r.submitted_at DESC, r.id DESC
          LIMIT ${input.limit}
        `
      : await sql<ExportRow[]>`
          SELECT
            'order' AS kind,
            o.id,
            o.status,
            o.title,
            o.notes AS summary,
            o.locale,
            l.code AS location_code,
            l.name AS location_name,
            u.display_name AS assignee_name,
            o.submitted_at,
            o.total_minor,
            o.currency
          FROM guest_orders o
          INNER JOIN guest_sessions s ON s.id = o.guest_session_id
          INNER JOIN locations l ON l.id = s.location_id
          LEFT JOIN users u ON u.id = o.assigned_staff_id
          WHERE o.organization_id = ${input.organizationId}::uuid
            AND o.property_id = ${input.propertyId}::uuid
            AND (${status} = 'all' OR o.status = ${status})
            AND (${dateFrom}::timestamptz IS NULL OR o.submitted_at >= ${dateFrom}::timestamptz)
            AND (${dateTo}::timestamptz IS NULL OR o.submitted_at <= ${dateTo}::timestamptz)
          ORDER BY o.submitted_at DESC, o.id DESC
          LIMIT ${input.limit}
        `;

  return {
    csv: operationRowsToCsv(rows),
    rowCount: rows.length,
    truncated: rows.length >= input.limit,
  };
}
