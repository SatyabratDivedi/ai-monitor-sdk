import { GovernXOne } from './sdk';
import { nodeRequire } from './runtime';

/**
 * Load an AI provider package after GovernXOne auto-instrumentation is registered.
 * Use this instead of a top-level `import` so patches apply before the provider module loads.
 */
export function loadProvider<T = unknown>(packageName: string): T {
  GovernXOne.ensureInit();
  return nodeRequire(packageName) as T;
}
