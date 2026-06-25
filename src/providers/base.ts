import type { GovernXOneClient } from '../client';
import type { AIProvider } from '../types';
import { nowISO, truncate } from '../utils';

export interface InstrumenterOptions {
  maxPromptLength?: number;
  maxResponseLength?: number;
}

export abstract class BaseInstrumenter {
  abstract readonly instrumenterName: string;
  abstract readonly provider: AIProvider;

  abstract tryPatch(client: GovernXOneClient, options?: InstrumenterOptions): boolean;

  protected trackInvocation(
    client: GovernXOneClient,
    opts: InstrumenterOptions | undefined,
    data: {
      model: string;
      prompt: string;
      response: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
      metadata?: Record<string, unknown>;
      error?: string;
    },
  ): void {
    const DEFAULT_MAX = 32_000;
    const maxP = opts?.maxPromptLength ?? DEFAULT_MAX;
    const maxR = opts?.maxResponseLength ?? DEFAULT_MAX;

    try {
      client.track({
        provider: this.provider,
        model: data.model,
        prompt: truncate(data.prompt, maxP),
        response: truncate(data.response, maxR),
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        latencyMs: data.latencyMs,
        metadata: {
          ...data.metadata,
          capturedAt: nowISO(),
        },
        ...(data.error ? { status: 'error' as const, error: data.error } : {}),
      });
    } catch {
      /* never crash host app */
    }
  }
}
