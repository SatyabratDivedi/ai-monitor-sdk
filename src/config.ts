import { GovernXOneConfig, Environment, Logger } from './types';
import { detectServerless } from './runtime';

const DEFAULTS = {
  baseUrl: 'https://dev.governxone.com/api',
  environment: 'production' as Environment,
  maxRetries: 5,
  backoffBaseMs: 200,
  maxQueueSize: 1000,
  flushIntervalMs: 5_000,
  batchSize: 100,
  debug: false,
  autoInstrument: true,
  serverless: false,
  sampleRate: 100,
  remoteSampling: true,
  sampleConfigRefreshMs: 60_000,
  clientSampling: false,
};

function env(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

function defaultBaseUrl(): string {
  if (env('NODE_ENV') === 'development') {
    return 'http://localhost:8000';
  }
  return DEFAULTS.baseUrl;
}

function defaultEnvironment(): Environment {
  if (env('NODE_ENV') === 'development') {
    return 'development';
  }
  return DEFAULTS.environment;
}

/** Clamp a sampling rate to an integer in the range [0, 100]. */
export function normalizeSampleRate(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Merge partial user configuration with defaults, env vars, and validate required fields.
 */
export function resolveConfig(
  userConfig: Partial<GovernXOneConfig>,
  options: { requireApiKey?: boolean; requireProjectId?: boolean } = {},
): GovernXOneConfig {
  const requireApiKey = options.requireApiKey !== false;
  const requireProjectId = options.requireProjectId !== false;
  const apiKey = userConfig.apiKey ?? env('GOVERNXONE_API_KEY');
  if (!apiKey && requireApiKey) {
    throw new Error(
      'GovernXOne SDK: "apiKey" is required. Set GOVERNXONE_API_KEY or pass apiKey to GovernXOne.init().',
    );
  }

  const projectId = userConfig.projectId ?? env('GOVERNXONE_PROJECT_ID');
  if (!projectId && requireProjectId) {
    throw new Error(
      'GovernXOne SDK: "projectId" is required. Set GOVERNXONE_PROJECT_ID or pass projectId to GovernXOne.init().',
    );
  }

  const baseUrl =
    userConfig.baseUrl ?? env('GOVERNXONE_ENDPOINT') ?? defaultBaseUrl();
  const environment = (userConfig.environment ??
    env('GOVERNXONE_ENVIRONMENT') ??
    defaultEnvironment()) as Environment;
  const serverless = userConfig.serverless ?? detectServerless();
  const debug =
    userConfig.debug ??
    (env('GOVERNXONE_DEBUG') === 'true' ? true : DEFAULTS.debug);
  const flushIntervalMs =
    userConfig.flushIntervalMs ??
    (serverless ? 2_000 : DEFAULTS.flushIntervalMs);

  const envSampleRate = env('GOVERNXONE_SAMPLE_RATE');
  const sampleRate = normalizeSampleRate(
    userConfig.sampleRate ??
      (envSampleRate !== undefined ? Number(envSampleRate) : DEFAULTS.sampleRate),
  );
  const remoteSampling =
    userConfig.remoteSampling ??
    (env('GOVERNXONE_REMOTE_SAMPLING') === 'false' ? false : DEFAULTS.remoteSampling);
  const clientSampling = false;

  return {
    ...DEFAULTS,
    ...userConfig,
    apiKey: apiKey ?? '',
    projectId: projectId ?? '',
    baseUrl,
    environment,
    serverless,
    debug,
    flushIntervalMs,
    sampleRate,
    remoteSampling,
    clientSampling,
  };
}

/** Default logger that writes to stderr when debug mode is on. */
export function createDefaultLogger(debug: boolean): Logger {
  if (!debug) {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  const prefix = '[governxone]';
  return {
    debug: (msg: string, ...args: unknown[]) => console.debug(`${prefix} ${msg}`, ...args),
    info: (msg: string, ...args: unknown[]) => console.info(`${prefix} ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`${prefix} ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`${prefix} ${msg}`, ...args),
  };
}
