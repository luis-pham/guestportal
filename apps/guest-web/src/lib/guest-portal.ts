import type {
  AiToolName,
  ConversationCreateResponse,
  ConversationDetailResponse,
  ConversationMessage,
  ConversationSummary,
  GuestAiToolExecuteResponse,
  GuestDraftConfirmRequest,
  GuestMessageCreateResponse,
  GuestOrder,
  GuestOrderCancelResponse,
  GuestOrderDraftCreateRequest,
  GuestOrderDraftCreateResponse,
  GuestOrderDraftConfirmResponse,
  GuestOrdersResponse,
  GuestPortalResponse,
  GuestRequest,
  GuestRequestCancelResponse,
  GuestRequestDraftCreateRequest,
  GuestRequestDraftCreateResponse,
  GuestRequestDraftConfirmResponse,
  GuestRequestsResponse,
  GuestWorkItem,
  PortalConfigDocument,
  VoiceLiveSession,
  VoiceLiveSessionCreateResponse,
  VoiceMetricCreateRequest,
  VoiceMetricCreateResponse,
} from '@guestportal/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function pickLocalized(
  localized: { vi?: string; en?: string } | undefined,
  locale: string,
  fallback = '',
): string {
  if (!localized) return fallback;
  if (locale.startsWith('vi') && localized.vi?.trim()) return localized.vi;
  if (localized.en?.trim()) return localized.en;
  return localized.vi?.trim() || fallback;
}

/** Keep guest navigation under the opaque QR token path. */
export function locationSafeHref(qrToken: string, href: string): string {
  const base = `/g/${qrToken}`;
  if (!href || href === '#') return base;
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return href;
  }
  if (href.startsWith('#')) return `${base}${href}`;
  if (href.startsWith('/g/')) return href;
  if (href.startsWith('/')) return `${base}${href}`;
  return `${base}/${href}`;
}

export async function openGuestSession(
  qrToken: string,
  locale?: 'vi' | 'en',
): Promise<Response> {
  return fetch(`${API_URL}/v1/guest/sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: qrToken, ...(locale ? { locale } : {}) }),
  });
}

export async function fetchGuestPortal(): Promise<GuestPortalResponse | null> {
  const response = await fetch(`${API_URL}/v1/guest/portal`, { credentials: 'include' });
  if (!response.ok) return null;
  return (await response.json()) as GuestPortalResponse;
}

export async function createGuestConversation(
  locale: string,
): Promise<ConversationSummary> {
  const response = await fetch(`${API_URL}/v1/guest/conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale, retentionPolicy: 'standard_30_days' }),
  });
  if (!response.ok) {
    throw new Error(`Could not create guest conversation (${response.status}).`);
  }
  const body = (await response.json()) as ConversationCreateResponse;
  return body.conversation;
}

export async function fetchGuestConversation(
  conversationId: string,
): Promise<ConversationDetailResponse | null> {
  const response = await fetch(`${API_URL}/v1/guest/conversations/${conversationId}`, {
    credentials: 'include',
  });
  if (!response.ok) return null;
  return (await response.json()) as ConversationDetailResponse;
}

export async function sendGuestConversationMessage({
  conversationId,
  text,
  locale,
  clientMessageId,
}: {
  conversationId: string;
  text: string;
  locale: string;
  clientMessageId: string;
}): Promise<ConversationMessage> {
  const response = await fetch(`${API_URL}/v1/guest/conversations/${conversationId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, originalLanguage: locale, clientMessageId }),
  });
  if (!response.ok) {
    throw new Error(`Could not send guest message (${response.status}).`);
  }
  const body = (await response.json()) as GuestMessageCreateResponse;
  return body.message;
}

export async function createGuestVoiceLiveSession({
  conversationId,
  locale,
}: {
  conversationId: string;
  locale: string;
}): Promise<VoiceLiveSession> {
  const response = await fetch(`${API_URL}/v1/guest/live-sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, locale }),
  });
  if (!response.ok) {
    throw new Error(`Could not start live voice session (${response.status}).`);
  }
  const body = (await response.json()) as VoiceLiveSessionCreateResponse;
  return body.liveSession;
}

export async function executeGuestConversationTool({
  conversationId,
  toolName,
  input,
}: {
  conversationId: string;
  toolName: AiToolName;
  input: Record<string, unknown>;
}): Promise<GuestAiToolExecuteResponse> {
  const response = await fetch(`${API_URL}/v1/guest/conversations/${conversationId}/tool-results`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName, input }),
  });
  if (!response.ok) {
    throw new Error(`Could not execute guest tool (${response.status}).`);
  }
  return (await response.json()) as GuestAiToolExecuteResponse;
}

