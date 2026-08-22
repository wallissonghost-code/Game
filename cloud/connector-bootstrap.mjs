import { createRequire } from 'node:module';
import { TikTokLiveConnection } from 'tiktok-live-connector';
import { normalizeModernConnectError } from './tiktok-resilience.mjs';

const require = createRequire(import.meta.url);
const { WebcastPushConnection } = require('tiktok-live-connector-legacy');

// Guard the modern connector against an upstream 2.x failure seen in production:
// "Cannot read properties of undefined (reading 'retry-after')".
// Instead of allowing the server to enter a reconnect storm, normalize that
// specific compatibility failure into the existing legacy-fallback path.
const originalConnect = TikTokLiveConnection.prototype.connect;
if (typeof originalConnect === 'function' && !TikTokLiveConnection.prototype.__caosSafeConnect) {
  TikTokLiveConnection.prototype.connect = async function (...args) {
    try {
      return await originalConnect.apply(this, args);
    } catch (error) {
      throw normalizeModernConnectError(error);
    }
  };
  Object.defineProperty(TikTokLiveConnection.prototype, '__caosSafeConnect', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

// The modern connector can route gift-catalog/signing requests through EulerStream.
// On Community/free plans that route may reject with "Business plan". Keep the
// normal modern path first, then fall back to the already-installed legacy
// connector, whose getAvailableGifts() talks to the TikTok webcast route.
const originalFetchAvailableGifts = TikTokLiveConnection.prototype.fetchAvailableGifts;

if (typeof originalFetchAvailableGifts === 'function') {
  TikTokLiveConnection.prototype.fetchAvailableGifts = async function (...args) {
    try {
      return await originalFetchAvailableGifts.apply(this, args);
    } catch (error) {
      const message = String(error?.message || error || '');
      const paywall = /business plan|fetchwebcastsignature|eulerstream/i.test(message);
      if (!paywall) throw error;

      const username = String(
        this.uniqueId || this.uniqueID || this.username || this.options?.uniqueId || this.options?.username || ''
      ).replace(/^@/, '');
      if (!username) {
        const wrapped = new Error(`Catálogo moderno bloqueado e fallback sem @ da Live: ${message}`);
        wrapped.cause = error;
        throw wrapped;
      }

      const legacy = new WebcastPushConnection(username, {
        processInitialData: false,
        fetchRoomInfoOnConnect: true,
        enableExtendedGiftInfo: false,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 1000
      });

      try {
        // v1.2.3 documents getAvailableGifts() as callable even while disconnected.
        // Try it first so catalog capture does not require another live websocket.
        if (typeof legacy.getAvailableGifts !== 'function') {
          throw new Error('Legacy connector não expõe getAvailableGifts().');
        }
        try {
          return await legacy.getAvailableGifts();
        } catch (firstError) {
          // Some TikTok responses require the room to be resolved first.
          await legacy.connect();
          return await legacy.getAvailableGifts();
        }
      } finally {
        try { legacy.removeAllListeners?.(); } catch {}
        try { legacy.disconnect?.(); } catch {}
      }
    }
  };
}

await import('./connector-server.mjs');
