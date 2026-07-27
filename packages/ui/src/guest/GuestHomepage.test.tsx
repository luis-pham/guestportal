import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createDefaultPortalConfig, defaultPropertyBranding } from '@guestportal/contracts';
import { GuestHomepage } from './GuestHomepage';

const sample = {
  locale: 'en',
  property: {
    name: 'Aurora City Hotel',
    slug: 'aurora-city-hotel',
    timezone: 'Asia/Ho_Chi_Minh',
    defaultLocale: 'en',
    supportedLocales: ['en', 'vi'],
  },
  location: { code: 'lobby', name: { vi: 'Sảnh', en: 'Lobby' } },
  destination: { type: 'portal_home' as const },
  branding: {
    ...defaultPropertyBranding(),
    displayName: 'Aurora City Hotel',
    logoUrl: null,
    coverUrl: null,
  },
  portal: {
    versionNumber: 1,
    publishedAt: new Date().toISOString(),
    config: createDefaultPortalConfig('hotel'),
  },
  fallbacks: { missingLogo: true, missingCover: true },
};

describe('GuestHomepage', () => {
  it('renders brand fallbacks and location', () => {
    const { getByTestId } = render(<GuestHomepage data={sample} />);
    expect(getByTestId('guest-cover-fallback')).toBeTruthy();
    expect(getByTestId('guest-logo-fallback')).toBeTruthy();
    expect(getByTestId('guest-location').textContent).toContain('Lobby');
    expect(getByTestId('guest-quick-actions').querySelectorAll('a').length).toBeGreaterThan(0);
  });

  it('has no critical axe violations', async () => {
    const { container } = render(<GuestHomepage data={sample} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
