import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { backoffDelay, truncate, generateId, nowISO } from '../src/utils';
import { resolveConfig, createDefaultLogger } from '../src/config';
import { GovernXOneClient } from '../src/client';
import { GovernXOne } from '../src/sdk';
import { detectServerless } from '../src/runtime';

describe('utils', () => {
  it('generateId returns UUID format', () => {
    expect(generateId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('nowISO returns parseable date', () => {
    expect(Number.isNaN(Date.parse(nowISO()))).toBe(false);
  });

  it('truncate appends ellipsis when needed', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello world', 5)).toBe('hello…');
  });

  it('backoffDelay grows with attempt', () => {
    const d0 = backoffDelay(100, 0);
    const d2 = backoffDelay(100, 2);
    expect(d2).toBeGreaterThan(d0);
  });
});

describe('config', () => {
  it('throws without apiKey', () => {
    expect(() => resolveConfig({})).toThrow(/apiKey/);
  });

  it('merges defaults', () => {
    const cfg = resolveConfig({ apiKey: 'gxo_test' });
    expect(cfg.apiKey).toBe('gxo_test');
    expect(cfg.maxRetries).toBe(5);
    expect(cfg.batchSize).toBe(100);
  });

  it('defaults to localhost in development', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const cfg = resolveConfig({ apiKey: 'gxo_test' });
    expect(cfg.baseUrl).toBe('http://localhost:8000');
    process.env.NODE_ENV = prev;
  });

  it('silent logger when debug off', () => {
    const log = createDefaultLogger(false);
    expect(() => log.info('test')).not.toThrow();
  });
});

describe('GovernXOneClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, count: 1 }),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('track enqueues and returns id', () => {
    const client = new GovernXOneClient({ apiKey: 'gxo_test', flushIntervalMs: 60_000 });
    const id = client.track({
      provider: 'openai',
      model: 'gpt-4',
      prompt: 'hi',
      response: 'hello',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 50,
    });
    expect(id).toBeTruthy();
  });

  it('flush delivers batch to sdk endpoint', async () => {
    const client = new GovernXOneClient({ apiKey: 'gxo_test', flushIntervalMs: 60_000 });
    client.track({
      provider: 'openai',
      model: 'gpt-4',
      prompt: 'q',
      response: 'a',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 10,
    });
    await client.flush();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sdk/monitoring'),
      expect.objectContaining({ method: 'POST' }),
    );
    await client.shutdown();
  });
});

describe('GovernXOne', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    GovernXOne._client = null;
    delete process.env.GOVERNXONE_API_KEY;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, count: 1 }),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    GovernXOne._client = null;
    vi.restoreAllMocks();
  });

  it('ensureInit returns null without api key', () => {
    expect(GovernXOne.ensureInit()).toBeNull();
  });

  it('ensureInit is idempotent', () => {
    process.env.GOVERNXONE_API_KEY = 'gxo_test';
    const a = GovernXOne.ensureInit({ flushIntervalMs: 60_000 });
    const b = GovernXOne.ensureInit();
    expect(a).toBe(b);
  });
});

describe('runtime', () => {
  it('detectServerless when VERCEL is set', () => {
    const prev = process.env.VERCEL;
    process.env.VERCEL = '1';
    expect(detectServerless()).toBe(true);
    if (prev === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prev;
  });
});
