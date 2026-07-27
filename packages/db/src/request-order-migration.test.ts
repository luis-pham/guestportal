import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describe('request/order confirmation migration', () => {
  it('defines draft, committed, idempotency, and RLS structures', () => {
    const sql = readFileSync(
      join(__dirname, '../drizzle/0013_request_order_confirmation.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS request_drafts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS guest_requests');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS order_drafts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS guest_orders');
    expect(sql).toContain('confirm_idempotency_key text');
    expect(sql).toContain('guest_requests_confirm_key_uidx');
    expect(sql).toContain('guest_orders_confirm_key_uidx');
    expect(sql).toContain('request_drafts_tenant_policy');
    expect(sql).toContain('guest_orders_tenant_policy');
  });

  it('defines lifecycle versioning, snapshots, and tenant-scoped history', () => {
    const sql = readFileSync(
      join(__dirname, '../drizzle/0014_request_order_lifecycle.sql'),
      'utf8',
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1');
    expect(sql).toContain('guest_requests_status_check');
    expect(sql).toContain('guest_orders_status_check');
    expect(sql).toContain('subtotal_minor integer NOT NULL DEFAULT 0');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS request_status_history');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS order_status_history');
    expect(sql).toContain('request_status_history_tenant_policy');
    expect(sql).toContain('order_status_history_tenant_policy');
  });
});

describeDb('request/order live schema', () => {
  const sql = postgres(databaseUrl!, { max: 1 });

  afterAll(async () => {
    await sql.end();
  });

  it('exposes confirmation protocol columns', async () => {
    const draftCols = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'request_drafts'
      ORDER BY column_name
    `;
    expect(draftCols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        'confirm_idempotency_key',
        'confirmed_request_id',
        'conversation_id',
        'expires_at',
        'guest_session_id',
        'status',
      ]),
    );

    const orderCols = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'guest_orders'
      ORDER BY column_name
    `;
    expect(orderCols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        'currency',
        'idempotency_key',
        'items',
        'order_draft_id',
        'subtotal_minor',
        'submitted_at',
        'total_minor',
        'version',
      ]),
    );
  });

  it('exposes lifecycle history tables', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('request_status_history', 'order_status_history')
      ORDER BY table_name
    `;
    expect(rows.map((row) => row.table_name)).toEqual([
      'order_status_history',
      'request_status_history',
    ]);
  });
});
