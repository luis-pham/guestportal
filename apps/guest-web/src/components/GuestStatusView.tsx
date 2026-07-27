'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GuestOrderStatus, GuestRequestStatus, GuestWorkItem } from '@guestportal/contracts';
import {
  cancelGuestOrder,
  cancelGuestRequest,
  fetchGuestWorkItems,
} from '../lib/guest-portal';

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
