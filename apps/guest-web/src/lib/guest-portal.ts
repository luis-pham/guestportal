import type { GuestPortalResponse, PortalConfigDocument } from '@guestportal/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function pickLocalized(
  localized: { vi?: string; en?: string } | undefined,
  locale: string,
  fallback = '',
): string {
  if (!localized) return fallback;
  if (locale.startsWith('vi') && localized.vi?.trim()) return localized.vi;
  if (localized.en?.trim()) return localized.en;
  return localized.vi?.trim() || fallback;
}

/** Keep guest navigation under the opaque QR token path. */
export function locationSafeHref(qrToken: string, href: string): string {
  const base = `/g/${qrToken}`;
  if (!href || href === '#') return base;
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return href;
  }
  if (href.startsWith('#')) return `${base}${href}`;
  if (href.startsWith('/g/')) return href;
  if (href.startsWith('/')) return `${base}${href}`;
  return `${base}/${href}`;
}

export async function openGuestSession(
  qrToken: string,
  locale?: 'vi' | 'en',
): Promise<Response> {
  return fetch(`${API_URL}/v1/guest/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: qrToken, ...(locale ? { locale } : {}) }),
  });
}

export async function fetchGuestPortal(): Promise<GuestPortalResponse | null> {
  const response = await fetch(`${API_URL}/v1/guest/portal`, { credentials: 'include' });
  if (!response.ok) return null;
  return (await response.json()) as GuestPortalResponse;
}

export function findSection<T extends PortalConfigDocument['sections'][number]['type']>(
  config: PortalConfigDocument,
  type: T,
) {
  return config.sections.find((section) => section.type === type && section.enabled) as
    | Extract<PortalConfigDocument['sections'][number], { type: T }>
    | undefined;
}
