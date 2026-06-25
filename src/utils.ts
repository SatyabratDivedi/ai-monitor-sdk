import { v4 as uuidv4 } from 'uuid';
import { MonitoringPayload } from './types';

/** Generate a UUID v4 string. */
export function generateId(): string {
  return uuidv4();
}

/** Produce an ISO-8601 timestamp. */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Calculate exponential backoff delay for a given retry attempt.
 * delay = base * 2^attempt + jitter (±25%)
 */
export function backoffDelay(baseMs: number, attempt: number): number {
  const exponential = baseMs * 2 ** attempt;
  const jitter = exponential * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.round(exponential + jitter);
}

/** Truncate a string to `maxLen` characters, appending "…" if truncated. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

/** Size of a payload object in approximate bytes (JSON-serialised). */
export function payloadSize(payload: MonitoringPayload): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf-8');
}
