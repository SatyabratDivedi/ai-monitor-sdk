import type { GovernXOneClient } from '../client';
import { BaseInstrumenter, InstrumenterOptions } from '../providers/base';

/** Patches Vercel AI SDK `generateText` when the `ai` package is installed. */
export class VercelAiInstrumenter extends BaseInstrumenter {
  readonly instrumenterName = 'ai';
  readonly provider = 'vercel-ai' as const;

  tryPatch(client: GovernXOneClient, options?: InstrumenterOptions): boolean {
    let ai: { generateText?: (...args: unknown[]) => Promise<unknown> };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ai = require('ai');
    } catch {
      return false;
    }

    const orig = ai.generateText;
    if (typeof orig !== 'function') return false;

    const instrumenter = this;

    ai.generateText = async (...args: unknown[]) => {
      const [params] = args as [{ model?: { modelId?: string }; prompt?: string; messages?: unknown }];
      const started = Date.now();
      const model =
        (params?.model as { modelId?: string })?.modelId ??
        (params?.model as string) ??
        'unknown';
      const prompt =
        params?.prompt ??
        (Array.isArray(params?.messages)
          ? JSON.stringify(params.messages)
          : String(params?.messages ?? ''));

      try {
        const result = await orig(...args);
        const typed = result as { text?: string; usage?: { promptTokens?: number; completionTokens?: number } };
        instrumenter.trackInvocation(client, options, {
          model,
          prompt,
          response: typed.text ?? '',
          inputTokens: typed.usage?.promptTokens ?? 0,
          outputTokens: typed.usage?.completionTokens ?? 0,
          latencyMs: Date.now() - started,
        });
        return result;
      } catch (err) {
        instrumenter.trackInvocation(client, options, {
          model,
          prompt,
          response: '',
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    return true;
  }
}
