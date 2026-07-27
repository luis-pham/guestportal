'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { GuestPortalResponse, OrderDraftItem, RequestDraftPayload } from '@guestportal/contracts';
import {
  confirmGuestOrderDraft,
  confirmGuestRequestDraft,
  createGuestConversation,
  createGuestOrderDraft,
  createGuestRequestDraft,
  findSection,
  pickLocalized,
} from '../lib/guest-portal';

type CatalogItem = {
  id: string;
  title: string;
  href: string;
  kind: 'request' | 'order';
  requestType: RequestDraftPayload['requestType'];
  unitPriceMinor: number;
  currency: string;
};

type CartLine = CatalogItem & {
  quantity: number;
};

const copy = {
  vi: {
    title: 'Dịch vụ',
    location: 'Vị trí',
    empty: 'Chưa có dịch vụ được publish.',
    request: 'Gửi yêu cầu',
    add: 'Thêm',
    cart: 'Giỏ hàng',
    quantity: 'Số lượng',
    notes: 'Ghi chú',
    notesPlaceholder: 'Ghi chú cho đội ngũ vận hành',
    total: 'Tổng',
    submitOrder: 'Gửi đơn',
    submitting: 'Đang gửi',
    confirmation: 'Đã gửi thành công',
    status: 'Xem trạng thái',
    error: 'Không gửi được. Vui lòng thử lại.',
    emptyCart: 'Chưa có món nào.',
  },
  en: {
    title: 'Services',
    location: 'Location',
    empty: 'No published services yet.',
    request: 'Request',
    add: 'Add',
    cart: 'Cart',
    quantity: 'Quantity',
    notes: 'Notes',
    notesPlaceholder: 'Notes for the operations team',
    total: 'Total',
    submitOrder: 'Submit order',
    submitting: 'Submitting',
    confirmation: 'Submitted',
    status: 'View status',
    error: 'Could not submit. Please try again.',
    emptyCart: 'Your cart is empty.',
  },
};

function classifyAction(action: { href: string; icon: string }): CatalogItem['kind'] | null {
  const href = action.href.toLowerCase();
  if (action.icon === 'chat' || href.includes('/chat')) return null;
  if (action.icon === 'map' || href.includes('/guide') || href.includes('/explore')) return null;
  if (action.icon === 'food' || /food|order|menu|dining|restaurant/.test(href)) return 'order';
  if (/request|housekeeping|maintenance|amenity|spa|service/.test(href)) return 'request';
  return null;
}

