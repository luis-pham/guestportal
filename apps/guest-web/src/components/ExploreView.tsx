'use client';

import Link from 'next/link';
import type { GuestPortalResponse } from '@guestportal/contracts';
import { findSection, locationSafeHref, pickLocalized } from '../lib/guest-portal';

export function ExploreView({ qrToken, data }: { qrToken: string; data: GuestPortalResponse }) {
  const section = findSection(data.portal.config, 'explore_collections');
  const title = section
    ? pickLocalized(section.title, data.locale, 'Explore')
    : data.locale.startsWith('vi')
      ? 'Khám phá'
      : 'Explore';
  const keys = section?.collectionKeys ?? [];

  return (
    <main data-testid="guest-explore" style={{ padding: '20px 16px 96px', maxWidth: 480, margin: '0 auto' }}>
      <h1>{title}</h1>
      <p data-testid="guest-explore-location">
        {pickLocalized(data.location.name, data.locale, data.location.code)}
      </p>
      {keys.length === 0 ? (
        <p data-testid="guest-explore-empty">
          {data.locale.startsWith('vi')
            ? 'Chưa có bộ sưu tập khám phá.'
            : 'No explore collections are published yet.'}
        </p>
      ) : (
        <ul data-testid="guest-explore-list" style={{ listStyle: 'none', padding: 0 }}>
          {keys.map((key) => (
            <li key={key} style={{ marginBottom: 12 }}>
              <Link
                href={locationSafeHref(qrToken, `/explore/${key}`)}
                data-testid={`guest-explore-${key}`}
                style={{
                  display: 'block',
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #ddd',
                  textDecoration: 'none',
                  color: 'inherit',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {key.replace(/_/g, ' ')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
