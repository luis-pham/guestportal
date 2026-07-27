'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

type Version = {
  id: string;
  versionNumber: number;
  checksumSha256: string;
  publishedAt: string;
  note: string | null;
  restoredFromVersionId: string | null;
};

type DraftResponse = { version: number };

export function PortalPublishHistory() {
  const t = useTranslations('portalPublish');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [versions, setVersions] = useState<Version[]>([]);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function reload() {
    const draft = await apiFetch<DraftResponse>(`/v1/properties/${propertyId}/portal/draft`);
    if (draft.ok) setDraftVersion(draft.data.version);
    const list = await apiFetch<{ versions: Version[] }>(
      `/v1/properties/${propertyId}/portal/versions`,
    );
    if (!list.ok) {
      setError(t('loadError'));
      return;
    }
    setVersions(list.data.versions);
  }

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) {
        router.replace(`/${locale}/login`);
        return;
      }
      await reload();
    })();
    // Initial load for property route only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, propertyId, router]);

  async function publish() {
    if (draftVersion == null) return;
    setError(null);
    setStatus(null);
    const result = await apiFetch<{ version: Version }>(
      `/v1/properties/${propertyId}/portal/publish`,
      {
        method: 'POST',
        body: JSON.stringify({
          expectedDraftVersion: draftVersion,
          note: 'Published from admin',
          idempotencyKey: `ui-publish-${propertyId}-${draftVersion}`,
        }),
      },
    );
    if (!result.ok) {
      setError(t('publishError'));
      return;
    }
    setStatus(t('published', { version: result.data.version.versionNumber }));
    await reload();
  }

  async function restore(versionId: string) {
    setError(null);
    setStatus(null);
    const result = await apiFetch<{ version: Version }>(
      `/v1/properties/${propertyId}/portal/versions/${versionId}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({ note: 'Rollback from admin' }),
      },
    );
    if (!result.ok) {
      setError(t('restoreError'));
      return;
    }
    setStatus(t('restored', { version: result.data.version.versionNumber }));
    await reload();
  }

  return (
    <main className="gp-state" data-testid="portal-publish-history">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>
      <p data-testid="publish-draft-version">
        {t('draftVersion')}: {draftVersion ?? '—'}
      </p>
      <Button data-testid="portal-publish-button" onClick={() => void publish()}>
        {t('publish')}
      </Button>
      <ul
        data-testid="portal-version-list"
        style={{ marginTop: 16, listStyle: 'none', padding: 0 }}
      >
        {versions.map((version) => (
          <li
            key={version.id}
            data-testid={`portal-version-${version.versionNumber}`}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <span>
              v{version.versionNumber} · {new Date(version.publishedAt).toLocaleString()}
              {version.restoredFromVersionId ? ` · ${t('rollbackMarker')}` : ''}
            </span>
            <Button
              data-testid={`portal-restore-${version.versionNumber}`}
              variant="secondary"
              onClick={() => void restore(version.id)}
            >
              {t('restore')}
            </Button>
          </li>
        ))}
      </ul>
      {status ? <p data-testid="portal-publish-status">{status}</p> : null}
      {error ? (
        <p data-testid="portal-publish-error" style={{ color: 'var(--gp-color-danger)' }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
