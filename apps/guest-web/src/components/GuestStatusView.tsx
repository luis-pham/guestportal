'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GuestOrderStatus, GuestRequestStatus, GuestWorkItem } from '@guestportal/contracts';
import {
  cancelGuestOrder,
  cancelGuestRequest,
  fetchGuestRealtimeEvents,
  fetchGuestWorkItems,
  guestRealtimeStreamUrl,
} from '../lib/guest-portal';
import type { GuestRealtimeEvent } from '../lib/guest-portal';

const labels = {
  vi: {
    title: 'Trạng thái',
    empty: 'Chưa có yêu cầu hoặc đơn nào.',
    loading: 'Đang tải',
    retry: 'Thử lại',
    cancel: 'Hủy',
    request: 'Yêu cầu',
    order: 'Đơn',
    total: 'Tổng',
    error: 'Không tải được trạng thái.',
    liveUpdate: 'Trạng thái vừa được cập nhật.',
    cancelling: 'Đang hủy',
    submitted: 'Đã gửi',
    accepted: 'Đã nhận',
    rejected: 'Từ chối',
    cancelled: 'Đã hủy',
    in_progress: 'Đang xử lý',
    completed: 'Hoàn tất',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị',
    ready: 'Sẵn sàng',
    delivering: 'Đang giao',
  },
  en: {
    title: 'Status',
    empty: 'No requests or orders yet.',
    loading: 'Loading',
    retry: 'Retry',
    cancel: 'Cancel',
    request: 'Request',
    order: 'Order',
    total: 'Total',
    error: 'Could not load status.',
    liveUpdate: 'Status updated.',
    cancelling: 'Cancelling',
    submitted: 'Submitted',
    accepted: 'Accepted',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    in_progress: 'In progress',
    completed: 'Completed',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    delivering: 'Delivering',
  },
};

const cancellableRequestStatuses = new Set<GuestRequestStatus>([
  'submitted',
  'accepted',
  'in_progress',
]);
const cancellableOrderStatuses = new Set<GuestOrderStatus>([
  'submitted',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
]);
const requestStatuses = new Set<GuestRequestStatus>([
  'submitted',
  'accepted',
  'rejected',
  'cancelled',
  'in_progress',
  'completed',
]);
const orderStatuses = new Set<GuestOrderStatus>([
  'submitted',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'cancelled',
  'completed',
]);

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amountMinor / 100);
}

function canCancel(item: GuestWorkItem) {
  return item.kind === 'request'
    ? cancellableRequestStatuses.has(item.status)
    : cancellableOrderStatuses.has(item.status);
}

function statusTime(item: GuestWorkItem) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.submittedAt));
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function GuestStatusView({ locale }: { locale: string }) {
  const localeKey = locale.startsWith('vi') ? 'vi' : 'en';
  const t = labels[localeKey];
  const [items, setItems] = useState<GuestWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setItems(await fetchGuestWorkItems());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const storageKey = 'guestportal.guest.realtime';
    let lastEventId = window.localStorage.getItem(storageKey);
    let closed = false;
    let replayTimer: number | null = null;
    let replayInterval: number | null = null;
    const seen = new Set<string>();

    const rememberEvent = (event: Pick<GuestRealtimeEvent, 'id'>) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      lastEventId = event.id;
      window.localStorage.setItem(storageKey, event.id);
      return true;
    };

    const applyEvents = (events: GuestRealtimeEvent[], notify: boolean) => {
      const changed = events.some(rememberEvent);
      if (!changed || !notify) return;
      setItems((currentItems) =>
        currentItems.map((item) => {
          const statusEvent = events.find(
            (event) =>
              event.aggregateId === item.id &&
              event.type === `${item.kind}.status_changed.v1` &&
              typeof event.payload.nextStatus === 'string',
          );
          const nextStatus = statusEvent?.payload.nextStatus;
          if (item.kind === 'request' && requestStatuses.has(nextStatus as GuestRequestStatus)) {
            return { ...item, status: nextStatus as GuestRequestStatus };
          }
          if (item.kind === 'order' && orderStatuses.has(nextStatus as GuestOrderStatus)) {
            return { ...item, status: nextStatus as GuestOrderStatus };
          }
          return item;
        }),
      );
      setLiveNotice(true);
      void load();
    };

    const replay = async (notify: boolean) => {
      try {
        const result = await fetchGuestRealtimeEvents(lastEventId);
        if (!closed) applyEvents(result.events, notify);
      } catch {
        // Status polling continues through the normal Retry path.
      }
    };

    void replay(lastEventId !== null);
    const source = new EventSource(guestRealtimeStreamUrl(lastEventId), { withCredentials: true });
    source.onmessage = (event) => {
      const id = event.lastEventId;
      if (!id) return;
      applyEvents([{ id } as GuestRealtimeEvent], true);
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
  }, [load]);

  async function cancel(item: GuestWorkItem) {
    setCancellingId(item.id);
    setError(false);
    try {
      if (item.kind === 'request') {
        await cancelGuestRequest({
          requestId: item.id,
          idempotencyKey: idempotencyKey(`guest-request-cancel-${item.id}`),
        });
      } else {
        await cancelGuestOrder({
          orderId: item.id,
          idempotencyKey: idempotencyKey(`guest-order-cancel-${item.id}`),
        });
      }
      await load();
    } catch {
      setError(true);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="gp-status" data-testid="guest-status">
      <header className="gp-status__header">
        <h1>{t.title}</h1>
        <button type="button" data-testid="guest-status-refresh" onClick={() => void load()}>
          {t.retry}
        </button>
      </header>

      {loading ? <p data-testid="guest-status-loading">{t.loading}</p> : null}
      {error ? (
        <p className="gp-services__error" data-testid="guest-status-error" role="alert">
          {t.error}
        </p>
      ) : null}
      {liveNotice ? (
        <p className="gp-services__notice" data-testid="guest-status-live" role="status">
          {t.liveUpdate}
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="gp-services__empty" data-testid="guest-status-empty">{t.empty}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="gp-status__list" data-testid="guest-status-list">
          {items.map((item) => (
            <li className="gp-status-item" key={`${item.kind}-${item.id}`} data-testid="guest-status-item">
              <div className="gp-status-item__main">
                <span>{item.kind === 'request' ? t.request : t.order}</span>
                <h2>{item.title}</h2>
                <p>{statusTime(item)}</p>
              </div>
              <div className="gp-status-item__meta">
                <strong>{t[item.status]}</strong>
                {item.kind === 'order' ? (
                  <span>
                    {t.total}: {money(item.totalMinor, item.currency)}
                  </span>
                ) : null}
                {canCancel(item) ? (
                  <button
                    type="button"
                    data-testid={`guest-status-cancel-${item.id}`}
                    onClick={() => void cancel(item)}
                    disabled={cancellingId !== null}
                  >
                    {cancellingId === item.id ? t.cancelling : t.cancel}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
