import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('portal drafts migration', () => {
  it('defines portal_drafts and portal_templates with RLS', () => {
    const sql = readFileSync(join(__dirname, '../drizzle/0005_portal_drafts.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS portal_drafts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS portal_templates');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('portal_drafts_tenant_policy');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON portal_drafts');
  });
});
