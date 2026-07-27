import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describe('conversations migration', () => {
  it('defines scoped conversations, ordered messages, retention, and RLS', () => {
    const sql = readFileSync(join(__dirname, '../drizzle/0012_conversations_messages.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS conversations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS messages');
    expect(sql).toContain('organization_id uuid NOT NULL');
    expect(sql).toContain('property_id uuid NOT NULL');
    expect(sql).toContain('guest_session_id uuid NOT NULL');
    expect(sql).toContain('retention_policy text NOT NULL');
    expect(sql).toContain('retention_expires_at timestamptz NOT NULL');
    expect(sql).toContain('last_message_sequence integer NOT NULL DEFAULT 0');
    expect(sql).toContain('messages_conversation_sequence_uidx');
    expect(sql).toContain('conversations_tenant_policy');
    expect(sql).toContain('messages_tenant_policy');
  });
});

describeDb('conversations live schema', () => {
  const sql = postgres(databaseUrl!, { max: 1 });

  afterAll(async () => {
    await sql.end();
  });

  it('exposes retention and ordering columns', async () => {
    const conversationCols = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      ORDER BY column_name
    `;
    expect(conversationCols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        'guest_session_id',
        'last_message_at',
        'last_message_sequence',
        'retention_expires_at',
        'retention_policy',
      ]),
    );

    const messageCols = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'messages'
      ORDER BY column_name
    `;
    expect(messageCols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        'client_message_id',
        'conversation_id',
        'original_text',
        'sequence',
        'source',
      ]),
    );
  });
});
