'use client';

import Link from 'next/link';
import type { GuestPortalResponse } from '@guestportal/contracts';
import { findSection, locationSafeHref, pickLocalized } from '../lib/guest-portal';

export function GuideView({ qrToken, data }: { qrToken: string; data: GuestPortalResponse }) {
  const section = findSection(data.portal.config, 'guide_links');
  const title = section
    ? pickLocalized(section.title, data.locale, 'Guide')
    : data.locale.startsWith('vi')
      ? 'Hướng dẫn'
      : 'Guide';
  const links = section?.links ?? [];

  return (
    <main data-testid="guest-guide" style={{ padding: '20px 16px 96px', maxWidth: 480, margin: '0 auto' }}>
      <h1>{title}</h1>
      {links.length === 0 ? (
        <p data-testid="guest-guide-empty">
          {data.locale.startsWith('vi')
            ? 'Chưa có bài hướng dẫn.'
            : 'No guide links are published yet.'}
        </p>
      ) : (
        <ul data-testid="guest-guide-list" style={{ listStyle: 'none', padding: 0 }}>
          {links.map((link) => (
            <li key={link.id} style={{ marginBottom: 12 }}>
              <Link
                href={locationSafeHref(qrToken, link.href)}
                data-testid={`guest-guide-${link.id}`}
                style={{
                  display: 'block',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #ddd',
                  textDecoration: 'none',
                  color: 'inherit',
                  fontWeight: 600,
                }}
              >
                {pickLocalized(link.label, data.locale, link.href)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
