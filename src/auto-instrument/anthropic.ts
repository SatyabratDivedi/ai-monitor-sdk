import type { GovernXOneClient } from '../client';
import { BaseInstrumenter, InstrumenterOptions } from '../providers/base';

const PACKAGE = '@anthropic-ai/sdk';

function messagesToPrompt(messages: unknown): string {
  if (!Array.isArray(messages)) return JSON.stringify(messages ?? '');
  return messages
    .map((m: { role?: string; content?: unknown }) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `${m.role ?? 'user'}: ${content}`;
    })
    .join('\n');
}

export class AnthropicInstrumenter extends BaseInstrumenter {
  readonly instrumenterName = PACKAGE;
  readonly provider = 'claude' as const;

  tryPatch(client: GovernXOneClient, options?: InstrumenterOptions): boolean {
    let sdk: { default?: unknown; Anthropic?: unknown };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      sdk = require(PACKAGE);
    } catch {
      return false;
    }

    const Anthropic = (sdk.default ?? sdk.Anthropic ?? sdk) as {
      prototype?: { messages?: { create?: (...args: unknown[]) => Promise<unknown> } };
    };
    const origCreate = Anthropic?.prototype?.messages?.create;
    if (!origCreate) return false;

    const instrumenter = this;

    Anthropic.prototype!.messages!.create = async function (this: unknown, ...args: unknown[]) {
      const [params] = args as [{ model?: string; messages?: unknown }];
      const started = Date.now();
      const model = params?.model ?? 'unknown';
      const prompt = messagesToPrompt(params?.messages);

      try {
        const result = await origCreate.apply(this, args);
        const typed = result as {
          content?: { type?: string; text?: string }[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const response =
          typed.content
            ?.filter((b) => b.type === 'text')
            .map((b) => b.text ?? '')
            .join('') ?? '';

        instrumenter.trackInvocation(client, options, {
          model,
          prompt,
          response,
          inputTokens: typed.usage?.input_tokens ?? 0,
          outputTokens: typed.usage?.output_tokens ?? 0,
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
