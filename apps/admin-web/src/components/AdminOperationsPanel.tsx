'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Select } from '@guestportal/ui';
import type {
  AdminOperationListResponse,
  AdminOrderDetailResponse,
  AdminRequestDetailResponse,
  StaffOrderDetail,
  StaffRequestDetail,
  StaffWorkItemSummary,
} from '@guestportal/contracts';
import { apiFetch, apiUrl } from '../lib/api';

type OperationKind = 'request' | 'order';
type OperationDetail = StaffRequestDetail | StaffOrderDetail;

type Props = {
  kind: OperationKind;
};

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

function detailIdFromPath(pathname: string, kind: OperationKind) {
  const collection = kind === 'request' ? 'requests' : 'orders';
  return pathname.match(new RegExp(`/operations/${collection}/([^/?#]+)`))?.[1] ?? '';
}

function toApiDate(value: string, endOfDay = false) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`).toISOString();
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function itemPrimary(detail: OperationDetail) {
  return detail.kind === 'request' ? detail.request : detail.order;
}

export function AdminOperationsPanel({ kind }: Props) {
  const t = useTranslations('operations');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const propertyId = propertyIdFromPath(pathname);
  const detailId = detailIdFromPath(pathname, kind);
  const collection = kind === 'request' ? 'requests' : 'orders';
  const basePath = `/${locale}/properties/${propertyId}/operations/${collection}`;
  const [items, setItems] = useState<StaffWorkItemSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [detail, setDetail] = useState<OperationDetail | null>(null);

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('statusAll') },
      { value: 'submitted', label: t('statusSubmitted') },
      {
        value: kind === 'request' ? 'accepted' : 'confirmed',
        label: kind === 'request' ? t('statusAccepted') : t('statusConfirmed'),
      },
      {
        value: kind === 'request' ? 'in_progress' : 'preparing',
        label: kind === 'request' ? t('statusInProgress') : t('statusPreparing'),
      },
      { value: kind === 'request' ? 'completed' : 'completed', label: t('statusCompleted') },
      { value: 'cancelled', label: t('statusCancelled') },
    ],
    [kind, t],
  );

  const loadPage = useCallback(
    async (cursor?: string) => {
      if (!propertyId) return;
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setItems([]);
      }
      setError(null);
      const params = new URLSearchParams({ limit: '20', status });
      const from = toApiDate(dateFrom);
      const to = toApiDate(dateTo, true);
      if (from) params.set('dateFrom', from);
      if (to) params.set('dateTo', to);
      if (cursor) params.set('cursor', cursor);
      const result = await apiFetch<AdminOperationListResponse>(
        `/v1/admin/properties/${propertyId}/operations/${collection}?${params.toString()}`,
      );
      setLoading(false);
      setLoadingMore(false);
      if (!result.ok) {
        setError(result.status === 403 ? t('permissionError') : t('loadError'));
        setNextCursor(null);
        return;
      }
      setItems((current) => (cursor ? [...current, ...result.data.items] : result.data.items));
      setNextCursor(result.data.nextCursor);
    },
    [collection, dateFrom, dateTo, propertyId, status, t],
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!propertyId || !detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setError(null);
    void (async () => {
      const result = await apiFetch<AdminRequestDetailResponse | AdminOrderDetailResponse>(
        `/v1/admin/properties/${propertyId}/operations/${collection}/${detailId}`,
      );
      if (cancelled) return;
      setDetailLoading(false);
      if (!result.ok) {
        setDetail(null);
        setError(result.status === 403 ? t('permissionError') : t('detailError'));
        return;
      }
      setDetail(result.data.detail);
    })();
    return () => {
      cancelled = true;
    };
  }, [collection, detailId, propertyId, t]);

  const openDetail = (item: StaffWorkItemSummary) => {
    router.push(`${basePath}/${item.id}`);
  };

  async function exportCsv() {
    if (!propertyId) return;
    setExporting(true);
    setError(null);
    setExportStatus(null);
    const params = new URLSearchParams({ status, limit: '1000' });
    const from = toApiDate(dateFrom);
    const to = toApiDate(dateTo, true);
    if (from) params.set('dateFrom', from);
    if (to) params.set('dateTo', to);
    const response = await fetch(
      apiUrl(`/v1/admin/properties/${propertyId}/operations/${collection}/export?${params}`),
      { credentials: 'include' },
    );
    setExporting(false);
    if (!response.ok) {
      setError(response.status === 403 ? t('exportPermissionError') : t('exportError'));
      return;
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `guestportal-${collection}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    const rowCount = response.headers.get('x-export-row-count') ?? '0';
    const truncated = response.headers.get('x-export-truncated') === 'true';
    setExportStatus(t(truncated ? 'exportedTruncated' : 'exported', { count: rowCount }));
  }

  return (
    <main className="gp-state admin-ops" data-testid="admin-operations-panel">
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
          <h2 className="gp-state__title">
            {kind === 'request' ? t('requestsTitle') : t('ordersTitle')}
          </h2>
          <p className="gp-state__body">{t('body')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button data-testid="admin-ops-refresh" variant="secondary" onClick={() => void loadPage()}>
            {t('refresh')}
          </Button>
          <Button
            data-testid="admin-ops-export"
            variant="secondary"
            loading={exporting}
            onClick={() => void exportCsv()}
          >
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      <div
        className="admin-ops__filters"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginTop: '1.5rem',
          maxWidth: 760,
        }}
      >
        <Select
          label={t('status')}
          data-testid="admin-ops-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={statusOptions}
        />
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          {t('dateFrom')}
          <input
            data-testid="admin-ops-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
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
          {t('dateTo')}
          <input
            data-testid="admin-ops-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
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
        <p
          data-testid="admin-ops-error"
          role="alert"
          style={{ marginTop: '1rem', color: '#b42318' }}
        >
          {error}
        </p>
      ) : null}
      {exportStatus ? (
        <p data-testid="admin-ops-export-status" style={{ marginTop: '1rem' }}>
          {exportStatus}
        </p>
      ) : null}
      {loading ? (
        <p data-testid="admin-ops-loading" aria-live="polite" style={{ marginTop: '1.25rem' }}>
          {t('loading')}
        </p>
      ) : null}

      <section
        className="admin-ops__workspace"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
          marginTop: '1.5rem',
        }}
      >
        <div className="admin-ops__list" style={{ minWidth: 0, overflowX: 'auto' }}>
          <table
            data-testid="admin-ops-list"
            style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}
          >
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--gp-muted, #586174)' }}>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnStatus')}
                </th>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnTitle')}
                </th>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnLocation')}
                </th>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnLanguage')}
                </th>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnWaiting')}
                </th>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnAssignee')}
                </th>
                <th
                  style={{
                    padding: '0.65rem',
                    borderBottom: '1px solid var(--gp-border, #d7dde8)',
                  }}
                >
                  {t('columnCreated')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  data-testid="admin-ops-item"
                  style={{ borderBottom: '1px solid var(--gp-border, #d7dde8)' }}
                >
                  <td style={{ padding: '0.75rem' }}>{item.status}</td>
                  <td style={{ padding: '0.75rem', maxWidth: 260 }}>
                    <button
                      data-testid="admin-ops-open"
                      type="button"
                      onClick={() => openDetail(item)}
                      style={{
                        border: 0,
                        padding: 0,
                        color: 'var(--gp-link, #2457d6)',
                        background: 'transparent',
                        font: 'inherit',
                        fontWeight: 700,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {item.title}
                    </button>
                    <div style={{ color: 'var(--gp-muted, #586174)', marginTop: 4 }}>
                      {item.summary || t('noSummary')}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{item.location.code}</td>
                  <td style={{ padding: '0.75rem' }}>{item.locale.toUpperCase()}</td>
                  <td style={{ padding: '0.75rem' }}>{formatAge(item.waitingSeconds)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {item.assignee?.displayName ?? t('unassigned')}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(item.submittedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 ? (
            <p data-testid="admin-ops-empty" style={{ padding: '1rem 0' }}>
              {t('empty')}
            </p>
          ) : null}
          {nextCursor ? (
            <Button
              data-testid="admin-ops-load-more"
              variant="secondary"
              loading={loadingMore}
              disabled={loadingMore}
              onClick={() => void loadPage(nextCursor)}
            >
              {loadingMore ? t('loading') : t('loadMore')}
            </Button>
          ) : null}
        </div>

        <aside
          className="admin-ops__detail"
          data-testid="admin-ops-detail"
          style={{
            borderLeft: '1px solid var(--gp-border, #d7dde8)',
            paddingLeft: '1rem',
            minWidth: 0,
          }}
        >
          {detailLoading ? <p>{t('detailLoading')}</p> : null}
          {!detailLoading && !detail ? <p>{t('selectDetail')}</p> : null}
          {detail ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <header>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{itemPrimary(detail).title}</h3>
                <p style={{ margin: '0.4rem 0 0', color: 'var(--gp-muted, #586174)' }}>
                  {itemPrimary(detail).status} · v{itemPrimary(detail).version} ·{' '}
                  {detail.location.code}
                </p>
              </header>
              {detail.kind === 'order' ? (
                <section data-testid="admin-ops-order-items">
                  <strong>{t('items')}</strong>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
                    {detail.order.items.map((item) => (
                      <li key={item.itemId}>
                        {item.label} x {item.quantity}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <section>
                  <strong>{t('requestType')}</strong>
                  <p style={{ marginTop: '0.35rem' }}>{detail.request.requestType}</p>
                  <p>{detail.request.details || t('noSummary')}</p>
                </section>
              )}
              <section data-testid="admin-ops-conversation">
                <strong>{t('conversation')}</strong>
                <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
                  {detail.messages.map((message) => (
                    <li key={message.id}>
                      <span>{message.role}: </span>
                      <span>{message.originalText}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section data-testid="admin-ops-timeline">
                <strong>{t('timeline')}</strong>
                <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1rem' }}>
                  {detail.timeline.map((event) => (
                    <li key={event.id}>
                      {event.previousStatus ? `${event.previousStatus} -> ` : ''}
                      {event.nextStatus}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
