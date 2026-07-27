'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Input, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

type Source = {
  id: string;
  title: string;
  status: string;
  sourceLanguage: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  errorMessage?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/html',
  'text/markdown',
];

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

export function KnowledgeSourcesPanel() {
  const t = useTranslations('knowledge');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [sources, setSources] = useState<Source[]>([]);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [processingSourceId, setProcessingSourceId] = useState<string | null>(null);

  async function refresh() {
    const list = await apiFetch<{ sources: Source[] }>(
      `/v1/properties/${propertyId}/knowledge-sources`,
    );
    if (!list.ok) {
      setError(t('loadError'));
      return;
    }
    setSources(list.data.sources);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, propertyId, router]);

  async function uploadAndCreate(file: File) {
    setBusy(true);
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError(t('uploadMimeError'));
      setBusy(false);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError(t('uploadSizeError'));
      setBusy(false);
      return;
    }
    if (!title.trim()) {
      setError(t('titleRequired'));
      setBusy(false);
      return;
    }

    const presign = await apiFetch<{
      assetId: string;
      uploadUrl: string;
      requiredHeaders: Record<string, string>;
    }>('/v1/uploads/presign', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'knowledge_source',
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        propertyId,
      }),
    });
    if (!presign.ok) {
      setError(t('uploadPresignError'));
      setBusy(false);
      return;
    }

    const put = await fetch(presign.data.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        ...presign.data.requiredHeaders,
      },
      body: file,
    });
    if (!put.ok) {
      setError(t('uploadPutError'));
      setBusy(false);
      return;
    }

    const complete = await apiFetch('/v1/uploads/complete', {
      method: 'POST',
      body: JSON.stringify({ assetId: presign.data.assetId }),
    });
    if (!complete.ok) {
      setError(t('uploadCompleteError'));
      setBusy(false);
      return;
    }

    const created = await apiFetch<{ source: Source }>(
      `/v1/properties/${propertyId}/knowledge-sources`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          type: 'file',
          sourceLanguage: language,
          assetId: (presign.data as { assetId: string }).assetId,
        }),
      },
    );
    setBusy(false);
    if (!created.ok) {
      setError(t('createError'));
      return;
    }
    setTitle('');
    await refresh();
  }

  async function processSource(sourceId: string) {
    setProcessingSourceId(sourceId);
    setError(null);
    const processed = await apiFetch(
      `/v1/properties/${propertyId}/knowledge-sources/${sourceId}/process`,
      {
        method: 'POST',
      },
    );
    setProcessingSourceId(null);
    if (!processed.ok) {
      setError(t('processError'));
      return;
    }
    await refresh();
  }

  return (
    <main className="gp-state" data-testid="knowledge-sources-panel">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>

      <div className="gp-stack" style={{ gap: '1rem', maxWidth: 640 }}>
        <Input
          label={t('sourceTitle')}
          data-testid="knowledge-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Select
          label={t('language')}
          data-testid="knowledge-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'vi', label: 'Tiếng Việt' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        <label>
          <span>{t('file')}</span>
          <input
            data-testid="knowledge-file"
            type="file"
            accept=".pdf,.docx,.txt,.html,.md,text/plain,application/pdf"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void uploadAndCreate(file);
            }}
          />
        </label>
        {error ? (
          <p data-testid="knowledge-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          data-testid="knowledge-refresh"
          variant="secondary"
          onClick={() => void refresh()}
          disabled={busy}
        >
          {t('refresh')}
        </Button>
      </div>

      <ul data-testid="knowledge-source-list" style={{ marginTop: '2rem', listStyle: 'none', padding: 0 }}>
        {sources.map((source) => (
          <li
            key={source.id}
            data-testid={`knowledge-source-${source.id}`}
            style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem 0', borderBottom: '1px solid #ddd' }}
          >
            <div>
              <strong>{source.title}</strong> — <span data-testid={`knowledge-source-status-${source.id}`}>{source.status}</span>
              {source.originalFilename ? ` · ${source.originalFilename}` : ''}
              {source.errorMessage ? ` · ${source.errorMessage}` : ''}
            </div>
            {source.status === 'uploaded' || source.status === 'failed' ? (
              <div>
                <Button
                  data-testid={`knowledge-process-${source.id}`}
                  variant="secondary"
                  loading={processingSourceId === source.id}
                  onClick={() => void processSource(source.id)}
                >
                  {t('process')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {/* keep API_URL referenced for future signed GET downloads */}
      <span hidden>{API_URL}</span>
    </main>
  );
}
