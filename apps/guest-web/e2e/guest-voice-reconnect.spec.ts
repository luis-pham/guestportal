import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const evidenceDir = resolve(process.cwd(), '../../evidence/phase-07/07.4/screenshots');

const conversationId = '6bdbe827-771b-4cb9-9d6b-348a8fa7295a';
const portalResponse = {
  locale: 'vi',
  property: {
    name: 'Aurora Hotel',
    slug: 'aurora',
    timezone: 'Asia/Ho_Chi_Minh',
    defaultLocale: 'vi',
    supportedLocales: ['vi', 'en'],
  },
  location: { code: 'A101', name: { vi: 'Phòng A101', en: 'Room A101' } },
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
      assistant: { name: { vi: 'Aurora Assistant', en: 'Aurora Assistant' }, avatarAssetId: null },
      primaryNavigation: [],
      secondaryNavigation: [],
      sections: [],
    },
  },
  fallbacks: { missingLogo: true, missingCover: true },
};

test('voice transcript interruption and reconnect remain visible on mobile', async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true });
  const metricEvents: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) },
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
      sent: string[] = [];
      constructor(readonly url: string) {
        window.__guestportalGeminiSockets = [
          ...(window.__guestportalGeminiSockets ?? []),
          this,
        ];
        window.__guestportalGeminiSocketEmit = (payload: unknown) => {
          this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
        };
        window.__guestportalGeminiSocketClose = () => {
          this.readyState = 3;
          this.onclose?.(new CloseEvent('close'));
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
          id: conversationId,
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
          conversationId,
          locale: 'vi',
          newSessionExpiresAt: '2026-07-27T00:01:00.000Z',
          expiresAt: '2026-07-27T00:30:00.000Z',
          uses: 1,
          constraints: { responseModalities: ['AUDIO'], sessionResumption: true },
        },
      },
    });
  });
  await page.route('**/v1/guest/conversations/*/voice-metrics', async (route) => {
    const body = route.request().postDataJSON() as { eventName: string };
    metricEvents.push(body.eventName);
    await route.fulfill({
      json: {
        metric: {
          conversationId,
          eventName: body.eventName,
          acceptedAt: '2026-07-27T00:00:00.000Z',
        },
      },
    });
  });

  await page.goto('/g/voice-token/chat');
  await page.getByTestId('guest-voice-start').click();
  await expect(page.getByTestId('guest-voice-status')).toHaveText('Đang nghe');
  await page.evaluate(() => {
    window.__guestportalGeminiSocketEmit?.({
      sessionResumptionUpdate: { newHandle: 'resume-1', resumable: true },
    });
    window.__guestportalGeminiSocketEmit?.({
      serverContent: {
        inputTranscription: { text: 'Xin thêm khăn' },
        outputTranscription: { text: 'Tôi sẽ chuẩn bị.' },
      },
    });
    window.__guestportalGeminiSocketEmit?.({ serverContent: { interrupted: true } });
    window.__guestportalGeminiSocketClose?.();
  });

  await expect(page.getByText('Xin thêm khăn')).toBeVisible();
  await expect(page.getByText('Tôi sẽ chuẩn bị.')).toBeVisible();
  await expect(page.getByText('Phản hồi đã được ngắt.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__guestportalGeminiSockets?.length ?? 0))
    .toBeGreaterThan(1);
  await expect.poll(() => metricEvents).toContain('transcript_received');
  await expect.poll(() => metricEvents).toContain('interrupted');
  await expect.poll(() => metricEvents).toContain('reconnect_attempt');

  const reconnectSetup = await page.evaluate(() => {
    const sockets = window.__guestportalGeminiSockets ?? [];
    return JSON.parse(sockets[1]!.sent[0]!);
  });
  expect(reconnectSetup.setup.sessionResumption).toEqual({ handle: 'resume-1' });
  await page.screenshot({
    path: resolve(evidenceDir, 'voice-transcript-reconnect-390.png'),
    fullPage: true,
  });
});

declare global {
  interface Window {
    __guestportalGeminiSockets?: Array<{ sent: string[] }>;
    __guestportalGeminiSocketEmit?: (payload: unknown) => void;
    __guestportalGeminiSocketClose?: () => void;
  }
}
