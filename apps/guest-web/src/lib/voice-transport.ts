import type { AiToolName, VoiceLiveSession } from '@guestportal/contracts';

export type VoiceTransportState =
  | 'idle'
  | 'requesting_permission'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'reconnecting'
  | 'error';

export type VoiceTransportEvent =
  | { type: 'status'; state: VoiceTransportState }
  | { type: 'error'; error: Error }
  | { type: 'server-message'; payload: unknown }
  | { type: 'tool-call'; calls: VoiceToolCall[] }
  | { type: 'tool-response'; responses: GeminiFunctionResponse[] }
  | { type: 'transcript'; role: 'guest' | 'assistant'; text: string }
  | { type: 'interrupted' }
  | { type: 'usage'; latencyMs?: number; reconnectAttempt?: number };

export type VoiceToolCall = {
  id: string;
  geminiName: GeminiToolName;
  name: AiToolName;
  input: Record<string, unknown>;
};

export type GeminiFunctionResponse = {
  id: string;
  name: GeminiToolName | string;
  response: Record<string, unknown>;
};

export type VoiceTransportOptions = {
  webSocketCtor?: typeof WebSocket;
  audioContextCtor?: typeof AudioContext;
  audioWorkletNodeCtor?: typeof AudioWorkletNode;
  mediaDevices?: MediaDevices;
  executeToolCall?: (call: VoiceToolCall) => Promise<Record<string, unknown>>;
  onEvent?: (event: VoiceTransportEvent) => void;
  reconnectDelayMs?: number;
};

export type StartVoiceTransportInput = {
  locale: string;
  conversationId: string;
  createLiveSession: (input: {
    conversationId: string;
    locale: string;
  }) => Promise<VoiceLiveSession>;
};

const WORKLET_NAME = 'guestportal-mic-meter';

type GeminiToolName =
  | 'knowledge_search'
  | 'catalog_read'
  | 'service_read'
  | 'request_draft'
  | 'order_draft';

type GeminiFunctionCall = {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
};

const GEMINI_TOOL_TO_AI_TOOL: Record<GeminiToolName, AiToolName> = {
  knowledge_search: 'knowledge.search',
  catalog_read: 'catalog.read',
  service_read: 'service.read',
  request_draft: 'request.draft',
  order_draft: 'order.draft',
};

export const GUEST_VOICE_TOOL_DECLARATIONS = [
  {
    name: 'knowledge_search',
    description: 'Search the property knowledge base. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        locale: { type: 'string', enum: ['vi', 'en', 'ko', 'ja', 'zh', 'fr', 'auto'] },
        limit: { type: 'integer', minimum: 1, maximum: 8 },
      },
      required: ['query'],
    },
  },
  {
    name: 'catalog_read',
    description: 'Read visible guest portal catalog items. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        locale: { type: 'string', enum: ['vi', 'en', 'auto'] },
        limit: { type: 'integer', minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: 'service_read',
    description: 'Read visible guest service items. Read-only.',
    parameters: {
      type: 'object',
      properties: {
        locale: { type: 'string', enum: ['vi', 'en', 'auto'] },
        limit: { type: 'integer', minimum: 1, maximum: 12 },
      },
    },
  },
  {
    name: 'request_draft',
    description: 'Create a request draft only. The guest must confirm before submission.',
    parameters: {
      type: 'object',
      properties: {
        requestType: {
          type: 'string',
          enum: ['service', 'housekeeping', 'maintenance', 'amenity', 'other'],
        },
        title: { type: 'string' },
        details: { type: 'string' },
        locale: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['title'],
    },
  },
  {
    name: 'order_draft',
    description: 'Create an order draft only. The guest must confirm before submission.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'string' },
              label: { type: 'string' },
              quantity: { type: 'integer', minimum: 1, maximum: 99 },
              notes: { type: 'string' },
              metadata: { type: 'object' },
            },
            required: ['itemId', 'label', 'quantity'],
          },
        },
        locale: { type: 'string' },
        notes: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['title', 'items'],
    },
  },
] as const;

const MIC_WORKLET_SOURCE = `
class GuestPortalMicMeter extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      let sum = 0;
      for (let index = 0; index < input.length; index += 1) {
        sum += input[index] * input[index];
      }
      this.port.postMessage({ type: 'level', rms: Math.sqrt(sum / input.length) });
    }
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', GuestPortalMicMeter);
`;

export function buildGeminiLiveWebSocketUrl(token: string) {
  const url = new URL(
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
  );
  url.searchParams.set('access_token', token);
  return url.toString();
}

