import { describe, expect, it, vi } from 'vitest';
import type { VoiceLiveSession } from '@guestportal/contracts';
import {
  BrowserVoiceTransport,
  buildGeminiLiveSetupMessage,
  buildGeminiLiveWebSocketUrl,
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
    this.onclose?.(new CloseEvent('close'));
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
    expect(events.map((event) => event.type === 'status' && event.state)).toEqual([
      'requesting_permission',
      'connecting',
      'listening',
    ]);

    await transport.stop();

    expect(track.stopped).toBe(true);
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    expect(events.at(-1)).toEqual({ type: 'status', state: 'idle' });
  });
});
