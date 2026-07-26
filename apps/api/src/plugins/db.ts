import type { FastifyPluginAsync } from 'fastify';
import { createDb, type Database, type DbHandles } from '@guestportal/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    sql: DbHandles['sql'];
  }
}

const dbPlugin: FastifyPluginAsync<{ databaseUrl: string }> = async (app, opts) => {
  const { db, sql } = createDb(opts.databaseUrl);
  app.decorate('db', db);
  app.decorate('sql', sql);

  app.addHook('onClose', async () => {
    await sql.end({ timeout: 5 });
  });
};

export default dbPlugin;