export function buildGeminiLiveSetupMessage(session: VoiceLiveSession, sessionHandle?: string) {
  return {
    setup: {
      model: session.model,
      responseModalities: ['AUDIO'],
      tools: [{ functionDeclarations: GUEST_VOICE_TOOL_DECLARATIONS }],
      realtimeInputConfig: {
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
      },
      sessionResumption: sessionHandle ? { handle: sessionHandle } : {},
    },
  };
}

export function buildGeminiToolResponseMessage(functionResponses: GeminiFunctionResponse[]) {
  return {
    toolResponse: {
      functionResponses,
    },
  };
}

export function mapGeminiFunctionCall(call: GeminiFunctionCall): VoiceToolCall | null {
  if (!call.id || !call.name || !(call.name in GEMINI_TOOL_TO_AI_TOOL)) return null;
  const geminiName = call.name as GeminiToolName;
  return {
    id: call.id,
    geminiName,
    name: GEMINI_TOOL_TO_AI_TOOL[geminiName],
    input: call.args ?? {},
  };
}

function resolveAudioContextCtor(input?: typeof AudioContext) {
  if (input) return input;
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? window.webkitAudioContext ?? null;
}

function asError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

export class BrowserVoiceTransport {
  private readonly webSocketCtor: typeof WebSocket | undefined;
  private readonly audioContextCtor: typeof AudioContext | undefined;
  private readonly audioWorkletNodeCtor: typeof AudioWorkletNode | undefined;
  private readonly mediaDevices: MediaDevices | undefined;
  private readonly executeToolCall:
    | ((call: VoiceToolCall) => Promise<Record<string, unknown>>)
    | undefined;
  private readonly onEvent: ((event: VoiceTransportEvent) => void) | undefined;
  private readonly reconnectDelayMs: number;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private socket: WebSocket | null = null;
  private workletUrl: string | null = null;
  private stopped = false;
  private activeSession: VoiceLiveSession | null = null;
  private sessionHandle: string | undefined;
  private reconnectAttempts = 0;
  private openedAt = 0;
  private readonly toolResponsesByCallId = new Map<string, GeminiFunctionResponse>();

  constructor(options: VoiceTransportOptions = {}) {
    this.webSocketCtor = options.webSocketCtor;
    this.audioContextCtor = options.audioContextCtor;
    this.audioWorkletNodeCtor = options.audioWorkletNodeCtor;
    this.mediaDevices = options.mediaDevices;
    this.executeToolCall = options.executeToolCall;
    this.onEvent = options.onEvent;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 600;
  }

  async start(input: StartVoiceTransportInput) {
    if (this.socket) return;
    this.stopped = false;
    this.emitStatus('requesting_permission');

    try {
      const devices = this.mediaDevices ?? navigator.mediaDevices;
      if (!devices?.getUserMedia) {
        throw new Error('Microphone is not available in this browser.');
      }

      this.stream = await devices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.emitStatus('connecting');
      const session = await input.createLiveSession({
        conversationId: input.conversationId,
        locale: input.locale,
      });
      this.activeSession = session;

      await this.startAudioWorklet();
      this.openSocket(session);
    } catch (error) {
      this.emitError(asError(error));
      await this.stop('error');
    }
  }

