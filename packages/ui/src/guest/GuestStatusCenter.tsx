'use client';

export type GuestStatusCenterProps = {
  locale?: string;
  loading?: boolean;
  offline?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Real items only — never invent placeholder tickets. */
  items?: Array<{
    id: string;
    kind: 'request' | 'order';
    title: string;
    status: string;
  }>;
};

export function GuestStatusCenter({
  locale = 'en',
  loading = false,
  offline = false,
  error = null,
  onRetry,
  items = [],
}: GuestStatusCenterProps) {
  const vi = locale.startsWith('vi');
  const title = vi ? 'Trạng thái của bạn' : 'Your status';

  if (loading) {
    return (
      <section className="gp-guest-status" data-testid="guest-status-loading" aria-busy="true">
        <h1>{title}</h1>
        <div className="gp-guest-status__skeleton" />
        <div className="gp-guest-status__skeleton" />
      </section>
    );
  }

  if (offline) {
    return (
      <section className="gp-guest-status" data-testid="guest-status-offline">
        <h1>{title}</h1>
        <p>{vi ? 'Bạn đang ngoại tuyến.' : 'You are offline.'}</p>
        {onRetry ? (
          <button type="button" data-testid="guest-status-retry" onClick={onRetry}>
            {vi ? 'Thử lại' : 'Retry'}
          </button>
        ) : null}
      </section>
    );
  }

  if (error) {
    return (
      <section className="gp-guest-status" data-testid="guest-status-error" role="alert">
        <h1>{title}</h1>
        <p>{error}</p>
        {onRetry ? (
          <button type="button" data-testid="guest-status-retry" onClick={onRetry}>
            {vi ? 'Thử lại' : 'Retry'}
          </button>
        ) : null}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="gp-guest-status" data-testid="guest-status-empty">
        <h1>{title}</h1>
        <p>
          {vi
            ? 'Chưa có yêu cầu hoặc đơn hàng đang mở.'
            : 'No open requests or orders yet.'}
        </p>
      </section>
    );
  }

  return (
    <section className="gp-guest-status" data-testid="guest-status-list">
      <h1>{title}</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id} data-testid={`guest-status-item-${item.id}`}>
            <strong>{item.title}</strong>
            <span>
              {item.kind}: {item.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
