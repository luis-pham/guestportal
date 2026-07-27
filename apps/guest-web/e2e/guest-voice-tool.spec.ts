import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const evidenceDir = resolve(process.cwd(), '../../evidence/phase-07/07.3/screenshots');

const portalResponse = {
  locale: 'vi',
  property: {
    name: 'Aurora Hotel',
    slug: 'aurora',
    timezone: 'Asia/Ho_Chi_Minh',
    defaultLocale: 'vi',
    supportedLocales: ['vi', 'en'],
  },
  location: {
    code: 'A101',
    name: { vi: 'Phòng A101', en: 'Room A101' },
  },
  destination: { type: 'guest_home' },
  branding: {
    primaryColor: '#14734f',
    secondaryColor: '#fffdf8',
    accentColor: '#2563eb',
    logoUrl: null,
    coverUrl: null,
  },
  portal: {
    versionNumber: 1,
    publishedAt: '2026-07-27T00:00:00.000Z',
    config: {
      schemaVersion: 1,
      greeting: { vi: 'Xin chào', en: 'Hello' },
      assistant: {
        name: { vi: 'Aurora Assistant', en: 'Aurora Assistant' },
        avatarAssetId: null,
      },
      primaryNavigation: [],
      secondaryNavigation: [],
      sections: [],
    },
  },
  fallbacks: {
    missingLogo: true,
    missingCover: true,
  },
};

