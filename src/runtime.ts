import { createRequire } from 'node:module';
import path from 'node:path';

const warned = new Set<string>();

export function isBrowser(): boolean {
  const g = globalThis as { window?: unknown };
  return typeof g.window !== 'undefined';
}

export function isServer(): boolean {
  return !isBrowser();
}

export function detectServerless(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false;
  }
  return !!(
    process.env.GOVERNXONE_SERVERLESS === 'true' ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTION_TARGET ||
    process.env.NETLIFY
  );
}

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Node require that works in both CJS bundles and ESM (e.g. Next.js). */
export function nodeRequire(moduleId: string): unknown {
  if (typeof require !== 'undefined') {
    return require(moduleId);
  }
  const req = createRequire(path.join(process.cwd(), 'package.json'));
  return req(moduleId);
}