function requestTypeFromHref(href: string): RequestDraftPayload['requestType'] {
  const lower = href.toLowerCase();
  if (lower.includes('housekeeping')) return 'housekeeping';
  if (lower.includes('maintenance')) return 'maintenance';
  if (lower.includes('amenity')) return 'amenity';
  if (lower.includes('service') || lower.includes('spa')) return 'service';
  return 'other';
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amountMinor / 100);
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ServicesView({ qrToken, data }: { qrToken: string; data: GuestPortalResponse }) {
  const localeKey = data.locale.startsWith('vi') ? 'vi' : 'en';
  const t = copy[localeKey];
  const [cart, setCart] = useState<CartLine[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const catalog = useMemo<CatalogItem[]>(() => {
    const quickActions = findSection(data.portal.config, 'quick_actions')?.actions ?? [];
    const items = quickActions
      .map((action) => {
        const kind = classifyAction(action);
        if (!kind) return null;
        return {
          id: action.id,
          title: pickLocalized(action.label, data.locale, action.href),
          href: action.href,
          kind,
          requestType: requestTypeFromHref(action.href),
          unitPriceMinor: 0,
          currency: 'USD',
        };
      })
      .filter((item): item is CatalogItem => Boolean(item));

    const promotion = findSection(data.portal.config, 'promotion_banner');
    if (promotion?.href) {
      const kind = classifyAction({ href: promotion.href, icon: 'info' });
      if (kind) {
        items.push({
          id: promotion.id,
          title: pickLocalized(promotion.title, data.locale, promotion.href),
          href: promotion.href,
          kind,
          requestType: requestTypeFromHref(promotion.href),
          unitPriceMinor: 0,
          currency: 'USD',
        });
      }
    }

    return items;
  }, [data]);

  const totalMinor = cart.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  const currency = cart[0]?.currency ?? 'USD';

  function addToCart(item: CatalogItem) {
    setSubmittedTitle(null);
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id ? { ...line, quantity: Math.min(line.quantity + 1, 99) } : line,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  }

  function setQuantity(itemId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) => (line.id === itemId ? { ...line, quantity: Math.max(0, quantity) } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  async function submitRequest(item: CatalogItem) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmittingId(item.id);
    setSubmittedTitle(null);
    setError(null);
    try {
      const conversation = await createGuestConversation(data.locale);
      const draft = await createGuestRequestDraft({
        conversationId: conversation.id,
        requestType: item.requestType,
        title: item.title,
        details: requestNotes[item.id] ?? '',
        locale: data.locale,
        metadata: { source: 'guest_services', catalogItemId: item.id, href: item.href },
      });
      await confirmGuestRequestDraft({
        draftId: draft.draft.id,
        idempotencyKey: idempotencyKey(`guest-request-${draft.draft.id}`),
      });
      setRequestNotes((current) => ({ ...current, [item.id]: '' }));
      setSubmittedTitle(item.title);
    } catch {
      setError(t.error);
    } finally {
      submittingRef.current = false;
      setSubmittingId(null);
    }
  }

  async function submitOrder() {
    if (cart.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmittingId('cart');
    setSubmittedTitle(null);
    setError(null);
    try {
      const conversation = await createGuestConversation(data.locale);
      const items: OrderDraftItem[] = cart.map((line) => ({
        itemId: line.id,
        label: line.title,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        currency: line.currency,
        optionsSnapshot: {},
        notes: '',
        metadata: { source: 'guest_services', href: line.href },
      }));
      const draft = await createGuestOrderDraft({
        conversationId: conversation.id,
        title: cart.length === 1 ? cart[0]!.title : t.cart,
        items,
        locale: data.locale,
        notes: orderNotes,
        metadata: { source: 'guest_services' },
      });
      await confirmGuestOrderDraft({
        draftId: draft.draft.id,
        idempotencyKey: idempotencyKey(`guest-order-${draft.draft.id}`),
      });
      setSubmittedTitle(draft.draft.title);
      setCart([]);
      setOrderNotes('');
    } catch {
      setError(t.error);
    } finally {
      submittingRef.current = false;
      setSubmittingId(null);
    }
  }

  return (
    <main className="gp-services" data-testid="guest-services">
      <header className="gp-services__header">
        <p>{t.location}: {pickLocalized(data.location.name, data.locale, data.location.code)}</p>
        <h1>{t.title}</h1>
      </header>

      {submittedTitle ? (
        <div className="gp-services__notice" data-testid="guest-confirmation" role="status">
          <strong>{t.confirmation}</strong>
          <span>{submittedTitle}</span>
          <Link href={`/g/${qrToken}/status`}>{t.status}</Link>
        </div>
      ) : null}

      {error ? (
        <p className="gp-services__error" data-testid="guest-submit-error" role="alert">
          {error}
        </p>
      ) : null}

      {catalog.length === 0 ? (
        <p className="gp-services__empty" data-testid="guest-services-empty">{t.empty}</p>
      ) : (
        <section className="gp-services__catalog" aria-label={t.title}>
          {catalog.map((item) => (
            <article className="gp-service" key={item.id} data-testid="guest-service-item">
              <div>
                <h2>{item.title}</h2>
                <p>{money(item.unitPriceMinor, item.currency)}</p>
              </div>
              {item.kind === 'order' ? (
                <button
                  type="button"
                  data-testid={`guest-add-${item.id}`}
                  onClick={() => addToCart(item)}
                  disabled={submittingId !== null}
                >
                  {t.add}
                </button>
              ) : (
                <div className="gp-service__request">
                  <textarea
                    data-testid={`guest-request-notes-${item.id}`}
                    aria-label={`${t.notes}: ${item.title}`}
                    placeholder={t.notesPlaceholder}
                    value={requestNotes[item.id] ?? ''}
                    onChange={(event) =>
                      setRequestNotes((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    data-testid={`guest-submit-request-${item.id}`}
                    onClick={() => void submitRequest(item)}
                    disabled={submittingId !== null}
                  >
                    {submittingId === item.id ? t.submitting : t.request}
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <aside className="gp-cart" data-testid="guest-cart" aria-label={t.cart}>
        <h2>{t.cart}</h2>
        {cart.length === 0 ? (
          <p className="gp-cart__empty">{t.emptyCart}</p>
        ) : (
          <>
            <ul>
              {cart.map((line) => (
                <li key={line.id}>
                  <span>{line.title}</span>
                  <div className="gp-cart__quantity">
                    <button
                      type="button"
                      aria-label={`${t.quantity} - ${line.title}`}
                      onClick={() => setQuantity(line.id, line.quantity - 1)}
                      disabled={submittingId !== null}
                    >
                      -
                    </button>
                    <output>{line.quantity}</output>
                    <button
                      type="button"
                      aria-label={`${t.quantity} + ${line.title}`}
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                      disabled={submittingId !== null}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <label className="gp-cart__notes">
              <span>{t.notes}</span>
              <textarea
                data-testid="guest-order-notes"
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                placeholder={t.notesPlaceholder}
              />
            </label>
            <div className="gp-cart__total" data-testid="guest-cart-total">
              <span>{t.total}</span>
              <strong>{money(totalMinor, currency)}</strong>
            </div>
            <button
              type="button"
              data-testid="guest-submit-order"
              onClick={() => void submitOrder()}
              disabled={submittingId !== null || cart.length === 0}
            >
              {submittingId === 'cart' ? t.submitting : t.submitOrder}
            </button>
          </>
        )}
      </aside>
    </main>
  );
}