test('voice tool call creates a draft and requires guest confirmation', async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true });
  let toolResultRequests = 0;
  let confirmRequests = 0;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const track = { stop: () => undefined };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [track] }),
      },
    });

    class FakeAudioWorkletNode {
      constructor() {
        return {
          port: { onmessage: null },
          disconnect: () => undefined,
        };
      }
    }
    class FakeAudioContext {
      state = 'running';
      audioWorklet = { addModule: async () => undefined };
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
      async close() {
        this.state = 'closed';
      }
    }
    const NativeWebSocket = window.WebSocket;
    class FakeGeminiWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      CONNECTING = 0;
      OPEN = 1;
      readyState = 0;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      sent: string[] = [];
      constructor(readonly url: string) {
        window.__guestportalVoiceSocketUrl = url;
        window.__guestportalGeminiSocketSent = this.sent;
        window.__guestportalGeminiSocketEmit = (payload: unknown) => {
          this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
        };
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.(new Event('open'));
        }, 0);
      }
      send(data: string) {
        this.sent.push(data);
      }
      close() {
        this.readyState = 3;
        this.onclose?.(new CloseEvent('close'));
      }
    }
    function GuestPortalWebSocket(url: string | URL, protocols?: string | string[]) {
      const target = String(url);
      if (target.includes('generativelanguage.googleapis.com')) {
        return new FakeGeminiWebSocket(target);
      }
      return new NativeWebSocket(url, protocols);
    }
    GuestPortalWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    GuestPortalWebSocket.OPEN = NativeWebSocket.OPEN;
    GuestPortalWebSocket.CLOSING = NativeWebSocket.CLOSING;
    GuestPortalWebSocket.CLOSED = NativeWebSocket.CLOSED;
    GuestPortalWebSocket.prototype = NativeWebSocket.prototype;

    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    window.AudioWorkletNode = FakeAudioWorkletNode as unknown as typeof AudioWorkletNode;
    window.WebSocket = GuestPortalWebSocket as unknown as typeof WebSocket;
  });

  await page.route('**/v1/guest/sessions', async (route) => {
    await route.fulfill({ json: { session: { locale: 'vi' } } });
  });
  await page.route('**/v1/guest/portal', async (route) => {
    await route.fulfill({ json: portalResponse });
  });
  await page.route('**/v1/guest/conversations', async (route) => {
    await route.fulfill({
      json: {
        conversation: {
          id: '6bdbe827-771b-4cb9-9d6b-348a8fa7295a',
          status: 'active',
          locale: 'vi',
          retentionPolicy: 'standard_30_days',
          retentionExpiresAt: '2026-08-26T00:00:00.000Z',
          lastMessageSequence: 0,
          handedOffAt: null,
          closedAt: null,
          createdAt: '2026-07-27T00:00:00.000Z',
          updatedAt: '2026-07-27T00:00:00.000Z',
        },
      },
    });
  });
  await page.route('**/v1/guest/live-sessions', async (route) => {
    await route.fulfill({
      json: {
        liveSession: {
          token: 'browser-ephemeral-token',
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
        },
      },
    });
  });
  await page.route('**/v1/guest/conversations/*/tool-results', async (route) => {
    toolResultRequests += 1;
    const body = route.request().postDataJSON() as {
      toolName: string;
      input: { title: string; details: string };
    };
    expect(body.toolName).toBe('request.draft');
    expect(body.input.title).toBe('Extra towels');
    await route.fulfill({
      json: {
        toolName: 'request.draft',
        result: {
          draft: {
            id: '55555555-5555-4555-8555-555555555555',
            conversationId: '6bdbe827-771b-4cb9-9d6b-348a8fa7295a',
            status: 'draft',
            requestType: 'housekeeping',
            title: body.input.title,
            details: body.input.details,
            locale: 'vi',
            metadata: {},
            expiresAt: '2026-07-27T01:00:00.000Z',
            confirmedRequestId: null,
            createdAt: '2026-07-27T00:00:00.000Z',
            updatedAt: '2026-07-27T00:00:00.000Z',
          },
        },
      },
    });
  });
  await page.route('**/v1/guest/request-drafts/*/confirm', async (route) => {
    confirmRequests += 1;
    const body = route.request().postDataJSON() as { idempotencyKey: string };
    expect(body.idempotencyKey).toBe(
      'voice-request-confirm-55555555-5555-4555-8555-555555555555',
    );
    await route.fulfill({
      json: {
        request: {
          id: '77777777-7777-4777-8777-777777777777',
          conversationId: '6bdbe827-771b-4cb9-9d6b-348a8fa7295a',
          draftId: '55555555-5555-4555-8555-555555555555',
          status: 'submitted',
          requestType: 'housekeeping',
          title: 'Extra towels',
          details: 'Two towels please',
          locale: 'vi',
          metadata: {},
          submittedAt: '2026-07-27T00:01:00.000Z',
        },
        idempotentReplay: false,
      },
    });
  });

  await page.goto('/g/voice-token/chat');
  await expect(page.getByTestId('guest-voice-shell')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('guest-voice-start').click();
  await expect(page.getByTestId('guest-voice-status')).toHaveText('Đang nghe');

  const setup = await page.evaluate(() => JSON.parse(window.__guestportalGeminiSocketSent![0]!));
  expect(setup.setup.tools[0].functionDeclarations.map((tool: { name: string }) => tool.name))
    .toContain('request_draft');
  expect(setup.setup.tools[0].functionDeclarations.map((tool: { name: string }) => tool.name))
    .not.toContain('request_confirm');

  await page.evaluate(() => {
    window.__guestportalGeminiSocketEmit?.({
      toolCall: {
        functionCalls: [
          {
            id: 'voice-call-1',
            name: 'request_draft',
            args: {
              requestType: 'housekeeping',
              title: 'Extra towels',
              details: 'Two towels please',
              locale: 'vi',
            },
          },
        ],
      },
    });
  });

  await expect(page.getByTestId('chat-confirmation-card')).toBeVisible();
  const toolResponse = await page.waitForFunction(() => {
    const sent = window.__guestportalGeminiSocketSent ?? [];
    return sent.length > 1 ? JSON.parse(sent[1]!) : null;
  });
  const body = await toolResponse.jsonValue();
  expect(body.toolResponse.functionResponses[0]).toMatchObject({
    id: 'voice-call-1',
    name: 'request_draft',
  });
  expect(toolResultRequests).toBe(1);
  expect(confirmRequests).toBe(0);

  await page.screenshot({
    path: resolve(evidenceDir, 'voice-tool-confirmation-390.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã xác nhận')).toBeVisible();
  expect(confirmRequests).toBe(1);
});

declare global {
  interface Window {
    __guestportalVoiceSocketUrl?: string;
    __guestportalGeminiSocketSent?: string[];
    __guestportalGeminiSocketEmit?: (payload: unknown) => void;
  }
}
