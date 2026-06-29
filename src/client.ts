import EventEmitter from 'events';
import { MonitoringPayload, MonitoringResponse, GovernXOneConfig, Logger, TrackPayload } from './types';
import { resolveConfig, createDefaultLogger } from './config';
import { generateId, nowISO, backoffDelay } from './utils';

/**
 * GovernXOneClient — the main entry point for monitoring AI model invocations.
 */
export class GovernXOneClient extends EventEmitter {
  private readonly config: Required<GovernXOneConfig>;
  private readonly logger: Logger;
  private readonly queue: MonitoringPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly agent: string;

  constructor(userConfig: Partial<GovernXOneConfig>) {
    super();
    this.config = resolveConfig(userConfig) as Required<GovernXOneConfig>;
    this.logger = this.config.logger ?? createDefaultLogger(this.config.debug);

    this.agent = [
      `governxone-ai-monitor`,
      this.config.appVersion ?? '1.0.0',
      this.config.appName ?? '',
    ]
      .filter(Boolean)
      .join('/');

    this.startFlushLoop();
    if (this.config.serverless && typeof process !== 'undefined') {
      process.once('beforeExit', () => {
        void this.flush();
      });
    }
    this.logger.info('GovernXOne client initialised', {
      environment: this.config.environment,
      projectId: this.config.projectId,
    });
  }

  /**
   * Enqueue a model invocation for asynchronous batch delivery.
   * Returns the generated payload id so callers can correlate responses.
   */
  track(partial: TrackPayload): string {
    const metadata = { ...(partial.metadata ?? {}) };
    if (partial.sessionId) metadata.sessionId = partial.sessionId;
    if (partial.userId) metadata.userId = partial.userId;
    if (partial.requestId) metadata.requestId = partial.requestId;
    if (partial.error) metadata.error = partial.error;

    const payload: MonitoringPayload & {
      status?: string;
      error?: string;
      totalTokens?: number;
      estimatedCost?: number;
    } = {
      id: generateId(),
      timestamp: nowISO(),
      environment: this.config.environment,
      provider: partial.provider,
      model: partial.model,
      prompt: partial.prompt,
      response: partial.response,
      inputTokens: partial.inputTokens,
      outputTokens: partial.outputTokens,
      latencyMs: partial.latencyMs,
      metadata,
      status: partial.status ?? (partial.error ? 'error' : 'success'),
      totalTokens: partial.totalTokens ?? partial.inputTokens + partial.outputTokens,
      estimatedCost: partial.estimatedCost,
      error: partial.error,
    };

    if (this.queue.length >= this.config.maxQueueSize) {
      const dropped = this.queue.shift()!;
      this.logger.warn('Queue full, dropping oldest payload', { droppedId: dropped.id });
    }

    this.queue.push(payload as MonitoringPayload);
    this.logger.debug('Payload enqueued', { id: payload.id, provider: payload.provider });
    this.emit('enqueued', payload);
    if (this.config.serverless) {
      this.scheduleDebouncedFlush();
    }
    return payload.id;
  }

  /** Immediately flush all queued payloads. */
  async flush(): Promise<void> {
    if (this.flushing) {
      return new Promise((resolve) => this.once('flushed', resolve));
    }
    return this._flush();
  }

  /** Gracefully shut down — flush remaining payloads and stop the timer. */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down GovernXOne client');
    this.stopFlushLoop();
    await this.flush();
    this.removeAllListeners();
  }

  private startFlushLoop(): void {
    this.flushTimer = setInterval(() => this._flush(), this.config.flushIntervalMs);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  private stopFlushLoop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.flushDebounceTimer) {
      clearTimeout(this.flushDebounceTimer);
      this.flushDebounceTimer = null;
    }
  }

  private scheduleDebouncedFlush(): void {
    if (this.flushDebounceTimer) {
      clearTimeout(this.flushDebounceTimer);
    }
    this.flushDebounceTimer = setTimeout(() => {
      this.flushDebounceTimer = null;
      void this.flush();
    }, 50);
    if (this.flushDebounceTimer.unref) {
      this.flushDebounceTimer.unref();
    }
  }

  private async _flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;

    this.flushing = true;
    const batch = this.queue.splice(0, this.config.batchSize);

    try {
      await this.deliverBatch(batch, 0);
    } catch (err) {
      this.logger.error('Batch delivery failed after all retries', err);
      this.queue.unshift(...batch);
    } finally {
      this.flushing = false;
      this.emit('flushed');
    }
  }

  private async deliverBatch(
    batch: MonitoringPayload[],
    attempt: number,
  ): Promise<MonitoringResponse> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/api/v1/sdk/monitoring`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'User-Agent': this.agent,
        },
        body: JSON.stringify({ projectId: this.config.projectId, payloads: batch }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      this.logger.debug('Batch delivered', { size: batch.length, attempt });
      return (await res.json()) as MonitoringResponse;
    } catch (err) {
      if (attempt < this.config.maxRetries) {
        const delay = backoffDelay(this.config.backoffBaseMs, attempt);
        this.logger.warn(`Delivery failed (attempt ${attempt + 1}), retrying in ${delay}ms`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.deliverBatch(batch, attempt + 1);
      }
      throw err;
    }
  }

  getConfig(): GovernXOneConfig {
    return this.config;
  }
}