  async stop(nextState: VoiceTransportState = 'idle') {
    this.stopped = true;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      if (
        this.socket.readyState === this.socket.CONNECTING ||
        this.socket.readyState === this.socket.OPEN
      ) {
        this.socket.close(1000, 'guest stopped voice session');
      }
      this.socket = null;
    }
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audioContext?.state !== 'closed') {
      await this.audioContext?.close();
    }
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
    }
    this.workletNode = null;
    this.sourceNode = null;
    this.stream = null;
    this.audioContext = null;
    this.workletUrl = null;
    this.activeSession = null;
    this.sessionHandle = undefined;
    this.reconnectAttempts = 0;
    this.toolResponsesByCallId.clear();
    this.emitStatus(nextState);
  }

  private async startAudioWorklet() {
    const AudioContextCtor = resolveAudioContextCtor(this.audioContextCtor);
    if (!AudioContextCtor) {
      throw new Error('AudioWorklet is not available in this browser.');
    }

    this.audioContext = new AudioContextCtor({ sampleRate: 16000 });
    if (!this.audioContext.audioWorklet) {
      throw new Error('AudioWorklet is not available in this browser.');
    }
    this.workletUrl = URL.createObjectURL(
      new Blob([MIC_WORKLET_SOURCE], { type: 'application/javascript' }),
    );
    await this.audioContext.audioWorklet.addModule(this.workletUrl);
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream!);
    const AudioWorkletNodeCtor = this.audioWorkletNodeCtor ?? AudioWorkletNode;
    this.workletNode = new AudioWorkletNodeCtor(this.audioContext, WORKLET_NAME);
    this.sourceNode.connect(this.workletNode);
  }

  private openSocket(session: VoiceLiveSession) {
    const WebSocketCtor = this.webSocketCtor ?? WebSocket;
    this.socket = new WebSocketCtor(buildGeminiLiveWebSocketUrl(session.token));
    this.openedAt = performance.now();
    this.socket.onopen = () => {
      this.socket?.send(JSON.stringify(buildGeminiLiveSetupMessage(session, this.sessionHandle)));
      this.emit({
        type: 'usage',
        latencyMs: Math.round(performance.now() - this.openedAt),
        reconnectAttempt: this.reconnectAttempts,
      });
      this.emitStatus('listening');
    };
    this.socket.onmessage = (event) => {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      this.emit({ type: 'server-message', payload });
      const inputText = payload?.serverContent?.inputTranscription?.text;
      const outputText = payload?.serverContent?.outputTranscription?.text;
      if (typeof inputText === 'string' && inputText.trim()) {
        this.emit({ type: 'transcript', role: 'guest', text: inputText.trim() });
      }
      if (typeof outputText === 'string' && outputText.trim()) {
        this.emit({ type: 'transcript', role: 'assistant', text: outputText.trim() });
      }
      if (payload?.serverContent?.interrupted) {
        this.emit({ type: 'interrupted' });
        this.emitStatus('listening');
      }
      if (payload?.sessionResumptionUpdate?.newHandle) {
        this.sessionHandle = payload.sessionResumptionUpdate.newHandle;
      }
      if (payload?.serverContent?.modelTurn) this.emitStatus('speaking');
      if (payload?.serverContent?.turnComplete) this.emitStatus('listening');
      if (payload?.goAway) this.emitStatus('reconnecting');
      if (payload?.toolCall?.functionCalls) {
        void this.handleToolCalls(payload.toolCall.functionCalls as GeminiFunctionCall[]);
      }
    };
    this.socket.onerror = () => this.emitError(new Error('Live voice connection failed.'));
    this.socket.onclose = () => {
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (!this.activeSession || this.reconnectAttempts >= 3) {
      this.emitStatus('error');
      return;
    }
    this.reconnectAttempts += 1;
    this.emitStatus('reconnecting');
    this.emit({ type: 'usage', reconnectAttempt: this.reconnectAttempts });
    globalThis.setTimeout(() => {
      if (!this.stopped && this.activeSession) {
        this.openSocket(this.activeSession);
      }
    }, this.reconnectDelayMs);
  }

  private async handleToolCalls(functionCalls: GeminiFunctionCall[]) {
    const calls = functionCalls.map(mapGeminiFunctionCall).filter((call) => call !== null);
    this.emitStatus('thinking');
    this.emit({ type: 'tool-call', calls });

    const responses = await Promise.all(
      functionCalls.map(async (functionCall): Promise<GeminiFunctionResponse> => {
        if (functionCall.id && this.toolResponsesByCallId.has(functionCall.id)) {
          return this.toolResponsesByCallId.get(functionCall.id)!;
        }
        const mapped = mapGeminiFunctionCall(functionCall);
        if (!mapped || !this.executeToolCall) {
          const response = {
            id: functionCall.id ?? crypto.randomUUID(),
            name: functionCall.name ?? 'unknown',
            response: {
              error: {
                code: 'AI_TOOL_UNAUTHORIZED',
                message: 'Tool is not available for this guest session.',
              },
            },
          };
          if (functionCall.id) this.toolResponsesByCallId.set(functionCall.id, response);
          return response;
        }

        try {
          const result = await this.executeToolCall(mapped);
          const response = {
            id: mapped.id,
            name: mapped.geminiName,
            response: { result },
          };
          this.toolResponsesByCallId.set(mapped.id, response);
          return response;
        } catch (error) {
          const response = {
            id: mapped.id,
            name: mapped.geminiName,
            response: {
              error: {
                code: 'AI_TOOL_EXECUTION_FAILED',
                message: asError(error).message,
              },
            },
          };
          this.toolResponsesByCallId.set(mapped.id, response);
          return response;
        }
      }),
    );

    this.socket?.send(JSON.stringify(buildGeminiToolResponseMessage(responses)));
    this.emit({ type: 'tool-response', responses });
    this.emitStatus('listening');
  }

  private emitStatus(state: VoiceTransportState) {
    this.emit({ type: 'status', state });
  }

  private emitError(error: Error) {
    this.emit({ type: 'error', error });
  }

  private emit(event: VoiceTransportEvent) {
    this.onEvent?.(event);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
