'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GuestChatMessage } from '@guestportal/ui';
import { GuestTextChat } from '@guestportal/ui';
import '@guestportal/ui/guest-chat.css';
import type { GuestPortalResponse } from '@guestportal/contracts';
import {
  createGuestConversation,
  createGuestVoiceLiveSession,
  sendGuestConversationMessage,
} from '../lib/guest-portal';
import { BrowserVoiceTransport, type VoiceTransportState } from '../lib/voice-transport';
import './voice-assistant.css';

type VoiceAssistantShellProps = {
  data: GuestPortalResponse;
};

const stateLabels: Record<'en' | 'vi', Record<VoiceTransportState, string>> = {
  en: {
    idle: 'Idle',
    requesting_permission: 'Requesting permission',
    connecting: 'Connecting',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    reconnecting: 'Reconnecting',
    error: 'Error',
  },
  vi: {
    idle: 'Sẵn sàng',
    requesting_permission: 'Đang xin quyền mic',
    connecting: 'Đang kết nối',
    listening: 'Đang nghe',
    thinking: 'Đang xử lý',
    speaking: 'Đang trả lời',
    reconnecting: 'Đang nối lại',
    error: 'Có lỗi',
  },
};

const copy = {
  en: {
    assistant: 'Assistant',
    startVoice: 'Start voice',
    stopVoice: 'Stop voice',
    typeAnytime: 'Type anytime',
    micDenied: 'Microphone permission was denied. You can keep chatting by text.',
    voiceFailed: 'Voice is unavailable right now. Text chat is still open.',
    voiceReady: 'Voice session is ready.',
    textSaved: 'Message sent to the property team.',
    textFailed: 'Message could not be sent. Please try again.',
  },
  vi: {
    assistant: 'Trợ lý',
    startVoice: 'Bật thoại',
    stopVoice: 'Tắt thoại',
    typeAnytime: 'Có thể nhập tin nhắn',
    micDenied: 'Quyền micro bị từ chối. Bạn vẫn có thể chat bằng chữ.',
    voiceFailed: 'Thoại hiện chưa sẵn sàng. Chat chữ vẫn dùng được.',
    voiceReady: 'Phiên thoại đã sẵn sàng.',
    textSaved: 'Tin nhắn đã được gửi đến đội ngũ hỗ trợ.',
    textFailed: 'Chưa gửi được tin nhắn. Vui lòng thử lại.',
  },
};

function connectionStateFor(state: VoiceTransportState) {
  if (state === 'requesting_permission' || state === 'connecting') return 'connecting';
  if (state === 'reconnecting') return 'recovering';
  if (state === 'error') return 'offline';
  return 'online';
}

function messageFromText(role: GuestChatMessage['role'], text: string, error = false): GuestChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    error,
  };
}

export function VoiceAssistantShell({ data }: VoiceAssistantShellProps) {
  const localeKey = data.locale.startsWith('vi') ? 'vi' : 'en';
  const labels = copy[localeKey];
  const [voiceState, setVoiceState] = useState<VoiceTransportState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<GuestChatMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const transportRef = useRef<BrowserVoiceTransport | null>(null);

  const assistantName = useMemo(
    () =>
      data.locale.startsWith('vi')
        ? data.portal.config.assistant.name.vi || labels.assistant
        : data.portal.config.assistant.name.en || labels.assistant,
    [data.locale, data.portal.config.assistant.name.en, data.portal.config.assistant.name.vi, labels.assistant],
  );

  const ensureConversation = useCallback(async () => {
    if (conversationIdRef.current) return conversationIdRef.current;
    const conversation = await createGuestConversation(data.locale);
    conversationIdRef.current = conversation.id;
    return conversation.id;
  }, [data.locale]);

  const getTransport = useCallback(() => {
    if (transportRef.current) return transportRef.current;
    transportRef.current = new BrowserVoiceTransport({
      onEvent: (event) => {
        if (event.type === 'status') {
          setVoiceState(event.state);
          if (event.state === 'listening') {
            setVoiceError(null);
          }
        }
        if (event.type === 'error') {
          const denied =
            event.error.name === 'NotAllowedError' ||
            event.error.name === 'PermissionDeniedError' ||
            event.error.message.toLowerCase().includes('permission');
          setVoiceError(denied ? labels.micDenied : labels.voiceFailed);
          setMessages((current) => [
            ...current,
            messageFromText('system', denied ? labels.micDenied : labels.voiceFailed, true),
          ]);
        }
      },
    });
    return transportRef.current;
  }, [labels.micDenied, labels.voiceFailed]);

  const startVoice = useCallback(async () => {
    setVoiceError(null);
    const conversationId = await ensureConversation();
    await getTransport().start({
      locale: data.locale,
      conversationId,
      createLiveSession: createGuestVoiceLiveSession,
    });
  }, [data.locale, ensureConversation, getTransport]);

  const stopVoice = useCallback(async () => {
    await transportRef.current?.stop();
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const clientMessageId = crypto.randomUUID();
      setComposer('');
      setSending(true);
      setMessages((current) => [...current, messageFromText('guest', text)]);
      try {
        const conversationId = await ensureConversation();
        await sendGuestConversationMessage({
          conversationId,
          text,
          locale: data.locale,
          clientMessageId,
        });
        setMessages((current) => [...current, messageFromText('system', labels.textSaved)]);
      } catch {
        setMessages((current) => [...current, messageFromText('system', labels.textFailed, true)]);
      } finally {
        setSending(false);
      }
    },
    [data.locale, ensureConversation, labels.textFailed, labels.textSaved],
  );

  return (
    <main className="gp-voice-assistant" data-testid="guest-voice-shell">
      <section className="gp-voice-strip" aria-label={labels.assistant}>
        <div className="gp-voice-strip__status">
          <span className={`gp-voice-dot is-${voiceState}`} aria-hidden="true" />
          <span data-testid="guest-voice-status">{stateLabels[localeKey][voiceState]}</span>
          <small>{labels.typeAnytime}</small>
        </div>
        <div className="gp-voice-strip__actions">
          <button
            className="gp-voice-icon-button"
            type="button"
            data-testid="guest-voice-start"
            aria-label={labels.startVoice}
            title={labels.startVoice}
            disabled={
              voiceState === 'requesting_permission' ||
              voiceState === 'connecting' ||
              voiceState === 'listening' ||
              voiceState === 'speaking'
            }
            onClick={() => void startVoice()}
          >
            <span className="gp-voice-icon is-mic" aria-hidden="true" />
          </button>
          <button
            className="gp-voice-icon-button"
            type="button"
            data-testid="guest-voice-stop"
            aria-label={labels.stopVoice}
            title={labels.stopVoice}
            disabled={voiceState === 'idle'}
            onClick={() => void stopVoice()}
          >
            <span className="gp-voice-icon is-stop" aria-hidden="true" />
          </button>
        </div>
      </section>
      {voiceError ? (
        <p className="gp-voice-error" data-testid="guest-voice-error" role="alert">
          {voiceError}
        </p>
      ) : null}
      <GuestTextChat
        locale={data.locale}
        assistantName={assistantName}
        connectionState={connectionStateFor(voiceState)}
        messages={messages}
        composerValue={composer}
        sending={sending}
        labels={{ empty: labels.voiceReady }}
        onComposerChange={setComposer}
        onSend={(value) => void sendText(value)}
      />
    </main>
  );
}
