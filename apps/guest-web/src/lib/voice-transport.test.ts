import { describe, expect, it, vi } from 'vitest';
import type { VoiceLiveSession } from '@guestportal/contracts';
import {
  BrowserVoiceTransport,
  buildGeminiLiveSetupMessage,
  buildGeminiToolResponseMessage,
  buildGeminiLiveWebSocketUrl,
  mapGeminiFunctionCall,
  type VoiceTransportEvent,
} from './voice-transport';

const session: VoiceLiveSession = {
  token: 'ephemeral-token',
  tokenType: 'gemini_ephemeral',
  model: 'models/gemini-3.1-flash-live-preview',
  conversationId: '6bdbe827-771b-4cb9-9d6b-348a8fa7295a',
  locale: 'vi',
  newSessionExpiresAt: '2026-07-27T00:01:00.000Z',
  expiresAt: '2026-07-27T00:30:00.000Z',
  uses: 1,
  constraints: {
    responseModalities: ['AUDIO'],
    sessionResumption: true,
  },
};

class FakeTrack {
  stopped = false;
  stop() {
    this.stopped = true;
  }
}

class FakeMediaStream {
  constructor(private readonly tracks: FakeTrack[]) {}
  getTracks() {
    return this.tracks;
  }
}

class FakeNode {
  connected = false;
  connect() {
    this.connected = true;
  }
  disconnect() {
    this.connected = false;
  }
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  audioWorklet = {
    addModule: vi.fn(async () => undefined),
  };
  source = new FakeNode();
  createMediaStreamSource() {
    return this.source;
  }
  async close() {
    this.state = 'closed';
  }
}

class FakeAudioWorkletNode extends FakeNode {
  constructor() {
    super();
  }
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;
  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new Event('close') as CloseEvent);
  }

  receive(payload: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }

  static instances: FakeWebSocket[] = [];
}

