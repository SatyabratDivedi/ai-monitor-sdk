import type { GovernXOneClient } from '../client';
import { OpenAiInstrumenter } from './openai';

/** Azure OpenAI uses the OpenAI client SDK with a custom base URL. */
export class AzureOpenAiInstrumenter extends OpenAiInstrumenter {
  constructor() {
    super('azure-openai', 'azure-openai');
  }
}
