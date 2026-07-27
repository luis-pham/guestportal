'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import type {
  PortalConfigDocument,
  PortalLocation,
  PortalPreviewDevice,
  PortalPreviewLocale,
} from '@guestportal/contracts';
import { Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

type PreviewResponse = {
  propertyId: string;
  version: number;
  locale: PortalPreviewLocale;
  device: PortalPreviewDevice;
  location: PortalLocation | null;
  config: PortalConfigDocument;
  source: 'draft';
};

const deviceWidth: Record<PortalPreviewDevice, number> = {
  phone: 390,
  tablet: 768,
  desktop: 1280,
};

export function PortalPreviewPanel() {
  const t = useTranslations('portalPreview');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [previewLocale, setPreviewLocale] = useState<PortalPreviewLocale>('en');
  const [device, setDevice] = useState<PortalPreviewDevice>('phone');
  const [locationId, setLocationId] = useState('');
  const [locations, setLocations] = useState<PortalLocation[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      const locs = await apiFetch<{ locations: PortalLocation[] }>(
        `/v1/properties/${propertyId}/locations`,
      );
      if (locs.ok) {
        setLocations(locs.data.locations);
        setLocationId(locs.data.locations[0]?.id ?? '');
      }
    })();
  }, [locale, propertyId, router]);

  useEffect(() => {
    if (!propertyId) return;
    void (async () => {
      const query = new URLSearchParams({
        locale: previewLocale,
        device,
      });
      if (locationId) query.set('locationId', locationId);
      const result = await apiFetch<PreviewResponse>(
        `/v1/properties/${propertyId}/portal/preview?${query.toString()}`,
      );
      if (!result.ok) {
        setError(t('loadError'));
        setPreview(null);
        return;
      }
      setPreview(result.data);
      setError(null);
    })();
  }, [device, locationId, previewLocale, propertyId, t]);

  return (
    <main className="gp-state" data-testid="portal-preview-panel">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Select
          label={t('locale')}
          data-testid="preview-locale"
          value={previewLocale}
          onChange={(event) => setPreviewLocale(event.target.value as PortalPreviewLocale)}
          options={[
            { value: 'en', label: 'EN' },
            { value: 'vi', label: 'VI' },
          ]}
        />
        <Select
          label={t('device')}
          data-testid="preview-device"
          value={device}
          onChange={(event) => setDevice(event.target.value as PortalPreviewDevice)}
          options={[
            { value: 'phone', label: t('phone') },
            { value: 'tablet', label: t('tablet') },
            { value: 'desktop', label: t('desktop') },
          ]}
        />
        <Select
          label={t('location')}
          data-testid="preview-location"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          options={locations.map((item) => ({
            value: item.id,
            label: item.name[previewLocale],
          }))}
        />
      </div>
      {error ? (
        <p data-testid="portal-preview-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
      {preview ? (
        <div
          data-testid="portal-preview-frame"
          data-device={preview.device}
          data-locale={preview.locale}
          data-source={preview.source}
          style={{
            width: deviceWidth[preview.device],
            maxWidth: '100%',
            margin: '0 auto',
            border: '1px solid #d4d4d8',
            borderRadius: 24,
            padding: 16,
            background: '#fff',
            minHeight: 420,
          }}
        >
          <p data-testid="preview-location-label">
            {preview.location?.name[preview.locale] ?? t('noLocation')}
          </p>
          <p data-testid="preview-greeting">
            {preview.config.greeting[preview.locale]}
          </p>
          <nav data-testid="preview-primary-nav" aria-label="Primary">
            {preview.config.primaryNavigation
              .filter((item) => item.visible)
              .map((item) => (
                <span key={item.id} style={{ marginRight: 10 }}>
                  {item.label[preview.locale]}
                </span>
              ))}
          </nav>
          <div data-testid="preview-sections">
            {preview.config.sections
              .filter((section) => section.enabled)
              .map((section) => (
                <article
                  key={section.id}
                  data-testid={`preview-section-${section.type}`}
                  style={{ marginTop: 12 }}
                >
                  <strong>
                    {'title' in section && section.title
                      ? section.title[preview.locale]
                      : section.type}
                  </strong>
                </article>
              ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
