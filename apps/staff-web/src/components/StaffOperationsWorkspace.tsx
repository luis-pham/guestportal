'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, SkeletonBlock, StatusBadge, type StatusTone } from '@guestportal/ui';
import type { StaffWorkDetail, StaffWorkItem, StaffWorkQueue } from '../lib/api';
import {
  claimStaffWorkItem,
  fetchStaffRealtimeEvents,
  fetchStaffDetail,
  fetchStaffWorkItems,
  staffRealtimeStreamUrl,
} from '../lib/api';
import type { StaffRealtimeEvent } from '../lib/api';
import { appHref } from '../lib/base-path';
import './staff-ops.css';

type RouteKey =
  'inbox' | 'myWork' | 'messages' | 'history' | 'settings' | 'more' | 'request' | 'order';

const statusOptions = [
  'all',
  'submitted',
  'accepted',
  'in_progress',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
];

const labels = {
  en: {
    loading: 'Loading',
    empty: 'No work items match this queue.',
    error: 'Could not load staff workspace.',
    retry: 'Retry',
    filters: 'Filters',
    status: 'Status',
    all: 'All',
    request: 'Request',
    order: 'Order',
    open: 'Open',
    accept: 'Accept',
    waiting: 'Waiting',
    location: 'Location',
    assignee: 'Assignee',
    unassigned: 'Unassigned',
    details: 'Details',
    conversation: 'Conversation',
    timeline: 'Timeline',
    notes: 'Notes',
    items: 'Items',
    total: 'Total',
    choose: 'Select an item from the queue.',
    claiming: 'Claiming',
    claimed: 'Work item claimed.',
    claimConflict: 'Another staff member already claimed this item. The queue has been refreshed.',
    claimFailed: 'Could not claim this item.',
    liveUpdate: 'Live update received.',
  },
  vi: {
    loading: 'Đang tải',
    empty: 'Không có mục nào trong hàng đợi này.',
    error: 'Không tải được không gian nhân viên.',
    retry: 'Thử lại',
    filters: 'Bộ lọc',
    status: 'Trạng thái',
    all: 'Tất cả',
    request: 'Yêu cầu',
    order: 'Đơn hàng',
    open: 'Mở',
    accept: 'Nhận',
    waiting: 'Đang chờ',
    location: 'Vị trí',
    assignee: 'Người xử lý',
    unassigned: 'Chưa gán',
    details: 'Chi tiết',
    conversation: 'Trò chuyện',
    timeline: 'Dòng thời gian',
    notes: 'Ghi chú',
    items: 'Mặt hàng',
    total: 'Tổng',
    choose: 'Chọn một mục trong hàng đợi.',
    claiming: 'Đang nhận',
    claimed: 'Đã nhận việc.',
    claimConflict: 'Một nhân viên khác đã nhận mục này. Hàng đợi đã được làm mới.',
    claimFailed: 'Không nhận được mục này.',
    liveUpdate: 'Đã nhận cập nhật mới.',
  },
};

function queueForRoute(routeKey: RouteKey): StaffWorkQueue {
  if (routeKey === 'myWork') return 'my_work';
  if (routeKey === 'history') return 'history';
  return 'inbox';
}

function pickName(name: { vi: string; en: string }, locale: string) {
  return locale.startsWith('vi') ? name.vi || name.en : name.en || name.vi;
}

function waitingLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amountMinor / 100);
}

