import { OpenAiInstrumenter } from './openai';

/** OpenRouter exposes an OpenAI-compatible API. */
export class OpenRouterInstrumenter extends OpenAiInstrumenter {
  constructor() {
    super('openrouter', 'openrouter');
  }
}
