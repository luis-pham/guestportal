import type {
  AiToolName,
  ConversationCreateResponse,
  ConversationDetailResponse,
  ConversationMessage,
  ConversationSummary,
  GuestAiToolExecuteResponse,
  GuestDraftConfirmRequest,
  GuestMessageCreateResponse,
  GuestOrderDraftConfirmResponse,
  GuestPortalResponse,
  GuestRequestDraftConfirmResponse,
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
