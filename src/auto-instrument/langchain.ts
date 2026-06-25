import type { GovernXOneClient } from '../client';
import { BaseInstrumenter, InstrumenterOptions } from '../providers/base';

/** Best-effort LangChain callback via ChatOpenAI invoke patch. */
export class LangChainInstrumenter extends BaseInstrumenter {
  readonly instrumenterName = 'langchain';
  readonly provider = 'langchain' as const;

  tryPatch(client: GovernXOneClient, options?: InstrumenterOptions): boolean {
    let lc: { ChatOpenAI?: new (...args: unknown[]) => { invoke?: (...a: unknown[]) => Promise<unknown> } };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      lc = require('@langchain/openai');
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        lc = require('langchain/chat_models/openai');
      } catch {
        return false;
      }
    }

    const ChatOpenAI = lc.ChatOpenAI;
    if (!ChatOpenAI?.prototype?.invoke) return false;

    const origInvoke = ChatOpenAI.prototype.invoke;
    const instrumenter = this;

    ChatOpenAI.prototype.invoke = async function (this: { modelName?: string }, ...args: unknown[]) {
      const started = Date.now();
      const model = this.modelName ?? 'langchain';
      const prompt = JSON.stringify(args[0] ?? '');

      try {
        const result = await origInvoke.apply(this, args);
        const response = typeof result === 'string' ? result : (result as { content?: string })?.content ?? JSON.stringify(result);
        instrumenter.trackInvocation(client, options, {
          model,
          prompt,
          response,
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
