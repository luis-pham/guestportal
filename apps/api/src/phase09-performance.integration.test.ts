import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

type ExplainPlan = {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Actual Rows'?: number;
  'Actual Total Time'?: number;
  Plans?: ExplainPlan[];
};

type ExplainRoot = {
  Plan: ExplainPlan;
  'Execution Time': number;
  'Planning Time': number;
};

type ScopeRow = {
  organization_id: string;
  property_id: string;
};

type PlanSummary = {
  query: string;
  executionTimeMs: number;
  planningTimeMs: number;
  maxActualRows: number;
  scannedRelations: string[];
  indexesUsed: string[];
  sequentialScans: Array<{ relation: string; actualRows: number }>;
};

const evidenceDir =
  process.env.PHASE09_EVIDENCE_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../evidence/phase-09/09.5');

function walkPlan(plan: ExplainPlan, visit: (node: ExplainPlan) => void) {
  visit(plan);
  for (const child of plan.Plans ?? []) {
    walkPlan(child, visit);
  }
}

function summarizePlan(query: string, root: ExplainRoot): PlanSummary {
  const scannedRelations = new Set<string>();
  const indexesUsed = new Set<string>();
  const sequentialScans: Array<{ relation: string; actualRows: number }> = [];
  let maxActualRows = 0;

  walkPlan(root.Plan, (node) => {
    const actualRows = Math.trunc(node['Actual Rows'] ?? 0);
    maxActualRows = Math.max(maxActualRows, actualRows);
    if (node['Relation Name']) {
      scannedRelations.add(node['Relation Name']);
    }
    if (node['Index Name']) {
      indexesUsed.add(node['Index Name']);
    }
    if (node['Node Type'] === 'Seq Scan' && node['Relation Name']) {
      sequentialScans.push({ relation: node['Relation Name'], actualRows });
    }
  });

  return {
    query,
    executionTimeMs: root['Execution Time'],
    planningTimeMs: root['Planning Time'],
    maxActualRows,
    scannedRelations: [...scannedRelations].sort(),
    indexesUsed: [...indexesUsed].sort(),
    sequentialScans,
  };
}

describeIntegration('phase 09 query performance evidence', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
    await app.close();
  });

  it('records tenant-scoped EXPLAIN ANALYZE plans for admin dashboards and tables', async () => {
    const [scope] = await app.sql<ScopeRow[]>`
      SELECT o.id AS organization_id, p.id AS property_id
      FROM organizations o
      INNER JOIN properties p ON p.organization_id = o.id
      WHERE o.slug = 'aurora-hospitality'
        AND p.slug = 'aurora-city-hotel'
      LIMIT 1
    `;
    expect(scope).toBeTruthy();

    const dateFrom = '2026-01-01T00:00:00.000Z';
    const dateTo = '2026-12-31T23:59:59.999Z';
    const status = 'submitted';
    const limit = 30;

    const explained = await Promise.all([
      app.sql<Array<{ 'QUERY PLAN': [ExplainRoot] }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT count(*)::text AS total
        FROM guest_requests
        WHERE organization_id = ${scope!.organization_id}::uuid
          AND property_id = ${scope!.property_id}::uuid
          AND submitted_at >= ${dateFrom}::timestamptz
          AND submitted_at < ${dateTo}::timestamptz
      `,
      app.sql<Array<{ 'QUERY PLAN': [ExplainRoot] }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT
          coalesce(item->>'label', item->>'itemId', 'Unknown service') AS label,
          coalesce(sum((item->>'quantity')::int), 0)::text AS quantity
        FROM guest_orders
        CROSS JOIN LATERAL jsonb_array_elements(items) AS item
        WHERE organization_id = ${scope!.organization_id}::uuid
          AND property_id = ${scope!.property_id}::uuid
          AND submitted_at >= ${dateFrom}::timestamptz
          AND submitted_at < ${dateTo}::timestamptz
        GROUP BY label
        ORDER BY quantity DESC, label ASC
        LIMIT 10
      `,
      app.sql<Array<{ 'QUERY PLAN': [ExplainRoot] }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT r.id, r.status, r.title, r.submitted_at
        FROM guest_requests r
        INNER JOIN guest_sessions s ON s.id = r.guest_session_id
        INNER JOIN locations l ON l.id = s.location_id
        WHERE r.organization_id = ${scope!.organization_id}::uuid
          AND r.property_id = ${scope!.property_id}::uuid
          AND (${status} = 'all' OR r.status = ${status})
          AND r.submitted_at >= ${dateFrom}::timestamptz
          AND r.submitted_at <= ${dateTo}::timestamptz
        ORDER BY r.submitted_at DESC, r.id DESC
        LIMIT ${limit}
      `,
      app.sql<Array<{ 'QUERY PLAN': [ExplainRoot] }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT o.id, o.status, o.title, o.submitted_at, o.total_minor
        FROM guest_orders o
        INNER JOIN guest_sessions s ON s.id = o.guest_session_id
        INNER JOIN locations l ON l.id = s.location_id
        WHERE o.organization_id = ${scope!.organization_id}::uuid
          AND o.property_id = ${scope!.property_id}::uuid
          AND (${status} = 'all' OR o.status = ${status})
          AND o.submitted_at >= ${dateFrom}::timestamptz
          AND o.submitted_at <= ${dateTo}::timestamptz
        ORDER BY o.submitted_at DESC, o.id DESC
        LIMIT ${limit}
      `,
      app.sql<Array<{ 'QUERY PLAN': [ExplainRoot] }>>`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT a.id, a.action, a.resource_type, a.resource_id, a.metadata, a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.organization_id = ${scope!.organization_id}::uuid
          AND (
            a.metadata->>'propertyId' = ${scope!.property_id}
            OR (a.resource_type = 'property' AND a.resource_id = ${scope!.property_id})
          )
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${limit}
      `,
    ]);

    const summaries = [
      'analytics.requestSummary',
      'analytics.topServices',
      'operations.requestsList',
      'operations.ordersExport',
      'audit.logList',
    ].map((name, index) => summarizePlan(name, explained[index]![0]!['QUERY PLAN'][0]!));

    for (const summary of summaries) {
      expect(summary.executionTimeMs).toBeLessThan(750);
      expect(summary.sequentialScans.filter((scan) => scan.actualRows > 1000)).toEqual([]);
    }

    mkdirSync(resolve(evidenceDir, 'performance'), { recursive: true });
    writeFileSync(
      resolve(evidenceDir, 'performance/query-explain.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          environment: process.env.CI ? 'ci' : 'local',
          scope,
          thresholds: {
            maxExecutionTimeMs: 750,
            maxRowsForSequentialScan: 1000,
          },
          summaries,
          rawPlans: explained.map((rows, index) => ({
            query: summaries[index]!.query,
            plan: rows[0]!['QUERY PLAN'][0],
          })),
        },
        null,
        2,
      )}\n`,
    );
  });
});
