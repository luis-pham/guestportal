'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

type Location = {
  id: string;
  code: string;
  name: { vi: string; en: string };
};

type QrCode = {
  id: string;
  locationId: string;
  destinationType: string;
  enabled: boolean;
  scanCount: number;
  lastScannedAt: string | null;
};

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function QrCodesPanel() {
  const t = useTranslations('qr');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [locations, setLocations] = useState<Location[]>([]);
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [locationId, setLocationId] = useState('');
  const [destinationType, setDestinationType] = useState('portal_home');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const locs = await apiFetch<{ locations: Location[] }>(
      `/v1/properties/${propertyId}/locations`,
    );
    if (!locs.ok) {
      setError(t('loadError'));
      return;
    }
    setLocations(locs.data.locations);
    if (!locationId && locs.data.locations[0]) {
      setLocationId(locs.data.locations[0].id);
    }

    const list = await apiFetch<{ qrCodes: QrCode[] }>(`/v1/properties/${propertyId}/qr-codes`);
    if (!list.ok) {
      setError(t('loadError'));
      return;
    }
    setQrCodes(list.data.qrCodes);
  }

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per property
  }, [locale, propertyId, router]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    setCreatedToken(null);
    const result = await apiFetch<{ token: string; qrCode: QrCode }>(
      `/v1/properties/${propertyId}/qr-codes`,
      {
        method: 'POST',
        body: JSON.stringify({ locationId, destinationType }),
      },
    );
    setBusy(false);
    if (!result.ok) {
      setError(t('createError'));
      return;
    }
    setCreatedToken(result.data.token);
    await refresh();
  }

  async function toggleEnabled(qr: QrCode) {
    setError(null);
    const result = await apiFetch(`/v1/properties/${propertyId}/qr-codes/${qr.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !qr.enabled }),
    });
    if (!result.ok) {
      setError(t('updateError'));
      return;
    }
    await refresh();
  }

  async function download(qr: QrCode, format: 'svg' | 'png') {
    setError(null);
    const response = await fetch(
      `${API_URL}/v1/properties/${propertyId}/qr-codes/${qr.id}/download?format=${format}`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      setError(t('downloadError'));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qr-${qr.id.slice(0, 8)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="gp-state" data-testid="qr-codes-panel">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>

      <div className="gp-stack" style={{ gap: '1rem', maxWidth: 720 }}>
        <Select
          label={t('location')}
          data-testid="qr-location"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          options={locations.map((loc) => ({
            value: loc.id,
            label: `${loc.code} — ${loc.name.en}`,
          }))}
        />
        <Select
          label={t('destination')}
          data-testid="qr-destination"
          value={destinationType}
          onChange={(event) => setDestinationType(event.target.value)}
          options={[
            { value: 'portal_home', label: t('destHome') },
            { value: 'guide', label: t('destGuide') },
            { value: 'explore', label: t('destExplore') },
            { value: 'catalog', label: t('destCatalog') },
            { value: 'request', label: t('destRequest') },
          ]}
        />
        <Button data-testid="qr-create" disabled={busy || !locationId} onClick={() => void onCreate()}>
          {t('create')}
        </Button>
        {createdToken ? (
          <p data-testid="qr-created-token">
            {t('createdToken')}: <code>{createdToken}</code>
          </p>
        ) : null}
        {error ? (
          <p data-testid="qr-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ul data-testid="qr-list" style={{ marginTop: '2rem', padding: 0, listStyle: 'none' }}>
        {qrCodes.map((qr) => (
          <li
            key={qr.id}
            data-testid={`qr-item-${qr.id}`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--gp-border, #ddd)',
            }}
          >
            <span>
              {qr.destinationType} · scans {qr.scanCount} ·{' '}
              {qr.enabled ? t('enabled') : t('disabled')}
            </span>
            <Button
              data-testid={`qr-toggle-${qr.id}`}
              variant="secondary"
              onClick={() => void toggleEnabled(qr)}
            >
              {qr.enabled ? t('disable') : t('enable')}
            </Button>
            <Button
              data-testid={`qr-download-svg-${qr.id}`}
              variant="secondary"
              onClick={() => void download(qr, 'svg')}
            >
              {t('downloadSvg')}
            </Button>
            <Button
              data-testid={`qr-download-png-${qr.id}`}
              variant="secondary"
              onClick={() => void download(qr, 'png')}
            >
              {t('downloadPng')}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
