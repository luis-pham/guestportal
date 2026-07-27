'use client';

import Link from 'next/link';
import type { GuestPortalResponse } from '@guestportal/contracts';
import { locationSafeHref, pickLocalized } from '../lib/guest-portal';

const labels = {
  vi: { home: 'Trang chủ', explore: 'Khám phá', guide: 'Hướng dẫn', assistant: 'Trợ lý', locale: 'EN' },
  en: { home: 'Home', explore: 'Explore', guide: 'Guide', assistant: 'Assistant', locale: 'VI' },
};

export function GuestMobileNav({
  qrToken,
  data,
  active,
  onToggleLocale,
}: {
  qrToken: string;
  data: GuestPortalResponse;
  active: 'home' | 'explore' | 'guide' | 'chat';
  onToggleLocale: () => void;
}) {
  const localeKey = data.locale.startsWith('vi') ? 'vi' : 'en';
  const t = labels[localeKey];
  const configured = data.portal.config.primaryNavigation
    .filter((item) => item.visible)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      href: locationSafeHref(qrToken, item.href),
      label: pickLocalized(item.label, data.locale, item.href),
    }));

  const fallback = [
    { id: 'home', href: `/g/${qrToken}`, label: t.home },
    { id: 'explore', href: `/g/${qrToken}/explore`, label: t.explore },
    { id: 'guide', href: `/g/${qrToken}/guide`, label: t.guide },
    { id: 'chat', href: `/g/${qrToken}/chat`, label: t.assistant },
  ];

  const items = configured.length > 0 ? configured : fallback;

  return (
    <nav className="gp-guest-nav" data-testid="guest-mobile-nav" aria-label="Guest">
      <ul>
        {items.map((item) => {
          const isActive =
            (active === 'home' && (item.href === `/g/${qrToken}` || item.href.endsWith('/'))) ||
            (active === 'explore' && item.href.includes('/explore')) ||
            (active === 'guide' && item.href.includes('/guide')) ||
            (active === 'chat' && item.href.includes('/chat'));
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                data-testid={`guest-nav-${item.id}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <button type="button" data-testid="guest-locale-toggle" onClick={onToggleLocale}>
        {t.locale}
      </button>
    </nav>
  );
}
