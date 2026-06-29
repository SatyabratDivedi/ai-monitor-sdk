/**
 * Core type definitions for the GovernXOne AI Monitoring SDK.
 *
 * @module @governxone/ai-monitor/types
 */

/** Supported AI model providers. */
export type AIProvider =
  | 'openai'
  | 'azure-openai'
  | 'claude'
  | 'gemini'
  | 'langchain'
  | 'vercel-ai'
  | 'openrouter';

/** Environments the SDK can report from. */
export type Environment = 'development' | 'staging' | 'production';

/** Severity levels for internal SDK logging. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** A single AI model invocation captured by the SDK. */
export interface MonitoringPayload {
  /** Unique identifier for this invocation (UUID v4). */
  id: string;
  /** Provider name. */
  provider: AIProvider;
  /** Model identifier (e.g. "gpt-4", "claude-3-opus"). */
  model: string;
  /** Full prompt text sent to the model. */
  prompt: string;
  /** Full response text from the model. */
  response: string;
  /** Number of input (prompt) tokens, if reported by the provider. */
  inputTokens: number;
  /** Number of output (completion) tokens, if reported by the provider. */
  outputTokens: number;
  /** End-to-end latency in milliseconds. */
  latencyMs: number;
  /** Deployment environment tag. */
  environment: Environment;
  /** ISO-8601 timestamp of the invocation. */
  timestamp: string;
  /** Arbitrary metadata (userId, sessionId, etc.). */
  metadata?: Record<string, unknown>;
}

/** Response from the monitoring API. */
export interface MonitoringResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/** Configuration options for the GovernXOne SDK. */
export interface GovernXOneConfig {
  /** Your GovernXOne API key (plaintext, from the dashboard). Falls back to GOVERNXONE_API_KEY. */
  apiKey?: string;
  /**
   * GovernXOne project (AI system) ID to scope monitoring records.
   * Falls back to GOVERNXONE_PROJECT_ID.
   */
  projectId?: string;
  /** Base URL for the GovernXOne ingestion endpoint. */
  baseUrl?: string;
  /** Deployment environment tag. Default: 'production'. */
  environment?: Environment;
  /** Maximum retry attempts for failed deliveries. Default: 5. */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff. Default: 200. */
  backoffBaseMs?: number;
  /** Maximum queue size before dropping oldest entries. Default: 1000. */
  maxQueueSize?: number;
  /** Interval (ms) between flush cycles. Default: 5000. */
  flushIntervalMs?: number;
  /** Batch size for each flush request. Default: 100. */
  batchSize?: number;
  /** Enable verbose debug logging. Default: false. */
  debug?: boolean;
  /** Application name for metadata. */
  appName?: string;
  /** Application version for metadata. */
  appVersion?: string;
  /** Custom logger. Must implement debug/info/warn/error. */
  logger?: Logger;
  /** Auto-instrument supported providers globally. Default: true. */
  autoInstrument?: boolean;
  /**
   * Serverless mode — flush after each tracked call and on process exit.
   * Auto-detected on Vercel, AWS Lambda, Netlify, etc. Set GOVERNXONE_SERVERLESS=true to force.
   */
  serverless?: boolean;
}

/**
 * Minimal logger interface.
 * Consumers can plug in their own (console, winston, pino, etc.).
 */
export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

/** Partial fields accepted by track() before id/timestamp/environment are added. */
export type TrackPayload = Omit<MonitoringPayload, 'id' | 'timestamp' | 'environment'> & {
  status?: 'success' | 'error';
  error?: string;
  totalTokens?: number;
  estimatedCost?: number;
  requestId?: string;
  sessionId?: string;
  userId?: string;
};
