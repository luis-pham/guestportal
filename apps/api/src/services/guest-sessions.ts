import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '@guestportal/db';
import { guestSessions } from '@guestportal/db';

export const GUEST_SESSION_COOKIE = 'gp_guest_session';
export const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

export function createGuestSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashGuestSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createGuestSessionRow(
  db: Database,
  input: {
    organizationId: string;
    propertyId: string;
    locationId: string;
    qrCodeId: string | null;
    locale: string;
    metadata?: Record<string, unknown>;
  },
) {
  const token = createGuestSessionToken();
  const tokenHash = hashGuestSessionToken(token);
  const expiresAt = new Date(Date.now() + GUEST_SESSION_TTL_MS);
  const [row] = await db
    .insert(guestSessions)
    .values({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      locationId: input.locationId,
      qrCodeId: input.qrCodeId,
      tokenHash,
      locale: input.locale,
      status: 'active',
      expiresAt,
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) {
    throw new Error('Failed to create guest session');
  }
  return { token, session: row };
}

export async function resolveGuestSession(db: Database, token: string) {
  const tokenHash = hashGuestSessionToken(token);
  const now = new Date();
  const rows = await db
    .select()
    .from(guestSessions)
    .where(
      and(
        eq(guestSessions.tokenHash, tokenHash),
        eq(guestSessions.status, 'active'),
        gt(guestSessions.expiresAt, now),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  await db
    .update(guestSessions)
    .set({ lastSeenAt: now })
    .where(eq(guestSessions.id, row.id));
  return row;
}
