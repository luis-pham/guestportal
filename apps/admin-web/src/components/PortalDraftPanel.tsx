'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import type { PortalConfigDocument } from '@guestportal/contracts';
import { Input } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

function propertyIdFromPath(pathname: string) {
  const match = pathname.match(/\/properties\/([^/]+)\//);
  return match?.[1] ?? '';
}

type DraftResponse = {
  propertyId: string;
  version: number;
  updatedAt: string;
  config: PortalConfigDocument;
};

export function PortalDraftPanel() {
  const t = useTranslations('portalDraft');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'conflict'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(1);

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
      versionRef.current = result.data.version;
    })();
  }, [locale, propertyId, router, t]);

  function scheduleAutosave(next: PortalConfigDocument) {
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(() => {
      void (async () => {
        const result = await apiFetch<DraftResponse>(`/v1/properties/${propertyId}/portal/draft`, {
          method: 'PUT',
          body: JSON.stringify({ version: versionRef.current, config: next }),
        });
        if (result.status === 409) {
          setStatus('conflict');
          setError(t('conflict'));
          return;
        }
        if (!result.ok) {
          setStatus('idle');
          setError(t('saveError'));
          return;
        }
        versionRef.current = result.data.version;
        setDraft(result.data);
        setStatus('saved');
        setError(null);
      })();
    }, 400);
  }

  if (!draft && !error) {
    return <main className="gp-state">{t('loading')}</main>;
  }
  if (!draft) {
    return (
      <main className="gp-state" data-testid="portal-draft-error">
        {error}
      </main>
    );
  }

  return (
    <form
      className="gp-state"
      data-testid="portal-draft-panel"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <p data-testid="portal-draft-version">
        {t('version')}: {draft.version}
      </p>
      <p data-testid="portal-draft-template">
        {t('template')}: {draft.config.templateId ?? '—'}
      </p>
      <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        <Input
          label={t('greetingVi')}
          name="greetingVi"
          data-testid="portal-greeting-vi"
          defaultValue={draft.config.greeting.vi}
          onChange={(event) => {
            const next = {
              ...draft.config,
              greeting: { ...draft.config.greeting, vi: event.target.value },
            };
            setDraft({ ...draft, config: next });
            scheduleAutosave(next);
          }}
        />
        <Input
          label={t('greetingEn')}
          name="greetingEn"
          data-testid="portal-greeting-en"
          defaultValue={draft.config.greeting.en}
          onChange={(event) => {
            const next = {
              ...draft.config,
              greeting: { ...draft.config.greeting, en: event.target.value },
            };
            setDraft({ ...draft, config: next });
            scheduleAutosave(next);
          }}
        />
      </div>
      <p data-testid="portal-section-count">
        {t('sections')}: {draft.config.sections.length}
      </p>
      {status === 'saving' ? <p data-testid="portal-draft-saving">{t('saving')}</p> : null}
      {status === 'saved' ? <p data-testid="portal-draft-saved">{t('saved')}</p> : null}
      {error ? (
        <p data-testid="portal-draft-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
