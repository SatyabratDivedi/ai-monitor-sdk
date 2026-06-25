import type { GovernXOneClient } from '../client';
import { OpenAiInstrumenter } from './openai';
import { AnthropicInstrumenter } from './anthropic';
import { GoogleInstrumenter } from './google';
import { VercelAiInstrumenter } from './vercel-ai';
import { LangChainInstrumenter } from './langchain';

export interface InstrumenterOptions {
  maxPromptLength?: number;
  maxResponseLength?: number;
}

export interface InstrumentationResult {
  name: string;
  patched: boolean;
  error?: string;
}

const INSTRUMENTERS = [
  OpenAiInstrumenter,
  AnthropicInstrumenter,
  GoogleInstrumenter,
  VercelAiInstrumenter,
  LangChainInstrumenter,
] as const;

export function autoInstrument(
  client: GovernXOneClient,
  options: InstrumenterOptions = {},
): InstrumentationResult[] {
  const results: InstrumentationResult[] = [];
  for (const Ctor of INSTRUMENTERS) {
    const instance = new Ctor();
    try {
      const patched = instance.tryPatch(client, options);
      results.push({ name: instance.instrumenterName, patched });
    } catch (err) {
      results.push({
        name: instance.instrumenterName,
        patched: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