function statusTone(status: string): StatusTone {
  if (status === 'completed' || status === 'ready' || status === 'delivering') return 'success';
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

function itemHref(locale: string, item: StaffWorkItem) {
  return appHref(`/${locale}/${item.kind === 'request' ? 'requests' : 'orders'}/${item.id}`);
}

export function StaffOperationsWorkspace({
  locale,
  routeKey,
  detailId,
  propertyId,
}: {
  locale: string;
  routeKey: RouteKey;
  detailId?: string | undefined;
  propertyId: string;
}) {
  const localeKey = locale.startsWith('vi') ? 'vi' : 'en';
  const t = labels[localeKey];
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState<StaffWorkItem[]>([]);
  const [selected, setSelected] = useState<StaffWorkItem | null>(null);
  const [detail, setDetail] = useState<StaffWorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'conflict' | 'error' | 'info';
    text: string;
  } | null>(null);

  const queue = useMemo(() => queueForRoute(routeKey), [routeKey]);

  const loadItems = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(false);
    const result = await fetchStaffWorkItems({ propertyId, queue, status });
    if (!result.ok) {
      setError(true);
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(result.data.items);
    setSelected((current) => {
      const routeSelected = result.data.items.find((item) => item.id === detailId);
      if (routeSelected) return routeSelected;
      if (current && result.data.items.some((item) => item.id === current.id)) return current;
      return result.data.items[0] ?? null;
    });
    setLoading(false);
  }, [detailId, propertyId, queue, status]);

  async function handleClaim(item: StaffWorkItem) {
    const key = `${item.kind}-${item.id}`;
    setClaimingId(key);
    setNotice(null);
    const result = await claimStaffWorkItem(item);
    if (result.ok) {
      setNotice({ tone: 'success', text: t.claimed });
    } else if (result.status === 409) {
      setNotice({ tone: 'conflict', text: t.claimConflict });
    } else {
      setNotice({ tone: 'error', text: t.claimFailed });
    }
    await loadItems();
    setClaimingId(null);
  }

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!propertyId || typeof EventSource === 'undefined') return;
    const storageKey = `guestportal.staff.realtime.${propertyId}`;
    let lastEventId = window.localStorage.getItem(storageKey);
    let closed = false;
    let replayTimer: number | null = null;
    let replayInterval: number | null = null;
    const seen = new Set<string>();

    const rememberEvent = (event: Pick<StaffRealtimeEvent, 'id'>) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      lastEventId = event.id;
      window.localStorage.setItem(storageKey, event.id);
      return true;
    };

    const applyEvents = (events: StaffRealtimeEvent[], notify: boolean) => {
      const changed = events.some(rememberEvent);
      if (!changed || !notify) return;
      setNotice({ tone: 'info', text: t.liveUpdate });
      void loadItems();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(t.liveUpdate);
      }
    };

    const replay = async (notify: boolean) => {
      const result = await fetchStaffRealtimeEvents(propertyId, lastEventId);
      if (closed || !result.ok) return;
      applyEvents(result.data.events, notify);
    };

    void replay(lastEventId !== null);
    const source = new EventSource(staffRealtimeStreamUrl(propertyId, lastEventId), {
      withCredentials: true,
    });
    source.onmessage = (event) => {
      const id = event.lastEventId;
      if (!id) return;
      applyEvents([{ id } as StaffRealtimeEvent], true);
    };
    source.onerror = () => {
      if (replayTimer) window.clearTimeout(replayTimer);
      replayTimer = window.setTimeout(() => void replay(true), 1500);
    };
    replayInterval = window.setInterval(() => void replay(true), 1500);
    return () => {
      closed = true;
      if (replayTimer) window.clearTimeout(replayTimer);
      if (replayInterval) window.clearInterval(replayInterval);
      source.close();
    };
  }, [loadItems, propertyId, t.liveUpdate]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      setDetailLoading(true);
      const result = await fetchStaffDetail(selected);
      if (!active) return;
      setDetail(result.ok ? result.data : null);
      setDetailLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [selected]);

  if (!propertyId) {
    return (
      <section className="staff-ops__state" data-testid="staff-empty">
        {t.empty}
      </section>
    );
  }

  return (
    <section
      className={`staff-ops${routeKey === 'request' || routeKey === 'order' ? ' staff-ops--detail-route' : ''}`}
      data-testid="staff-inbox"
    >
      <div className="staff-ops__toolbar" aria-label={t.filters}>
        <Select
          label={t.status}
          data-testid="staff-filter-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={statusOptions.map((option) => ({
            value: option,
            label: option === 'all' ? t.all : option.replace(/_/g, ' '),
          }))}
        />
        <Button variant="secondary" onClick={() => void loadItems()} data-testid="staff-refresh">
          {t.retry}
        </Button>
      </div>

      {error ? (
        <div className="staff-ops__state staff-ops__state--error" data-testid="staff-error">
          {t.error}
        </div>
      ) : null}
      {notice ? (
        <div
          className={`staff-ops__notice staff-ops__notice--${notice.tone}`}
          data-testid={notice.tone === 'conflict' ? 'staff-claim-conflict' : 'staff-claim-notice'}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="staff-ops__layout">
        <div className="staff-ops__list" data-testid="staff-work-list">
          {loading ? (
            <div className="staff-ops__state" data-testid="staff-ops-loading">
              <SkeletonBlock lines={4} />
            </div>
          ) : null}
          {!loading && items.length === 0 ? (
            <div className="staff-ops__state" data-testid="staff-empty">
              {t.empty}
            </div>
          ) : null}
          {items.map((item) => (
            <article
              key={`${item.kind}-${item.id}`}
              className={`staff-card${selected?.id === item.id ? ' is-active' : ''}`}
              data-testid="staff-work-item"
            >
              <button type="button" onClick={() => setSelected(item)}>
                <div className="staff-card__meta">
                  <StatusBadge tone={statusTone(item.status)}>
                    {item.status.replace(/_/g, ' ')}
                  </StatusBadge>
                  <span>{item.kind === 'request' ? t.request : t.order}</span>
                </div>
                <strong>{item.title}</strong>
                <small>
                  {t.location}: {pickName(item.location.name, locale)}
                </small>
                <small>
                  {t.waiting}: {waitingLabel(item.waitingSeconds)}
                </small>
              </button>
              <div className="staff-card__actions">
                <Button
                  variant="secondary"
                  disabled={Boolean(item.assignee) || claimingId === `${item.kind}-${item.id}`}
                  onClick={() => void handleClaim(item)}
                  data-testid="staff-claim-item"
                >
                  {claimingId === `${item.kind}-${item.id}` ? t.claiming : t.accept}
                </Button>
                <a href={itemHref(locale, item)} data-testid="staff-open-item">
                  {t.open}
                </a>
              </div>
            </article>
          ))}
        </div>

        <StaffDetailPanel
          locale={locale}
          detail={detail}
          loading={detailLoading}
          selected={selected}
          labels={t}
        />
      </div>
    </section>
  );
}

