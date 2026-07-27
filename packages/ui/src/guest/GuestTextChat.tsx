'use client';

import type { FormEvent } from 'react';

export type GuestChatLocale = 'vi' | 'en' | 'ko' | 'ja' | 'zh' | 'fr';

export type GuestChatCitation = {
  id: string;
  label: string;
  sourceTitle: string;
  excerpt?: string;
  href?: string;
};

export type GuestChatMessage = {
  id: string;
  role: 'guest' | 'assistant' | 'system';
  text: string;
  translatedText?: string;
  citations?: GuestChatCitation[];
  pending?: boolean;
  error?: boolean;
};

export type GuestChatConfirmation = {
  id: string;
  kind: 'request' | 'order';
  title: string;
  summary: string;
  expiresAtLabel?: string;
  status: 'needs_confirmation' | 'confirming' | 'confirmed' | 'expired' | 'error';
  onConfirm?: () => void;
  onCancel?: () => void;
};

export type GuestTextChatLabels = {
  title: string;
  close: string;
  online: string;
  connecting: string;
  recovering: string;
  offline: string;
  transcript: string;
  citations: string;
  citationPrefix: string;
  confirmationTitle: string;
  request: string;
  order: string;
  expires: string;
  confirm: string;
  cancel: string;
  confirmed: string;
  expired: string;
  confirmationError: string;
  composerLabel: string;
  composerPlaceholder: string;
  send: string;
  sending: string;
  retry: string;
  networkIssue: string;
  empty: string;
};

export type GuestTextChatProps = {
  locale?: GuestChatLocale | string;
  assistantName?: string;
  connectionState?: 'online' | 'connecting' | 'recovering' | 'offline';
  messages?: GuestChatMessage[];
  confirmation?: GuestChatConfirmation | null;
  composerValue?: string;
  sending?: boolean;
  recoveryMessage?: string | null;
  labels?: Partial<GuestTextChatLabels>;
  onComposerChange?: (value: string) => void;
  onSend?: (value: string) => void;
  onRetry?: () => void;
  onClose?: () => void;
};

const LABELS: Record<'en' | 'vi' | 'ko', GuestTextChatLabels> = {
  en: {
    title: 'Assistant',
    close: 'Close chat',
    online: 'Online',
    connecting: 'Connecting',
    recovering: 'Reconnecting',
    offline: 'Offline',
    transcript: 'Conversation',
    citations: 'Sources',
    citationPrefix: 'Source',
    confirmationTitle: 'Confirm before sending',
    request: 'Request',
    order: 'Order',
    expires: 'Expires',
    confirm: 'Confirm',
    cancel: 'Cancel',
    confirmed: 'Confirmed',
    expired: 'Expired. Ask the assistant to prepare it again.',
    confirmationError: 'Confirmation failed. Please try again.',
    composerLabel: 'Message',
    composerPlaceholder: 'Type your message',
    send: 'Send',
    sending: 'Sending',
    retry: 'Retry',
    networkIssue: 'Connection issue. Your chat history is still here.',
    empty: 'Ask a question or request help from the property team.',
  },
  vi: {
    title: 'Trợ lý',
    close: 'Đóng trò chuyện',
    online: 'Đang hoạt động',
    connecting: 'Đang kết nối',
    recovering: 'Đang kết nối lại',
    offline: 'Ngoại tuyến',
    transcript: 'Cuộc trò chuyện',
    citations: 'Nguồn tham khảo',
    citationPrefix: 'Nguồn',
    confirmationTitle: 'Xác nhận trước khi gửi',
    request: 'Yêu cầu',
    order: 'Đơn hàng',
    expires: 'Hết hạn',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
    confirmed: 'Đã xác nhận',
    expired: 'Bản nháp đã hết hạn. Hãy nhờ trợ lý chuẩn bị lại.',
    confirmationError: 'Xác nhận chưa thành công. Vui lòng thử lại.',
    composerLabel: 'Tin nhắn',
    composerPlaceholder: 'Nhập tin nhắn',
    send: 'Gửi',
    sending: 'Đang gửi',
    retry: 'Thử lại',
    networkIssue: 'Kết nối không ổn định. Lịch sử chat vẫn được giữ.',
    empty: 'Hỏi thông tin hoặc nhờ đội ngũ hỗ trợ.',
  },
  ko: {
    title: '어시스턴트',
    close: '채팅 닫기',
    online: '온라인',
    connecting: '연결 중',
    recovering: '다시 연결 중',
    offline: '오프라인',
    transcript: '대화',
    citations: '출처',
    citationPrefix: '출처',
    confirmationTitle: '보내기 전에 확인',
    request: '요청',
    order: '주문',
    expires: '만료',
    confirm: '확인',
    cancel: '취소',
    confirmed: '확인됨',
    expired: '초안이 만료되었습니다. 다시 준비해 달라고 요청하세요.',
    confirmationError: '확인에 실패했습니다. 다시 시도해 주세요.',
    composerLabel: '메시지',
    composerPlaceholder: '메시지를 입력하세요',
    send: '보내기',
    sending: '전송 중',
    retry: '다시 시도',
    networkIssue: '연결 문제가 있습니다. 채팅 기록은 유지됩니다.',
    empty: '궁금한 점을 묻거나 숙소 팀에 도움을 요청하세요.',
  },
};

