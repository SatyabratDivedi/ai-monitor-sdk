import type { GovernXOneClient } from '../client';
import type { AIProvider } from '../types';
import { BaseInstrumenter, InstrumenterOptions } from '../providers/base';

const PACKAGE = 'openai';

function messagesToPrompt(messages: unknown): string {
  if (!Array.isArray(messages)) return JSON.stringify(messages ?? '');
  return messages
    .map((m: { role?: string; content?: unknown }) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `${m.role ?? 'user'}: ${content}`;
    })
    .join('\n');
}

function extractUsage(result: {
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}): { inputTokens: number; outputTokens: number } {
  const u = result?.usage;
  return {
    inputTokens: u?.prompt_tokens ?? 0,
    outputTokens: u?.completion_tokens ?? 0,
  };
}

export class OpenAiInstrumenter extends BaseInstrumenter {
  readonly instrumenterName: string;
  readonly provider: AIProvider;

  constructor(instrumenterName = PACKAGE, provider: AIProvider = 'openai') {
    super();
    this.instrumenterName = instrumenterName;
    this.provider = provider;
  }

  tryPatch(client: GovernXOneClient, options?: InstrumenterOptions): boolean {
    let openai: { default?: unknown; OpenAI?: unknown };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      openai = require(PACKAGE);
    } catch {
      return false;
    }

    const OpenAI = (openai.default ?? openai.OpenAI ?? openai) as {
      prototype?: { chat?: { completions?: { create?: (...args: unknown[]) => Promise<unknown> } } };
    };
    const origCreate = OpenAI?.prototype?.chat?.completions?.create;
    if (!origCreate) return false;

    const instrumenter = this;

    OpenAI.prototype!.chat!.completions!.create = async function (
      this: unknown,
      ...args: unknown[]
    ) {
      const [params] = args as [{ model?: string; messages?: unknown; stream?: boolean }];
      const started = Date.now();
      const model = params?.model ?? 'unknown';
      const prompt = messagesToPrompt(params?.messages);

      try {
        const result = await origCreate.apply(this, args);

        if (params?.stream && result && typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
          const originalStream = result as AsyncIterable<{
            choices?: { delta?: { content?: string } }[];
          }>;
          return (async function* () {
            const chunks: string[] = [];
            for await (const chunk of originalStream) {
              const text = chunk.choices?.[0]?.delta?.content ?? '';
              if (text) chunks.push(text);
              yield chunk;
            }
            instrumenter.trackInvocation(client, options, {
              model,
              prompt,
              response: chunks.join(''),
              latencyMs: Date.now() - started,
            });
          })();
        }

        const typed = result as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const response = typed.choices?.[0]?.message?.content ?? '';
        const usage = extractUsage(typed);
        instrumenter.trackInvocation(client, options, {
          model,
          prompt,
          response,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
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
