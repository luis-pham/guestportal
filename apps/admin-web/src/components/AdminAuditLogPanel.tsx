'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Select } from '@guestportal/ui';
import type { AdminAuditLogEntry, AdminAuditLogListResponse } from '@guestportal/contracts';
import { apiFetch } from '../lib/api';

type PropertyOption = { id: string; name: string; slug: string };

const RESOURCE_TYPES = [
  'all',
  'organization',
  'property',
  'portal',
  'knowledge_source',
  'request',
  'order',
  'team_member',
  'asset',
  'system',
] as const;

export function AdminAuditLogPanel({
  organizationId,
  properties,
}: {
  organizationId: string;
  properties: PropertyOption[];
}) {
  const t = useTranslations('auditLog');
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [propertyId, setPropertyId] = useState('all');
  const [resourceType, setResourceType] = useState('all');
  const [action, setAction] = useState('');
  const [query, setQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propertyOptions = useMemo(
    () => [
      { value: 'all', label: t('allProperties') },
      ...properties.map((property) => ({ value: property.id, label: property.name })),
    ],
    [properties, t],
  );

  const loadLogs = useCallback(
    async (cursor?: string) => {
      if (!organizationId) return;
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setEntries([]);
      }
      setError(null);
      const params = new URLSearchParams({ limit: '30' });
      if (propertyId !== 'all') params.set('propertyId', propertyId);
      if (resourceType !== 'all') params.set('resourceType', resourceType);
      if (action.trim()) params.set('action', action.trim());
      if (query.trim()) params.set('q', query.trim());
      if (cursor) params.set('cursor', cursor);
      const result = await apiFetch<AdminAuditLogListResponse>(
        `/v1/admin/organizations/${organizationId}/audit-logs?${params}`,
      );
      setLoading(false);
      setLoadingMore(false);
      if (!result.ok) {
        setError(result.status === 403 ? t('permissionError') : t('loadError'));
        setNextCursor(null);
        return;
      }
      setEntries((current) =>
        cursor ? [...current, ...result.data.entries] : result.data.entries,
      );
      setNextCursor(result.data.nextCursor);
    },
    [action, organizationId, propertyId, query, resourceType, t],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <main className="gp-state admin-audit" data-testid="admin-audit-panel">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        <div>
          <h2 className="gp-state__title">{t('title')}</h2>
          <p className="gp-state__body">{t('body')}</p>
        </div>
        <Button data-testid="audit-refresh" variant="secondary" onClick={() => void loadLogs()}>
          {t('refresh')}
        </Button>
      </div>

      <div
        className="admin-audit__filters"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginTop: '1.5rem',
          maxWidth: 920,
        }}
      >
        <Select
          label={t('property')}
          data-testid="audit-property-filter"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          options={propertyOptions}
        />
        <Select
          label={t('resourceType')}
          data-testid="audit-resource-filter"
          value={resourceType}
          onChange={(event) => setResourceType(event.target.value)}
          options={RESOURCE_TYPES.map((type) => ({
            value: type,
            label: type === 'all' ? t('allResources') : type,
          }))}
        />
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          {t('action')}
          <input
            data-testid="audit-action-filter"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder={t('actionPlaceholder')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 42,
              border: '1px solid var(--gp-border, #d7dde8)',
              borderRadius: 6,
              padding: '0 0.75rem',
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          {t('search')}
          <input
            data-testid="audit-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 42,
              border: '1px solid var(--gp-border, #d7dde8)',
              borderRadius: 6,
              padding: '0 0.75rem',
            }}
          />
        </label>
      </div>

      {error ? (
        <p data-testid="audit-error" role="alert" style={{ marginTop: '1rem', color: '#b42318' }}>
          {error}
        </p>
      ) : null}
      {loading ? (
        <p data-testid="audit-loading" aria-live="polite" style={{ marginTop: '1.25rem' }}>
          {t('loading')}
        </p>
      ) : null}
      {!loading && entries.length === 0 && !error ? (
        <p data-testid="audit-empty" style={{ marginTop: '1.25rem' }}>
          {t('empty')}
        </p>
      ) : null}

      <div
        className="admin-audit__tableWrap"
        role="region"
        aria-label={t('tableRegion')}
        tabIndex={0}
        style={{ marginTop: '1.5rem', overflowX: 'auto' }}
      >
        <table
          data-testid="audit-log-table"
          className="admin-audit__table"
          style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}
        >
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--gp-muted, #586174)' }}>
              <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                {t('createdAt')}
              </th>
              <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                {t('actor')}
              </th>
              <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                {t('actionColumn')}
              </th>
              <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                {t('resource')}
              </th>
              <th style={{ padding: '0.65rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                {t('metadata')}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} data-testid="audit-log-row">
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                  {entry.actorDisplayName ?? t('systemActor')}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                  <strong>{entry.action}</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {entry.resourceType}
                  {entry.resourceId ? <div>{entry.resourceId}</div> : null}
                </td>
                <td style={{ padding: '0.75rem', borderBottom: '1px solid var(--gp-border, #d7dde8)' }}>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      font: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor ? (
        <Button
          data-testid="audit-load-more"
          variant="secondary"
          loading={loadingMore}
          onClick={() => void loadLogs(nextCursor)}
          style={{ marginTop: '1rem' }}
        >
          {t('loadMore')}
        </Button>
      ) : null}
    </main>
  );
}