describe('BrowserVoiceTransport', () => {
  it('does not request a live token when microphone permission is denied', async () => {
    const events: VoiceTransportEvent[] = [];
    const denied = new Error('permission denied');
    denied.name = 'NotAllowedError';
    const createLiveSession = vi.fn(async () => session);
    const transport = new BrowserVoiceTransport({
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw denied;
        }),
      } as unknown as MediaDevices,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      audioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      webSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onEvent: (event) => events.push(event),
    });

    await transport.start({
      locale: 'vi',
      conversationId: session.conversationId,
      createLiveSession,
    });

    expect(createLiveSession).not.toHaveBeenCalled();
    expect(events.map((event) => event.type === 'status' && event.state)).toContain(
      'requesting_permission',
    );
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('opens Gemini directly with an ephemeral access token and tears down resources', async () => {
    const track = new FakeTrack();
    const stream = new FakeMediaStream([track]);
    const events: VoiceTransportEvent[] = [];
    FakeWebSocket.instances = [];
    const transport = new BrowserVoiceTransport({
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream),
      } as unknown as MediaDevices,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      audioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      webSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      onEvent: (event) => events.push(event),
    });

    await transport.start({
      locale: 'vi',
      conversationId: session.conversationId,
      createLiveSession: vi.fn(async () => session),
    });
    const socket = FakeWebSocket.instances[0]!;
    socket.open();

    expect(socket.url).toBe(buildGeminiLiveWebSocketUrl('ephemeral-token'));
    expect(socket.url).toContain('generativelanguage.googleapis.com');
    expect(socket.url).toContain('access_token=ephemeral-token');
    expect(socket.url).not.toContain('localhost');
    expect(socket.url).not.toContain('GEMINI_API_KEY');
    expect(JSON.parse(socket.sent[0]!)).toEqual(buildGeminiLiveSetupMessage(session));
    expect(
      events
        .filter((event) => event.type === 'status')
        .map((event) => event.state),
    ).toEqual(['requesting_permission', 'connecting', 'listening']);

    await transport.stop();

    expect(track.stopped).toBe(true);
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(events.at(-1)).toEqual({ type: 'status', state: 'idle' });
  });

  it('maps Gemini tool calls to the guest tool gateway and responds with correlated ids', async () => {
    const track = new FakeTrack();
    const stream = new FakeMediaStream([track]);
    const executeToolCall = vi.fn(async () => ({
      draft: {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Extra towels',
      },
    }));
    FakeWebSocket.instances = [];
    const transport = new BrowserVoiceTransport({
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream),
      } as unknown as MediaDevices,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      audioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      webSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      executeToolCall,
    });

    await transport.start({
      locale: 'vi',
      conversationId: session.conversationId,
      createLiveSession: vi.fn(async () => session),
    });
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.receive({
      toolCall: {
        functionCalls: [
          {
            id: 'call-1',
            name: 'request_draft',
            args: { title: 'Extra towels', requestType: 'housekeeping' },
          },
        ],
      },
    });
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));

    expect(executeToolCall).toHaveBeenCalledWith({
      id: 'call-1',
      geminiName: 'request_draft',
      name: 'request.draft',
      input: { title: 'Extra towels', requestType: 'housekeeping' },
    });
    expect(JSON.parse(socket.sent[1]!)).toEqual(
      buildGeminiToolResponseMessage([
        {
          id: 'call-1',
          name: 'request_draft',
          response: {
            result: {
              draft: {
                id: '55555555-5555-4555-8555-555555555555',
                title: 'Extra towels',
              },
            },
          },
        },
      ]),
    );
  });

  it('fails closed for unsupported confirmation-like Gemini function names', async () => {
    const executeToolCall = vi.fn(async () => ({}));
    expect(mapGeminiFunctionCall({ id: 'call-confirm', name: 'request_confirm', args: {} }))
      .toBeNull();

    FakeWebSocket.instances = [];
    const transport = new BrowserVoiceTransport({
      mediaDevices: {
        getUserMedia: vi.fn(async () => new FakeMediaStream([new FakeTrack()])),
      } as unknown as MediaDevices,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      audioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      webSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      executeToolCall,
    });
    await transport.start({
      locale: 'vi',
      conversationId: session.conversationId,
      createLiveSession: vi.fn(async () => session),
    });
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.receive({
      toolCall: {
        functionCalls: [{ id: 'call-confirm', name: 'request_confirm', args: {} }],
      },
    });
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));

    expect(executeToolCall).not.toHaveBeenCalled();
    expect(JSON.parse(socket.sent[1]!).toolResponse.functionResponses[0]).toEqual({
      id: 'call-confirm',
      name: 'request_confirm',
      response: {
        error: {
          code: 'AI_TOOL_UNAUTHORIZED',
          message: 'Tool is not available for this guest session.',
        },
      },
    });
  });

  it('emits transcripts, handles interruption, reconnects with session handle, and deduplicates tool calls', async () => {
    const events: VoiceTransportEvent[] = [];
    const executeToolCall = vi.fn(async () => ({ noResult: true }));
    FakeWebSocket.instances = [];
    const transport = new BrowserVoiceTransport({
      mediaDevices: {
        getUserMedia: vi.fn(async () => new FakeMediaStream([new FakeTrack()])),
      } as unknown as MediaDevices,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
      audioWorkletNodeCtor: FakeAudioWorkletNode as unknown as typeof AudioWorkletNode,
      webSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
      executeToolCall,
      reconnectDelayMs: 0,
      onEvent: (event) => events.push(event),
    });

    await transport.start({
      locale: 'vi',
      conversationId: session.conversationId,
      createLiveSession: vi.fn(async () => session),
    });
    const firstSocket = FakeWebSocket.instances[0]!;
    firstSocket.open();
    firstSocket.receive({
      sessionResumptionUpdate: { newHandle: 'resume-1', resumable: true },
    });
    firstSocket.receive({
      serverContent: {
        inputTranscription: { text: 'Xin thêm khăn' },
        outputTranscription: { text: 'Tôi sẽ chuẩn bị bản nháp.' },
      },
    });
    firstSocket.receive({ serverContent: { interrupted: true } });
    firstSocket.receive({
      toolCall: {
        functionCalls: [
          {
            id: 'dup-call',
            name: 'knowledge_search',
            args: { query: 'pool hours' },
          },
        ],
      },
    });
    await vi.waitFor(() => expect(firstSocket.sent).toHaveLength(2));
    firstSocket.receive({
      toolCall: {
        functionCalls: [
          {
            id: 'dup-call',
            name: 'knowledge_search',
            args: { query: 'pool hours' },
          },
        ],
      },
    });
    await vi.waitFor(() => expect(firstSocket.sent).toHaveLength(3));
    firstSocket.close();
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const secondSocket = FakeWebSocket.instances[1]!;
    secondSocket.open();

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(JSON.parse(secondSocket.sent[0]!).setup.sessionResumption).toEqual({
      handle: 'resume-1',
    });
    expect(events).toContainEqual({
      type: 'transcript',
      role: 'guest',
      text: 'Xin thêm khăn',
    });
    expect(events).toContainEqual({
      type: 'transcript',
      role: 'assistant',
      text: 'Tôi sẽ chuẩn bị bản nháp.',
    });
    expect(events).toContainEqual({ type: 'interrupted' });
    expect(
      events.some(
        (event) =>
          event.type === 'usage' && event.reconnectAttempt === 1,
      ),
    ).toBe(true);
  });
});
