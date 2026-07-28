'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Select,
  SkeletonBlock,
  StatusBadge,
  type StatusTone,
} from '@guestportal/ui';
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

function statusTone(status: string): StatusTone {
  if (status === 'completed' || status === 'ready') return 'success';
  if (status === 'cancelled' || status === 'failed') return 'danger';
  if (status === 'submitted') return 'warning';
  if (
    status === 'accepted' ||
    status === 'confirmed' ||
    status === 'in_progress' ||
    status === 'preparing'
  ) {
    return 'info';
  }
  return 'neutral';
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
    const filename =
      disposition.match(/filename="([^"]+)"/)?.[1] ?? `guestportal-${collection}.csv`;
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
    <main className="admin-ops" data-testid="admin-operations-panel">
      <PageHeader
        title={kind === 'request' ? t('requestsTitle') : t('ordersTitle')}
        description={t('body')}
        actions={
          <>
            <Button
              data-testid="admin-ops-refresh"
              variant="secondary"
              onClick={() => void loadPage()}
            >
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
          </>
        }
      />

      <FilterBar
        aria-label={t('status')}
        activeSummary={
          exportStatus ? <span data-testid="admin-ops-export-status">{exportStatus}</span> : null
        }
      >
        <Select
          label={t('status')}
          data-testid="admin-ops-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={statusOptions}
        />
        <label className="gp-field">
          <span className="gp-field__label">{t('dateFrom')}</span>
          <input
            className="gp-input"
            data-testid="admin-ops-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="gp-field">
          <span className="gp-field__label">{t('dateTo')}</span>
          <input
            className="gp-input"
            data-testid="admin-ops-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
      </FilterBar>

      {error ? (
        <div data-testid="admin-ops-error">
          <ErrorState title={error} />
        </div>
      ) : null}
      {loading ? (
        <div data-testid="admin-ops-loading" aria-label={t('loading')}>
          <SkeletonBlock lines={5} />
        </div>
      ) : null}

      <section className="admin-ops__workspace">
        <div className="admin-ops__list">
          <table data-testid="admin-ops-list" className="admin-ops__table">
            <thead>
              <tr>
                <th>{t('columnStatus')}</th>
                <th>{t('columnTitle')}</th>
                <th>{t('columnLocation')}</th>
                <th>{t('columnLanguage')}</th>
                <th>{t('columnWaiting')}</th>
                <th>{t('columnAssignee')}</th>
                <th>{t('columnCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  data-testid="admin-ops-item"
                  className={detailId === item.id ? 'is-selected' : undefined}
                >
                  <td>
                    <StatusBadge tone={statusTone(item.status)}>
                      {item.status.replace(/_/g, ' ')}
                    </StatusBadge>
                  </td>
                  <td>
                    <button
                      data-testid="admin-ops-open"
                      type="button"
                      onClick={() => openDetail(item)}
                      className="admin-ops__row-action"
                    >
                      {item.title}
                    </button>
                    <div className="admin-ops__summary">{item.summary || t('noSummary')}</div>
                  </td>
                  <td>{item.location.code}</td>
                  <td>{item.locale.toUpperCase()}</td>
                  <td className="admin-ops__mono">{formatAge(item.waitingSeconds)}</td>
                  <td>{item.assignee?.displayName ?? t('unassigned')}</td>
                  <td>
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
            <div data-testid="admin-ops-empty">
              <EmptyState title={t('empty')} />
            </div>
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

        <aside className="admin-ops__detail" data-testid="admin-ops-detail">
          {detailLoading ? <p>{t('detailLoading')}</p> : null}
          {!detailLoading && !detail ? <p>{t('selectDetail')}</p> : null}
          {detail ? (
            <div className="admin-ops__detail-content">
              <header>
                <h3>{itemPrimary(detail).title}</h3>
                <p>
                  {itemPrimary(detail).status} - v{itemPrimary(detail).version} -{' '}
                  {detail.location.code}
                </p>
              </header>
              {detail.kind === 'order' ? (
                <section data-testid="admin-ops-order-items">
                  <strong>{t('items')}</strong>
                  <ul>
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
                  <p>{detail.request.requestType}</p>
                  <p>{detail.request.details || t('noSummary')}</p>
                </section>
              )}
              <section data-testid="admin-ops-conversation">
                <strong>{t('conversation')}</strong>
                <ol>
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
                <ol>
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
