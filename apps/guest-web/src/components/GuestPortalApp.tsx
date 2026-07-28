'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GuestPortalResponse } from '@guestportal/contracts';
import { GuestHomepage, GuestStatusCenter } from '@guestportal/ui';
import '@guestportal/ui/guest-homepage.css';
import '@guestportal/ui/guest-status.css';
import { fetchGuestPortal, locationSafeHref, openGuestSession } from '../lib/guest-portal';
import { appHref } from '../lib/base-path';
import { GuestMobileNav } from './GuestMobileNav';
import { ExploreView } from './ExploreView';
import { GuideView } from './GuideView';
import { GuestStatusView } from './GuestStatusView';
import { ServicesView } from './ServicesView';
import { GuestErrorBoundary } from './GuestErrorBoundary';
import { VoiceAssistantShell } from './VoiceAssistantShell';
import './guest-nav.css';
import './guest-ops.css';

export type GuestView = 'home' | 'explore' | 'guide' | 'chat' | 'services' | 'status';

async function fetchPortalWithSessionRetry() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const data = await fetchGuestPortal();
    if (data) return data;
    await new Promise((resolve) => {
      window.setTimeout(resolve, 150);
    });
  }
  return null;
}

function withSafePublicLinks(data: GuestPortalResponse, qrToken: string): GuestPortalResponse {
  return {
    ...data,
    portal: {
      ...data.portal,
      config: {
        ...data.portal.config,
        sections: data.portal.config.sections.map((section) => {
          if (section.type !== 'quick_actions') return section;
          return {
            ...section,
            actions: section.actions.map((action) => ({
              ...action,
              href: appHref(locationSafeHref(qrToken, action.href)),
            })),
          };
        }),
      },
    },
  };
}

export function GuestPortalApp({ qrToken, view }: { qrToken: string; view: GuestView }) {
  const [portal, setPortal] = useState<GuestPortalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<'vi' | 'en'>('en');
  const [offline, setOffline] = useState(false);
  const [slow, setSlow] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (nextLocale?: 'vi' | 'en') => {
      setError(null);
      setLoading(true);
      setSlow(false);
      const slowTimer = window.setTimeout(() => setSlow(true), 2500);
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setOffline(true);
          setPortal(null);
          return;
        }
        setOffline(false);
        const sessionResponse = await openGuestSession(qrToken, nextLocale);
        if (!sessionResponse.ok) {
          setError('Unable to open guest session for this QR code.');
          setPortal(null);
          return;
        }
        const data = await fetchPortalWithSessionRetry();
        if (!data) {
          setError('Published portal is not available yet.');
          setPortal(null);
          return;
        }
        setPortal(withSafePublicLinks(data, qrToken));
        setLocale(data.locale.startsWith('vi') ? 'vi' : 'en');
      } finally {
        window.clearTimeout(slowTimer);
        setSlow(false);
        setLoading(false);
      }
    },
    [qrToken],
  );

  useEffect(() => {
    void load();
    const onOffline = () => setOffline(true);
    const onOnline = () => {
      setOffline(false);
      void load();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [load]);

  if (loading && !portal) {
    return (
      <main data-testid="guest-session-loading" style={{ padding: 24, fontFamily: 'system-ui' }}>
        <p>Opening guest portal…</p>
        {slow ? <p data-testid="guest-slow-network">Still loading — network may be slow.</p> : null}
      </main>
    );
  }

  if (offline && !portal) {
    return (
      <GuestStatusCenter
        locale={locale}
        offline
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  if (error) {
    return (
      <main data-testid="guest-session-error" style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>QR unavailable</h1>
        <p>{error}</p>
        <button type="button" data-testid="guest-session-retry" onClick={() => void load()}>
          Retry
        </button>
      </main>
    );
  }

  if (!portal) {
    return (
      <main data-testid="guest-session-loading" style={{ padding: 24, fontFamily: 'system-ui' }}>
        <p>Opening guest portal…</p>
      </main>
    );
  }

  return (
    <GuestErrorBoundary locale={locale} onRetry={() => void load()}>
      <div style={{ minHeight: '100vh', paddingBottom: 72, fontFamily: 'system-ui' }}>
        {offline ? (
          <p
            data-testid="guest-offline-banner"
            style={{ margin: 0, padding: 8, background: '#fef3c7', textAlign: 'center' }}
          >
            Offline — showing last loaded content.
          </p>
        ) : null}
        {slow ? (
          <p
            data-testid="guest-slow-network"
            style={{ margin: 0, padding: 8, background: '#e0f2fe', textAlign: 'center' }}
          >
            Slow network detected…
          </p>
        ) : null}
        {view === 'home' ? <GuestHomepage data={portal} /> : null}
        {view === 'explore' ? <ExploreView qrToken={qrToken} data={portal} /> : null}
        {view === 'guide' ? <GuideView qrToken={qrToken} data={portal} /> : null}
        {view === 'services' ? <ServicesView qrToken={qrToken} data={portal} /> : null}
        {view === 'status' ? <GuestStatusView locale={portal.locale} /> : null}
        {view === 'chat' ? <VoiceAssistantShell data={portal} /> : null}
        <GuestMobileNav
          qrToken={qrToken}
          data={portal}
          active={view}
          onToggleLocale={() => {
            const next = locale === 'vi' ? 'en' : 'vi';
            void load(next);
          }}
        />
      </div>
    </GuestErrorBoundary>
  );
}
