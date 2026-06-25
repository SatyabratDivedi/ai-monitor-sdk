import { GovernXOneClient } from './client';
import { autoInstrument } from './auto-instrument';
import { resolveConfig } from './config';
import { isBrowser, warnOnce } from './runtime';
import type { GovernXOneConfig } from './types';

export const GovernXOne = {
  _client: null as GovernXOneClient | null,

  init(config: Partial<GovernXOneConfig> = {}): GovernXOneClient {
    if (GovernXOne._client) {
      return GovernXOne._client;
    }
    if (isBrowser()) {
      warnOnce('browser', '[governxone] Monitoring runs on the server only — skipped in browser');
      throw new Error('GovernXOne.init() must run on the server');
    }

    const client = new GovernXOneClient(config);
    GovernXOne._client = client;

    if (client.getConfig().autoInstrument !== false) {
      try {
        autoInstrument(client);
      } catch {
        /* non-fatal */
      }
    }
    return client;
  },

  ensureInit(config: Partial<GovernXOneConfig> = {}): GovernXOneClient | null {
    if (GovernXOne._client) {
      return GovernXOne._client;
    }
    if (isBrowser()) {
      return null;
    }

    try {
      resolveConfig(config, { requireApiKey: true });
    } catch {
      warnOnce(
        'missing-api-key',
        '[governxone] GOVERNXONE_API_KEY not set — monitoring disabled',
      );
      return null;
    }

    try {
      return GovernXOne.init(config);
    } catch (err) {
      warnOnce(
        'init-failed',
        `[governxone] Failed to initialize AI monitoring: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  },

  getClient(): GovernXOneClient {
    if (!GovernXOne._client) {
      throw new Error('GovernXOne.init() must be called before using the SDK');
    }
    return GovernXOne._client;
  },

  async flush(): Promise<void> {
    if (!GovernXOne._client) return;
    await GovernXOne._client.flush();
  },

  async shutdown(): Promise<void> {
    if (GovernXOne._client) {
      await GovernXOne._client.shutdown();
      GovernXOne._client = null;
    }
  },
};
