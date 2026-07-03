import { GovernXOne } from './sdk';

type ProviderLoader = () => unknown;

/**
 * Literal require() calls so bundlers (Next.js/Turbopack, webpack) can resolve modules.
 * Dynamic require(moduleId) fails with "expression is too dynamic" when bundled.
 */
const PROVIDER_LOADERS: Record<string, ProviderLoader> = {
  openai: () => require('openai'),
  '@anthropic-ai/sdk': () => require('@anthropic-ai/sdk'),
  '@google/generative-ai': () => require('@google/generative-ai'),
  '@langchain/openai': () => require('@langchain/openai'),
  'langchain/chat_models/openai': () => require('langchain/chat_models/openai'),
  langchain: () => require('langchain'),
  ai: () => require('ai'),
  '@vercel/ai': () => require('@vercel/ai'),
};

const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_LOADERS);

/**
 * Load an AI provider package after GovernXOne auto-instrumentation is registered.
 * Use this instead of a top-level `import` so patches apply before the provider module loads.
 */
export function loadProvider<T = unknown>(packageName: string): T {
  GovernXOne.ensureInit();
  const loader = PROVIDER_LOADERS[packageName];
  if (!loader) {
    throw new Error(
      `Unknown provider package "${packageName}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    );
  }
  return loader() as T;
}