export async function confirmGuestRequestDraft({
  draftId,
  idempotencyKey,
}: {
  draftId: string;
  idempotencyKey: string;
}): Promise<GuestRequestDraftConfirmResponse> {
  const payload: GuestDraftConfirmRequest = { idempotencyKey };
  const response = await fetch(`${API_URL}/v1/guest/request-drafts/${draftId}/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Could not confirm request draft (${response.status}).`);
  }
  return (await response.json()) as GuestRequestDraftConfirmResponse;
}

export async function createGuestRequestDraft(
  payload: GuestRequestDraftCreateRequest,
): Promise<GuestRequestDraftCreateResponse> {
  const response = await fetch(`${API_URL}/v1/guest/request-drafts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Could not create request draft (${response.status}).`);
  }
  return (await response.json()) as GuestRequestDraftCreateResponse;
}

export async function confirmGuestOrderDraft({
  draftId,
  idempotencyKey,
}: {
  draftId: string;
  idempotencyKey: string;
}): Promise<GuestOrderDraftConfirmResponse> {
  const payload: GuestDraftConfirmRequest = { idempotencyKey };
  const response = await fetch(`${API_URL}/v1/guest/order-drafts/${draftId}/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Could not confirm order draft (${response.status}).`);
  }
  return (await response.json()) as GuestOrderDraftConfirmResponse;
}

export async function createGuestOrderDraft(
  payload: GuestOrderDraftCreateRequest,
): Promise<GuestOrderDraftCreateResponse> {
  const response = await fetch(`${API_URL}/v1/guest/order-drafts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Could not create order draft (${response.status}).`);
  }
  return (await response.json()) as GuestOrderDraftCreateResponse;
}

export async function fetchGuestRequests(): Promise<GuestRequest[]> {
  const response = await fetch(`${API_URL}/v1/guest/requests`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Could not load guest requests (${response.status}).`);
  }
  const body = (await response.json()) as GuestRequestsResponse;
  return body.requests;
}

export async function fetchGuestOrders(): Promise<GuestOrder[]> {
  const response = await fetch(`${API_URL}/v1/guest/orders`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Could not load guest orders (${response.status}).`);
  }
  const body = (await response.json()) as GuestOrdersResponse;
  return body.orders;
}

export async function fetchGuestWorkItems(): Promise<GuestWorkItem[]> {
  const [requests, orders] = await Promise.all([fetchGuestRequests(), fetchGuestOrders()]);
  return [
    ...requests.map((request) => ({ ...request, kind: 'request' as const })),
    ...orders.map((order) => ({ ...order, kind: 'order' as const })),
  ].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
}

export type GuestRealtimeEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export async function fetchGuestRealtimeEvents(lastEventId?: string | null) {
  const params = new URLSearchParams();
  if (lastEventId) params.set('lastEventId', lastEventId);
  const query = params.toString();
  const response = await fetch(`${API_URL}/v1/guest/realtime/events${query ? `?${query}` : ''}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Could not load realtime events (${response.status}).`);
  }
  return (await response.json()) as {
    events: GuestRealtimeEvent[];
    reconnectAfterMs: number;
    notificationsSupported: string[];
  };
}

export function guestRealtimeStreamUrl(lastEventId?: string | null) {
  const params = new URLSearchParams();
  if (lastEventId) params.set('lastEventId', lastEventId);
  const query = params.toString();
  return `${API_URL}/v1/guest/realtime/stream${query ? `?${query}` : ''}`;
}

export async function cancelGuestRequest({
  requestId,
  idempotencyKey,
}: {
  requestId: string;
  idempotencyKey: string;
}): Promise<GuestRequestCancelResponse> {
  const response = await fetch(`${API_URL}/v1/guest/requests/${requestId}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey }),
  });
  if (!response.ok) {
    throw new Error(`Could not cancel request (${response.status}).`);
  }
  return (await response.json()) as GuestRequestCancelResponse;
}

export async function cancelGuestOrder({
  orderId,
  idempotencyKey,
}: {
  orderId: string;
  idempotencyKey: string;
}): Promise<GuestOrderCancelResponse> {
  const response = await fetch(`${API_URL}/v1/guest/orders/${orderId}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey }),
  });
  if (!response.ok) {
    throw new Error(`Could not cancel order (${response.status}).`);
  }
  return (await response.json()) as GuestOrderCancelResponse;
}

export async function recordGuestVoiceMetric({
  conversationId,
  metric,
}: {
  conversationId: string;
  metric: VoiceMetricCreateRequest;
}): Promise<VoiceMetricCreateResponse> {
  const response = await fetch(`${API_URL}/v1/guest/conversations/${conversationId}/voice-metrics`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  });
  if (!response.ok) {
    throw new Error(`Could not record voice metric (${response.status}).`);
  }
  return (await response.json()) as VoiceMetricCreateResponse;
}

export function findSection<T extends PortalConfigDocument['sections'][number]['type']>(
  config: PortalConfigDocument,
  type: T,
) {
  return config.sections.find((section) => section.type === type && section.enabled) as
    | Extract<PortalConfigDocument['sections'][number], { type: T }>
    | undefined;
}
