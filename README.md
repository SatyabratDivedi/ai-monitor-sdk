# @governxone/ai-monitor

Production-ready AI Monitoring SDK for **GovernXOne**. Install once, load your AI provider through `loadProvider()`, and every supported call is automatically intercepted and sent to your GovernXOne backend — no wrappers, no manual logging.

## Installation

```bash
npm install @governxone/ai-monitor
```

Install the AI provider package(s) you use alongside the monitor:

```bash
# Pick the providers you need
npm install openai
npm install @anthropic-ai/sdk
npm install @google/generative-ai
npm install @langchain/openai
npm install ai
```

> **Using Next.js?** You must configure `serverExternalPackages` in `next.config.ts` before using `loadProvider()`. See [Next.js setup](#nextjs-setup).

## How monitoring works

GovernXOne patches AI provider SDKs at runtime. For patches to apply **before** the provider module loads, you must load providers through `loadProvider()` instead of a top-level `import`.

```ts
import { loadProvider } from '@governxone/ai-monitor';

// ❌ Do not do this — the module may load before instrumentation runs
// import OpenAI from 'openai';

// ✅ Load through the SDK so monitoring is active first
const { default: OpenAI } = loadProvider<typeof import('openai')>('openai');
```

`loadProvider()` does two things:

1. Calls `GovernXOne.ensureInit()` — reads `GOVERNXONE_API_KEY`, `GOVERNXONE_PROJECT_ID` (and other env vars), registers auto-instrumentation hooks.
2. `require()`s the provider package — your app gets the same exports you would from a normal import.

After that, use the provider exactly as you normally would. Prompts, responses, token usage, latency, and errors are captured automatically.

## Setup

Set your API key and project ID (create an API key in the GovernXOne dashboard under **SDK Monitoring**; use the AI system ID from your project):

```bash
GOVERNXONE_API_KEY=gxo_live_...
GOVERNXONE_PROJECT_ID=abc12345
GOVERNXONE_ENDPOINT=https://governxone.com
GOVERNXONE_ENVIRONMENT=production                # optional
```

The SDK posts to `{GOVERNXONE_ENDPOINT}/api/v1/sdk/monitoring`. With the endpoint above, that resolves to:

`https://governxone.com/api/v1/sdk/monitoring`

Do **not** include `/api` in `GOVERNXONE_ENDPOINT` — the SDK adds `/api/v1/sdk/monitoring` itself.

No explicit `init()` call is required when using `loadProvider()` — initialization happens automatically.

### Optional explicit init

```ts
import { GovernXOne } from '@governxone/ai-monitor';

GovernXOne.init({
  apiKey: process.env.GOVERNXONE_API_KEY,
  projectId: process.env.GOVERNXONE_PROJECT_ID,
});
```

### Side-effect register (optional early bootstrap)

Import this once at the top of your server entry so instrumentation is ready before any route handlers run:

```ts
import '@governxone/ai-monitor/register';
```

You still need `loadProvider()` for each AI SDK package — `register` only initializes the monitor.

> **Next.js users:** You must also configure `next.config.ts` — see [Next.js setup](#nextjs-setup) below.

---

## Provider guides

All examples below use `loadProvider()` — this is the **only** supported way to enable automatic log capture.

### Google Gemini (`@google/generative-ai`)

```bash
npm install @google/generative-ai
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { GoogleGenerativeAI } = loadProvider<typeof import('@google/generative-ai')>(
  '@google/generative-ai',
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const result = await model.generateContent('Explain GDPR in one paragraph.');
console.log(result.response.text());
```

**What gets tracked:** `generateContent` calls — prompt, response text, token counts, latency, and errors.

---

### OpenAI (`openai`)

```bash
npm install openai
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { default: OpenAI } = loadProvider<typeof import('openai')>('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Summarize EU AI Act Article 5.' }],
});

console.log(completion.choices[0].message.content);
```

**What gets tracked:** `chat.completions.create` — including streaming responses (chunks are aggregated before logging).

---

### Anthropic Claude (`@anthropic-ai/sdk`)

```bash
npm install @anthropic-ai/sdk
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { default: Anthropic } = loadProvider<typeof import('@anthropic-ai/sdk')>(
  '@anthropic-ai/sdk',
);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'List three AI governance best practices.' }],
});

console.log(message.content[0].type === 'text' ? message.content[0].text : '');
```

**What gets tracked:** `messages.create` — prompt, response text, input/output tokens, latency, and errors.

---

### Azure OpenAI (`openai`)

Azure uses the same `openai` package with a custom base URL.

```bash
npm install openai
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { AzureOpenAI } = loadProvider<typeof import('openai')>('openai');

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-15-preview',
});

const completion = await client.chat.completions.create({
  model: process.env.AZURE_OPENAI_DEPLOYMENT!,
  messages: [{ role: 'user', content: 'Hello from Azure OpenAI.' }],
});
```

**What gets tracked:** Same as OpenAI — `chat.completions.create` calls are logged with provider `azure-openai`.

---

### OpenRouter (`openai`)

OpenRouter exposes an OpenAI-compatible API. Load the `openai` package and point it at OpenRouter.

```bash
npm install openai
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { default: OpenAI } = loadProvider<typeof import('openai')>('openai');

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const completion = await client.chat.completions.create({
  model: 'anthropic/claude-3.5-sonnet',
  messages: [{ role: 'user', content: 'Route this through OpenRouter.' }],
});
```

**What gets tracked:** Same as OpenAI — logged with provider `openrouter`.

---

### LangChain (`@langchain/openai`)

```bash
npm install @langchain/openai
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { ChatOpenAI } = loadProvider<typeof import('@langchain/openai')>('@langchain/openai');

const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const response = await model.invoke('What is model risk management?');
console.log(response.content);
```

**What gets tracked:** `ChatOpenAI.invoke` — prompt, response, latency, and errors.

> **Legacy path:** If you use the older `langchain/chat_models/openai` import path, pass `'langchain/chat_models/openai'` to `loadProvider()`.

---

### Vercel AI SDK (`ai`)

```bash
npm install ai
```

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { generateText } = loadProvider<typeof import('ai')>('ai');
const { openai } = loadProvider<typeof import('@ai-sdk/openai')>('@ai-sdk/openai');

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Write a compliance checklist for AI systems.',
});

