import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';

export type { Sql } from 'postgres';

export type Database = PostgresJsDatabase<typeof schema>;

export type DbHandles = {
  sql: Sql;
  db: Database;
};

export function createDb(connectionString: string): DbHandles {
  const sql = postgres(connectionString, {
    max: 10,
    prepare: false,
  });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

/**
 * Run work inside a transaction with RLS session variables set.
 * Empty organizationId disables tenant scoping for privileged bootstrap paths.
 */
export async function withTenantTransaction<T>(
  sql: Sql,
  organizationId: string | null,
  userId: string | null,
  fn: (tx: Sql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.organization_id', ${organizationId ?? ''}, true)`;
    await tx`select set_config('app.user_id', ${userId ?? ''}, true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}