function StaffDetailPanel({
  locale,
  detail,
  loading,
  selected,
  labels: t,
}: {
  locale: string;
  detail: StaffWorkDetail | null;
  loading: boolean;
  selected: StaffWorkItem | null;
  labels: (typeof labels)['en'];
}) {
  if (!selected) {
    return (
      <aside className="staff-detail" data-testid="staff-detail-empty">
        {t.choose}
      </aside>
    );
  }
  if (loading) {
    return (
      <aside className="staff-detail" data-testid="staff-detail-loading">
        {t.loading}
      </aside>
    );
  }
  if (!detail) {
    return (
      <aside className="staff-detail" data-testid="staff-error">
        {t.error}
      </aside>
    );
  }

  const isOrder = detail.kind === 'order';
  const title = isOrder ? detail.order.title : detail.request.title;
  const status = isOrder ? detail.order.status : detail.request.status;
  const version = isOrder ? detail.order.version : detail.request.version;
  const summary = isOrder ? detail.order.notes : detail.request.details;

  return (
    <aside className="staff-detail" data-testid="staff-detail">
      <header className="staff-detail__header">
        <span>{detail.kind === 'request' ? t.request : t.order}</span>
        <h2>{title}</h2>
        <p>
          {status.replace(/_/g, ' ')} - v{version}
        </p>
      </header>

      <section className="staff-detail__section">
        <h3>{t.details}</h3>
        <dl>
          <div>
            <dt>{t.location}</dt>
            <dd>{pickName(detail.location.name, locale)}</dd>
          </div>
          <div>
            <dt>{t.assignee}</dt>
            <dd>{detail.assignee?.displayName ?? t.unassigned}</dd>
          </div>
          {isOrder ? (
            <div>
              <dt>{t.total}</dt>
              <dd>{money(detail.order.totalMinor, detail.order.currency)}</dd>
            </div>
          ) : null}
        </dl>
        {summary ? <p>{summary}</p> : null}
      </section>

      {isOrder ? (
        <section className="staff-detail__section">
          <h3>{t.items}</h3>
          <ul className="staff-detail__items">
            {detail.order.items.map((item) => (
              <li key={item.itemId}>
                <span>{item.label}</span>
                <strong>
                  {item.quantity} × {money(item.unitPriceMinor, item.currency)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="staff-detail__section" data-testid="staff-conversation">
        <h3>{t.conversation}</h3>
        {detail.messages.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          <ol className="staff-chat">
            {detail.messages.map((message) => (
              <li key={message.id}>
                <span>{message.role}</span>
                <p>{message.translatedText ?? message.originalText}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="staff-detail__section" data-testid="staff-timeline">
        <h3>{t.timeline}</h3>
        <ol className="staff-timeline">
          {detail.timeline.map((item) => (
            <li key={item.id}>
              <strong>{item.nextStatus.replace(/_/g, ' ')}</strong>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
