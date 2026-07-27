import { createHash, randomBytes } from 'node:crypto';

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/** Opaque QR token: 256-bit entropy, URL-safe, never embeds internal IDs. */
export function createOpaqueQrToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashQrToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function assertOpaqueQrToken(token: string): void {
  if (token.length < 32) {
    throw new Error('QR token entropy too low');
  }
  if (UUID_RE.test(token)) {
    throw new Error('QR token must not embed UUID shapes');
  }
}

export function guestPathForToken(token: string): string {
  return `/g/${token}`;
}

export function guestUrlForToken(token: string): string {
  const base = (process.env.GUEST_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${guestPathForToken(token)}`;
}
