import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const evidenceDir = resolve(process.cwd(), '../../evidence/phase-07/07.2/screenshots');

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

test('guest voice transport starts on mobile without relaying audio through backend', async ({
  page,
}) => {
  mkdirSync(evidenceDir, { recursive: true });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
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
        return { disconnect: () => undefined };
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
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.(new Event('open'));
        }, 0);
      }
      send(data: string) {
        this.sent.push(data);
        window.__guestportalVoiceSocketSetup = data;
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

  await page.goto('/g/voice-token/chat');
  await expect(page.getByTestId('guest-voice-shell'))
    .toBeVisible({ timeout: 30_000 })
    .catch((error: Error) => {
      throw new Error(`${error.message}\nBrowser errors:\n${pageErrors.join('\n')}`);
    });
  await page.getByTestId('guest-voice-start').click();
  await expect(page.getByTestId('guest-voice-status')).toHaveText('Đang nghe');

  const socketUrl = await page.evaluate(() => window.__guestportalVoiceSocketUrl);
  expect(socketUrl).toContain('generativelanguage.googleapis.com');
  expect(socketUrl).toContain('access_token=browser-ephemeral-token');
  expect(socketUrl).not.toContain('/v1/guest/');

  await page.screenshot({ path: resolve(evidenceDir, 'voice-mobile-390.png'), fullPage: true });
});

declare global {
  interface Window {
    __guestportalVoiceSocketUrl?: string;
    __guestportalVoiceSocketSetup?: string;
  }
}