console.log(text);
```

> Install `@ai-sdk/openai` (or your model provider) separately. Load every AI-related package through `loadProvider()` before use.

**What gets tracked:** `generateText` — prompt, response text, token usage, latency, and errors.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `GOVERNXONE_API_KEY` | Your organization API key (required for monitoring) |
| `GOVERNXONE_PROJECT_ID` | GovernXOne project (AI system) ID — scopes monitoring to that project (required) |
| `GOVERNXONE_ENDPOINT` | API host only (production: `https://governxone.com`) — SDK appends `/api/v1/sdk/monitoring` |
| `GOVERNXONE_ENVIRONMENT` | `production`, `staging`, or `development` (default: matches `NODE_ENV`) |
| `GOVERNXONE_DEBUG` | Set to `true` for verbose SDK logs |
| `GOVERNXONE_SERVERLESS` | Set to `true` to force serverless flush mode (auto-detected on Vercel, Lambda, Netlify) |
| `GOVERNXONE_SAMPLE_RATE` | Percentage `0`–`100` of responses to store (default `100`). Overridden by the project's dashboard setting unless remote sampling is disabled |
| `GOVERNXONE_REMOTE_SAMPLING` | Set to `false` to ignore the dashboard sampling rate and use the local value only |
| `GOVERNXONE_CLIENT_SAMPLING` | `true`/`false` to force client-side dropping on/off (default: on for long-running servers, off in serverless where the backend samples) |

## Data collection sampling

You can capture only a percentage of AI responses instead of all of them — useful
for cost control and high-volume workloads. Set the rate **per project** from the
GovernXOne dashboard (SDK Monitoring → Settings) or locally via `sampleRate`.

```ts
GovernXOne.init({ sampleRate: 30 }); // store ~3 of every 10 responses
```

Client-side sampling is probabilistic: each call is kept independently with a
`sampleRate / 100` chance. This is stateless so it works correctly in serverless
and per-request environments (where in-memory state resets on every invocation).
The dashboard value is fetched at startup and refreshed periodically, so changing
it takes effect without redeploying. On long-running servers the SDK drops
non-sampled calls client-side (saving bandwidth) and marks kept records so the
backend does not re-sample them; in serverless environments the backend applies
sampling authoritatively via a database-persisted token bucket that enforces the
exact rate.

