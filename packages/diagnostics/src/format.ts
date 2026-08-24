import type { AggregateRspfxError, RspfxError } from './error.js';
import { isAggregateRspfxError } from './error.js';
import { flatCauseChain } from './error.js';

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return `${bytes} B`;
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) {
    return `${value} B`;
  }
  return `${value.toFixed(1)} ${UNITS[unit]!}`;
}

export function formatError(err: RspfxError | AggregateRspfxError, opts: { color?: boolean } = {}): string {
  const useColor = opts.color ?? false;
  const codeColor = useColor ? '\x1b[31m' : '';
  const reset = useColor ? '\x1b[0m' : '';
  const dim = useColor ? '\x1b[2m' : '';

  if (isAggregateRspfxError(err)) {
    const header = `${codeColor}[${err.code}]${reset} ${err.message}`;
    const lines: string[] = [header];
    err.errors.forEach((e, idx) => {
      const prefix = `  ${idx + 1}. [${e.code}] ${e.message}`;
      lines.push(useColor ? `${codeColor}${prefix}${reset}` : prefix);
      const chain = flatCauseChain(e);
      // chain already includes e as first element; show causes beyond first
      for (let i = 1; i < chain.length; i++) {
        const cause = chain[i]!;
        lines.push(`${dim}     caused by [${cause.code}] ${cause.message}${reset}`);
      }
      if (e.cause && !(e.cause instanceof Error && 'code' in (e.cause as unknown as Record<string, unknown>))) {
        const msg = e.cause instanceof Error ? e.cause.message : String(e.cause);
        lines.push(`${dim}     caused by ${msg}${reset}`);
      }
    });
    return lines.join('\n');
  }

  const rspfx = err as RspfxError;
  const base = `${codeColor}[${rspfx.code}]${reset} ${rspfx.message}`;
  const chain = flatCauseChain(rspfx);
  if (chain.length <= 1) {
    if (rspfx.cause && !(rspfx.cause instanceof Error && 'code' in (rspfx.cause as unknown as Record<string, unknown>))) {
      const msg = rspfx.cause instanceof Error ? rspfx.cause.message : String(rspfx.cause);
      return `${base}\n${dim}  caused by ${msg}${reset}`;
    }
    return base;
  }
  const lines = [base];
  for (let i = 1; i < chain.length; i++) {
    const cause = chain[i]!;
    lines.push(`${dim}  caused by [${cause.code}] ${cause.message}${reset}`);
  }
  return lines.join('\n');
}
