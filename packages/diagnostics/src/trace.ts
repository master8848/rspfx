import { createLogger } from './logger.js';
import { reportBenchmark } from './benchmark.js';

const logger = createLogger('trace');

export function timeStart(name: string): () => number {
  const start = performance.now();
  return () => performance.now() - start;
}

export async function trace<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const elapsed = timeStart(name);
  try {
    return await fn();
  } finally {
    const ms = elapsed();
    logger.debug(`${name}: ${ms.toFixed(1)}ms`);
    reportBenchmark(name, ms);
  }
}