## Next.js setup

Next.js (especially with Turbopack) bundles server code. Without configuration, `loadProvider()` can fail at runtime with:

```text
Error: Cannot find module as expression is too dynamic
```

This happens when the SDK and your AI provider packages are bundled instead of loaded as native Node modules. **You must add `serverExternalPackages` in `next.config.ts`** — include `@governxone/ai-monitor` and every AI provider package you load through `loadProvider()`.

### 1. Configure `next.config.ts` (required)

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@governxone/ai-monitor',
    // Add each provider package you use with loadProvider():
    '@google/generative-ai',
    'openai',
    '@anthropic-ai/sdk',
    '@langchain/openai',
    'ai',
  ],
};

export default nextConfig;
```

Only list the packages you actually install. For example, if you use Gemini only:

```ts
serverExternalPackages: ['@governxone/ai-monitor', '@google/generative-ai'],
```

Restart the dev server after changing `next.config.ts`.

### 2. Use `loadProvider()` in server-only code

Call `loadProvider()` in **server-only** modules (API routes, Server Actions, `lib/` helpers). Never call it from Client Components — monitoring runs on the server only.

Example (`lib/gemini.ts`):

```ts
import { loadProvider } from '@governxone/ai-monitor';

const { GoogleGenerativeAI } = loadProvider<typeof import('@google/generative-ai')>(
  '@google/generative-ai',
);

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
```

### 3. Optional: early bootstrap via `instrumentation.ts`

For App Router projects, you can import the register hook so instrumentation initializes before route handlers:

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@governxone/ai-monitor/register');
  }
}
```

You still need `loadProvider()` for each AI SDK package — `register` only initializes the monitor.

## Supported providers

| Provider | Package | `loadProvider()` argument |
|----------|---------|---------------------------|
| OpenAI | `openai` | `'openai'` |
| Azure OpenAI | `openai` | `'openai'` |
| OpenRouter | `openai` | `'openai'` |
| Anthropic Claude | `@anthropic-ai/sdk` | `'@anthropic-ai/sdk'` |
| Google Gemini | `@google/generative-ai` | `'@google/generative-ai'` |
| LangChain | `@langchain/openai` | `'@langchain/openai'` |
| Vercel AI SDK | `ai` | `'ai'` |

## Architecture

```
Application
    ↓
loadProvider('openai' | '@google/generative-ai' | …)
    ↓
GovernXOne auto-instrumentation (monkey-patch)
    ↓
AI Provider SDK call (unchanged API)
    ↓
In-memory queue + batch flush
    ↓
POST /api/v1/sdk/monitoring
    ↓
GovernXOne backend → Dashboard
```

## API reference

### `loadProvider<T>(packageName: string): T`

Initialize monitoring (if configured), then load an AI provider package. **Always use this instead of a top-level `import`** for supported providers.

Supported `packageName` values: `'openai'`, `'@anthropic-ai/sdk'`, `'@google/generative-ai'`, `'@langchain/openai'`, `'langchain/chat_models/openai'`, `'langchain'`, `'ai'`, `'@vercel/ai'`.

In **Next.js**, also add the monitor and provider packages to `serverExternalPackages` in `next.config.ts` (see [Next.js setup](#nextjs-setup)).

### `GovernXOne.init(config?)`

Initialize the singleton client and register auto-instrumentation. Optional when env vars are set and you use `loadProvider()`.

### `GovernXOne.ensureInit(config?)`

Like `init()` but no-ops with a warning when `GOVERNXONE_API_KEY` or `GOVERNXONE_PROJECT_ID` is missing.

### `GovernXOne.flush()` / `GovernXOne.shutdown()`

Flush pending events and stop the flush loop. Useful in serverless handlers before the process exits.

### `client.track(payload)`

Manually enqueue a monitoring payload. Normally not needed — auto-instrumentation handles this.

## Development

```bash
npm run build
npm test
```

## License

UNLICENSED — GovernXOne proprietary SDK.
