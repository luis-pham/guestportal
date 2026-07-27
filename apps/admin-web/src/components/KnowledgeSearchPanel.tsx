'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Input, Select } from '@guestportal/ui';
import { apiFetch } from '../lib/api';

type Hit = {
  chunkId: string;
  sourceId: string;
  content: string;
  headingPath: string[];
  sourceLanguage: string;
  score: number;
  channels: string[];
};

type Citation = {
  sourceId: string;
  chunkId: string;
  title: string;
  headingPath: string[];
  excerpt: string;
  score: number;
};

type SearchResponse = {
  query: string;
  sanitizedQuery: string;
  blocked: boolean;
  hits: Hit[];
  citations: Citation[];
  noResult: boolean;
};

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

export function KnowledgeSearchPanel() {
  const t = useTranslations('knowledgeSearch');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const [query, setQuery] = useState('');
  const [queryLocale, setQueryLocale] = useState<'auto' | 'vi' | 'en' | 'ko' | 'ja' | 'zh' | 'fr'>('auto');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const me = await apiFetch('/v1/me');
      if (!me.ok) router.replace(`/${locale}/login`);
    })();
  }, [locale, router]);

  async function runSearch() {
    setBusy(true);
    setError(null);
    const response = await apiFetch<SearchResponse>(
      `/v1/properties/${propertyId}/knowledge/search`,
      {
        method: 'POST',
        body: JSON.stringify({ query, locale: queryLocale, limit: 8 }),
      },
    );
    setBusy(false);
    if (!response.ok) {
      setError(t('searchError'));
      setResult(null);
      return;
    }
    setResult(response.data);
  }

  return (
    <main className="gp-state" data-testid="knowledge-search-panel">
      <h2 className="gp-state__title">{t('title')}</h2>
      <p className="gp-state__body">{t('body')}</p>

      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 720 }}>
        <Input
          label={t('query')}
          data-testid="knowledge-search-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          label={t('locale')}
          data-testid="knowledge-search-locale"
          value={queryLocale}
          onChange={(event) =>
            setQueryLocale(event.target.value as 'auto' | 'vi' | 'en' | 'ko' | 'ja' | 'zh' | 'fr')
          }
          options={[
            { value: 'auto', label: t('localeAuto') },
            { value: 'vi', label: t('localeVi') },
            { value: 'en', label: t('localeEn') },
            { value: 'ko', label: t('localeKo') },
            { value: 'ja', label: t('localeJa') },
            { value: 'zh', label: t('localeZh') },
            { value: 'fr', label: t('localeFr') },
          ]}
        />
        <Button
          data-testid="knowledge-search-submit"
          disabled={busy || !query.trim()}
          loading={busy}
          onClick={() => void runSearch()}
        >
          {busy ? t('searching') : t('search')}
        </Button>
        {error ? (
          <p data-testid="knowledge-search-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {result ? (
        <section style={{ marginTop: '2rem' }} data-testid="knowledge-search-results">
          <p data-testid="knowledge-search-status" aria-live="polite">
            {result.blocked
              ? t('blocked')
              : result.noResult
                ? t('noResult')
                : t('resultCount', { count: result.hits.length })}
          </p>
          {result.sanitizedQuery !== result.query ? (
            <p data-testid="knowledge-search-sanitized">
              {t('sanitized')}: {result.sanitizedQuery}
            </p>
          ) : null}
          <ul data-testid="knowledge-search-hit-list" style={{ listStyle: 'none', padding: 0 }}>
            {result.hits.map((hit) => {
              const citation = result.citations.find((c) => c.chunkId === hit.chunkId);
              return (
                <li
                  key={hit.chunkId}
                  data-testid={`knowledge-search-hit-${hit.chunkId}`}
                  style={{
                    borderTop: '1px solid color-mix(in oklab, CanvasText 12%, transparent)',
                    padding: '1rem 0',
                  }}
                >
                  <strong data-testid="knowledge-search-source">{citation?.title ?? hit.sourceId}</strong>
                  {hit.headingPath.length ? (
                    <div data-testid="knowledge-search-heading">
                      {t('heading')}: {hit.headingPath.join(' / ')}
                    </div>
                  ) : null}
                  <div data-testid="knowledge-search-score">
                    {t('score')}: {hit.score.toFixed(4)} · {t('channels')}: {hit.channels.join(', ')}
                  </div>
                  <div data-testid="knowledge-search-language">
                    {t('sourceLanguage')}: {hit.sourceLanguage}
                  </div>
                  <p data-testid="knowledge-search-excerpt">{citation?.excerpt ?? hit.content}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
