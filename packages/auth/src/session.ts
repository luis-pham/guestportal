import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { sessions, users, type Database } from '@guestportal/db';

export const SESSION_COOKIE = 'gp_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createSession(
  db: Database,
  input: {
    userId: string;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    ttlMs?: number | undefined;
  },
) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? SESSION_TTL_MS));

  const values: typeof sessions.$inferInsert = {
    userId: input.userId,
    tokenHash,
    expiresAt,
  };
  if (input.userAgent !== undefined) {
    values.userAgent = input.userAgent;
  }
  if (input.ipAddress !== undefined) {
    values.ipAddress = input.ipAddress;
  }

  const [row] = await db.insert(sessions).values(values).returning();

  if (!row) {
    throw new Error('Failed to create session');
  }

  return { token, session: row };
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash));
}

export async function revokeAllUserSessions(db: Database, userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function resolveSession(db: Database, token: string) {
  const tokenHash = hashSessionToken(token);
  const now = new Date();

  const rows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.status, 'active'),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.session.id));

  return row;
}
