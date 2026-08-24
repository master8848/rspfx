import type { Logger } from './logger.js';
import { reportBenchmark } from './benchmark.js';

export function timeStart(_name: string): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

export async function trace<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const elapsed = timeStart(name);
  try {
    return await fn();
  } finally {
    const ms = elapsed();
    // Use a transient logger; trace already has debug sink
    // Import lazily to avoid circular
    const { createLogger } = await import('./logger.js');
    const logger = createLogger('trace');
    logger.debug(`${name}: ${ms.toFixed(1)}ms`);
    reportBenchmark(name, ms);
  }
}

export interface Tracer {
  span<T>(name: string, fn: () => Promise<T>): Promise<T>;
  time<T>(name: string, fn: () => T): T;
}

export function createTracer(logger: Logger): Tracer {
  return {
    async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
      if (!logger.isLevelEnabled('trace')) {
        const start = performance.now();
        try {
          return await fn();
        } finally {
          const durationMs = performance.now() - start;
          // even if not trace-enabled, report benchmark for internal telemetry? Spec says trace logs only when enabled.
          // We still report benchmark if needed? No, only log when enabled.
          // To keep behavior, only log when trace enabled; benchmark reported regardless via reportBenchmark.
          reportBenchmark(name, durationMs);
        }
      }
      const start = performance.now();
      logger.trace(`enter ${name}`);
      try {
        const result = await fn();
        const durationMs = performance.now() - start;
        logger.trace(`exit ${name}`, { durationMs });
        reportBenchmark(name, durationMs);
        return result;
      } catch (e) {
        const durationMs = performance.now() - start;
        logger.trace(`error ${name}`, { durationMs });
        reportBenchmark(name, durationMs);
        throw e;
      }
    },
    time<T>(name: string, fn: () => T): T {
      const start = performance.now();
      if (logger.isLevelEnabled('trace')) logger.trace(`enter ${name}`);
      try {
        const result = fn();
        const durationMs = performance.now() - start;
        if (logger.isLevelEnabled('trace')) logger.trace(`exit ${name}`, { durationMs });
        reportBenchmark(name, durationMs);
        return result;
      } catch (e) {
        const durationMs = performance.now() - start;
        if (logger.isLevelEnabled('trace')) logger.trace(`error ${name}`, { durationMs });
        reportBenchmark(name, durationMs);
        throw e;
      }
    }
  };
}