function labelsFor(locale: string, overrides: Partial<GuestTextChatLabels> | undefined) {
  const key = locale.startsWith('vi') ? 'vi' : locale.startsWith('ko') ? 'ko' : 'en';
  return { ...LABELS[key], ...overrides };
}

function submitLabel(labels: GuestTextChatLabels, sending: boolean) {
  return sending ? labels.sending : labels.send;
}

export function GuestTextChat({
  locale = 'en',
  assistantName,
  connectionState = 'online',
  messages = [],
  confirmation = null,
  composerValue = '',
  sending = false,
  recoveryMessage = null,
  labels: labelOverrides,
  onComposerChange,
  onSend,
  onRetry,
  onClose,
}: GuestTextChatProps) {
  const labels = labelsFor(locale, labelOverrides);
  const hasText = composerValue.trim().length > 0;
  const stateLabel = labels[connectionState];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasText || sending) return;
    onSend?.(composerValue.trim());
  }

  return (
    <section className="gp-guest-chat" data-testid="guest-text-chat" lang={locale}>
      <header className="gp-guest-chat__header">
        <div>
          <p className="gp-guest-chat__eyebrow">{assistantName ?? labels.title}</p>
          <h1>{labels.title}</h1>
        </div>
        <div className="gp-guest-chat__header-actions">
          <span className={`gp-guest-chat__state is-${connectionState}`}>{stateLabel}</span>
          {onClose ? (
            <button
              className="gp-guest-chat__icon-button"
              type="button"
              aria-label={labels.close}
              onClick={onClose}
            >
              x
            </button>
          ) : null}
        </div>
      </header>

      {recoveryMessage || connectionState === 'offline' ? (
        <div className="gp-guest-chat__recovery" role="status" data-testid="chat-recovery">
          <span>{recoveryMessage ?? labels.networkIssue}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              {labels.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="gp-guest-chat__transcript" aria-label={labels.transcript}>
        {messages.length === 0 ? (
          <p className="gp-guest-chat__empty">{labels.empty}</p>
        ) : (
          messages.map((message) => (
            <article
              className={`gp-guest-chat__message is-${message.role}${
                message.error ? ' is-error' : ''
              }`}
              data-testid={`chat-message-${message.id}`}
              key={message.id}
            >
              <p>{message.text}</p>
              {message.translatedText ? (
                <p className="gp-guest-chat__translation">{message.translatedText}</p>
              ) : null}
              {message.pending ? (
                <span className="gp-guest-chat__pending" aria-live="polite">
                  {labels.connecting}
                </span>
              ) : null}
              {message.citations && message.citations.length > 0 ? (
                <div className="gp-guest-chat__citations" aria-label={labels.citations}>
                  {message.citations.map((citation, index) => (
                    <a
                      className="gp-guest-chat__citation"
                      data-testid={`chat-citation-${citation.id}`}
                      href={citation.href ?? '#sources'}
                      key={citation.id}
                    >
                      <span>
                        {labels.citationPrefix} {index + 1}
                      </span>
                      <strong>{citation.sourceTitle}</strong>
                      {citation.excerpt ? <small>{citation.excerpt}</small> : null}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {confirmation ? (
        <aside
          className={`gp-guest-chat__confirmation is-${confirmation.status}`}
          data-testid="chat-confirmation-card"
          aria-labelledby={`confirmation-${confirmation.id}`}
        >
          <p className="gp-guest-chat__confirmation-kicker">
            {confirmation.kind === 'request' ? labels.request : labels.order}
          </p>
          <h2 id={`confirmation-${confirmation.id}`}>{labels.confirmationTitle}</h2>
          <strong>{confirmation.title}</strong>
          <p>{confirmation.summary}</p>
          {confirmation.expiresAtLabel ? (
            <span className="gp-guest-chat__expires">
              {labels.expires}: {confirmation.expiresAtLabel}
            </span>
          ) : null}
          {confirmation.status === 'confirmed' ? (
            <p className="gp-guest-chat__confirmation-note">{labels.confirmed}</p>
          ) : confirmation.status === 'expired' ? (
            <p className="gp-guest-chat__confirmation-note">{labels.expired}</p>
          ) : confirmation.status === 'error' ? (
            <p className="gp-guest-chat__confirmation-note" role="alert">
              {labels.confirmationError}
            </p>
          ) : (
            <div className="gp-guest-chat__confirmation-actions">
              <button
                type="button"
                disabled={confirmation.status === 'confirming'}
                onClick={confirmation.onConfirm}
              >
                {labels.confirm}
              </button>
              <button type="button" onClick={confirmation.onCancel}>
                {labels.cancel}
              </button>
            </div>
          )}
        </aside>
      ) : null}

      <form className="gp-guest-chat__composer" onSubmit={handleSubmit}>
        <label htmlFor="gp-guest-chat-message">{labels.composerLabel}</label>
        <div className="gp-guest-chat__composer-row">
          <textarea
            id="gp-guest-chat-message"
            rows={1}
            value={composerValue}
            placeholder={labels.composerPlaceholder}
            onChange={(event) => onComposerChange?.(event.currentTarget.value)}
          />
          <button type="submit" disabled={!hasText || sending}>
            {submitLabel(labels, sending)}
          </button>
        </div>
      </form>
    </section>
  );
}
