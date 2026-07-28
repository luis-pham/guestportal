'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Button } from '@guestportal/ui';
import type { AdminAnalyticsDashboardResponse } from '@guestportal/contracts';
import { apiFetch } from '../lib/api';

type Dashboard = AdminAnalyticsDashboardResponse['dashboard'];

function propertyIdFromPath(pathname: string) {
  return pathname.match(/\/properties\/([^/]+)\//)?.[1] ?? '';
}

function localDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toApiDate(value: string, endOfDay = false) {
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`).toISOString();
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return 'n/a';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        height: 8,
        width: '100%',
        background: '#e6edf7',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'block',
          width: `${width}%`,
          height: '100%',
          background: '#276ef1',
        }}
      />
    </span>
  );
}

export function AdminAnalyticsDashboard() {
  const t = useTranslations('analyticsDashboard');
  const locale = useLocale();
  const pathname = usePathname();
  const propertyId = propertyIdFromPath(pathname);
  const now = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(() =>
    localDateInput(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)),
  );
  const [dateTo, setDateTo] = useState(() => localDateInput(now));
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const maxDaily = useMemo(
    () =>
      Math.max(
        0,
        ...(dashboard?.daily.map((bucket) => bucket.guestSessions + bucket.requests + bucket.orders) ??
          []),
      ),
    [dashboard],
  );

  const loadDashboard = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      dateFrom: toApiDate(dateFrom),
      dateTo: toApiDate(dateTo, true),
    });
    const result = await apiFetch<AdminAnalyticsDashboardResponse>(
      `/v1/admin/properties/${propertyId}/analytics?${params.toString()}`,
    );
    setLoading(false);
    if (!result.ok) {
      setDashboard(null);
      setError(result.status === 403 ? t('permissionError') : t('loadError'));
      return;
    }
    setDashboard(result.data.dashboard);
  }, [dateFrom, dateTo, propertyId, t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = dashboard?.summary;
  const cards = summary
    ? [
        { label: t('guestSessions'), value: numberFormatter.format(summary.guestSessions) },
        { label: t('qrScans'), value: numberFormatter.format(summary.qrScanTotal) },
        { label: t('requests'), value: numberFormatter.format(summary.requests) },
        { label: t('orders'), value: numberFormatter.format(summary.orders) },
        { label: t('revenue'), value: currencyFormatter.format(summary.revenueMinor / 100) },
        { label: t('medianResponse'), value: formatDuration(summary.medianRequestResponseSeconds) },
      ]
    : [];

  return (
    <main className="gp-state admin-analytics" data-testid="admin-analytics-dashboard">
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
        <Button
          data-testid="analytics-refresh"
          variant="secondary"
          onClick={() => void loadDashboard()}
        >
          {t('refresh')}
        </Button>
      </div>

      <div
        className="admin-analytics__filters"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginTop: '1.5rem',
          maxWidth: 560,
        }}
      >
        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700 }}>
          {t('dateFrom')}
          <input
            data-testid="analytics-date-from"
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
            data-testid="analytics-date-to"
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
        <p data-testid="analytics-error" role="alert" style={{ marginTop: '1rem', color: '#b42318' }}>
          {error}
        </p>
      ) : null}
      {loading ? (
        <p data-testid="analytics-loading" aria-live="polite" style={{ marginTop: '1.25rem' }}>
          {t('loading')}
        </p>
      ) : null}

      {dashboard && summary ? (
        <>
          <section
            data-testid="analytics-summary"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
              marginTop: '1.5rem',
            }}
          >
            {cards.map((card) => (
              <article
                key={card.label}
                style={{
                  border: '1px solid var(--gp-border, #d7dde8)',
                  borderRadius: 8,
                  padding: '1rem',
                  minWidth: 0,
                  background: '#fff',
                }}
              >
                <div style={{ color: 'var(--gp-muted, #586174)', fontSize: 13, fontWeight: 700 }}>
                  {card.label}
                </div>
                <div
                  style={{
                    marginTop: '0.35rem',
                    fontSize: 26,
                    lineHeight: 1.15,
                    fontWeight: 800,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {card.value}
                </div>
              </article>
            ))}
          </section>

          <section
            className="admin-analytics__grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: '1.25rem',
              marginTop: '1.5rem',
              alignItems: 'start',
            }}
          >
            <div style={{ minWidth: 0, overflowX: 'auto' }}>
              <h3 style={{ marginTop: 0 }}>{t('dailyTitle')}</h3>
              <table
                data-testid="analytics-daily"
                style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}
              >
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--gp-muted, #586174)' }}>
                    <th style={{ padding: '0.65rem' }}>{t('date')}</th>
                    <th style={{ padding: '0.65rem' }}>{t('guestSessions')}</th>
                    <th style={{ padding: '0.65rem' }}>{t('requests')}</th>
                    <th style={{ padding: '0.65rem' }}>{t('orders')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.daily.map((bucket) => (
                    <tr key={bucket.date} style={{ borderTop: '1px solid var(--gp-border, #d7dde8)' }}>
                      <td style={{ padding: '0.65rem', whiteSpace: 'nowrap' }}>{bucket.date}</td>
                      <td style={{ padding: '0.65rem' }}>
                        <span>{numberFormatter.format(bucket.guestSessions)}</span>
                        <Bar value={bucket.guestSessions} max={maxDaily} />
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        <span>{numberFormatter.format(bucket.requests)}</span>
                        <Bar value={bucket.requests} max={maxDaily} />
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        <span>{numberFormatter.format(bucket.orders)}</span>
                        <Bar value={bucket.orders} max={maxDaily} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ minWidth: 0 }}>
              <h3 style={{ marginTop: 0 }}>{t('statusTitle')}</h3>
              <div data-testid="analytics-status" style={{ display: 'grid', gap: '1rem' }}>
                <StatusList title={t('requestStatus')} rows={dashboard.requestsByStatus} />
                <StatusList title={t('orderStatus')} rows={dashboard.ordersByStatus} />
              </div>
            </div>

            <div style={{ minWidth: 0, overflowX: 'auto' }}>
              <h3 style={{ marginTop: 0 }}>{t('topServicesTitle')}</h3>
              {dashboard.topServices.length === 0 ? (
                <p data-testid="analytics-empty-services">{t('emptyServices')}</p>
              ) : (
                <table
                  data-testid="analytics-top-services"
                  style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}
                >
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--gp-muted, #586174)' }}>
                      <th style={{ padding: '0.65rem' }}>{t('service')}</th>
                      <th style={{ padding: '0.65rem' }}>{t('quantity')}</th>
                      <th style={{ padding: '0.65rem' }}>{t('revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topServices.map((service) => (
                      <tr
                        key={service.label}
                        style={{ borderTop: '1px solid var(--gp-border, #d7dde8)' }}
                      >
                        <td style={{ padding: '0.65rem', overflowWrap: 'anywhere' }}>
                          {service.label}
                        </td>
                        <td style={{ padding: '0.65rem' }}>
                          {numberFormatter.format(service.quantity)}
                        </td>
                        <td style={{ padding: '0.65rem' }}>
                          {currencyFormatter.format(service.revenueMinor / 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function StatusList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ status: string; count: number }>;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--gp-border, #d7dde8)',
        borderRadius: 8,
        padding: '1rem',
        background: '#fff',
      }}
    >
      <h4 style={{ margin: '0 0 0.75rem', fontSize: 15 }}>{title}</h4>
      {rows.length === 0 ? (
        <p style={{ margin: 0 }}>0</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
          {rows.map((row) => (
            <li
              key={row.status}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                borderBottom: '1px solid #eef2f7',
                paddingBottom: '0.45rem',
              }}
            >
              <span>{row.status}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
