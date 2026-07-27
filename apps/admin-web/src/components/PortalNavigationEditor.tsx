'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import type { PortalConfigDocument, PortalNavUpdateInput } from '@guestportal/contracts';
import { Button, Input } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

type DraftResponse = {
  version: number;
  config: PortalConfigDocument;
};

export function PortalNavigationEditor() {
  const t = useTranslations('portalNav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      const result = await apiFetch<DraftResponse>(`/v1/properties/${propertyId}/portal/draft`);
      if (!result.ok) {
        setError(t('loadError'));
        return;
      }
      setDraft(result.data);
    })();
  }, [locale, propertyId, router, t]);

  async function save() {
    if (!draft) return;
    setError(null);
    setSaved(false);
    const payload: PortalNavUpdateInput = {
      version: draft.version,
      primaryNavigation: draft.config.primaryNavigation,
      secondaryNavigation: draft.config.secondaryNavigation,
    };
    const result = await apiFetch<DraftResponse>(
      `/v1/properties/${propertyId}/portal/navigation`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (!result.ok) {
      setError(t('saveError'));
      return;
    }
    setDraft(result.data);
    setSaved(true);
  }

  if (!draft && !error) return <main className="gp-state">{t('loading')}</main>;
  if (!draft) {
    return (
      <main className="gp-state" data-testid="portal-nav-error">
        {error}
      </main>
    );
  }

  return (
    <main className="gp-state" data-testid="portal-nav-editor">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <h3>{t('primary')}</h3>
      <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
        {draft.config.primaryNavigation.map((item, index) => (
          <div key={item.id} data-testid={`nav-primary-${index}`} style={{ display: 'grid', gap: 6 }}>
            <Input
              label={`${t('labelEn')} #${index + 1}`}
              value={item.label.en}
              onChange={(event) => {
                const primaryNavigation = draft.config.primaryNavigation.map((nav, i) =>
                  i === index ? { ...nav, label: { ...nav.label, en: event.target.value } } : nav,
                );
                setDraft({
                  ...draft,
                  config: { ...draft.config, primaryNavigation },
                });
              }}
            />
            <Input
              label={t('href')}
              value={item.href}
              data-testid={`nav-primary-href-${index}`}
              onChange={(event) => {
                const primaryNavigation = draft.config.primaryNavigation.map((nav, i) =>
                  i === index ? { ...nav, href: event.target.value } : nav,
                );
                setDraft({
                  ...draft,
                  config: { ...draft.config, primaryNavigation },
                });
              }}
            />
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 16 }}>{t('secondary')}</h3>
      <p data-testid="nav-secondary-count">
        {t('secondaryCount')}: {draft.config.secondaryNavigation.length}
      </p>
      {error ? (
        <p data-testid="portal-nav-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
      {saved ? <p data-testid="portal-nav-saved">{t('saved')}</p> : null}
      <div style={{ marginTop: 12 }}>
        <Button data-testid="portal-nav-save" onClick={() => void save()}>
          {t('save')}
        </Button>
      </div>
    </main>
  );
}
