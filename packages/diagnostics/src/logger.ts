export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'success' | 'trace';

export type LogFields = Record<string, string | number | boolean | undefined>;

export interface LogEntry {
  readonly level: LogLevel;
  readonly name: string;
  readonly message: string;
  readonly fields: Readonly<LogFields>;
  readonly timestamp: string;
  readonly error?: unknown;
}

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly json?: boolean;
  readonly sinks?: Array<(entry: LogEntry) => void>;
}

export interface Logger {
  readonly name: string;
  error(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  success(message: string, fields?: LogFields): void;
  trace(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
  isLevelEnabled(level: LogLevel): boolean;
  withLevel(level: LogLevel): Logger;
}

const RESET = '\x1b[0m';

const COLORS: Record<LogLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[2m',
  success: '\x1b[32m',
  trace: '\x1b[2m'
};

const RANKS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  success: 2,
  debug: 3,
  trace: 4
};

function parseLevel(raw: string | undefined): LogLevel | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase() as LogLevel;
  if (v in RANKS) return v;
  return undefined;
}

function resolveLevel(opts?: LoggerOptions): number {
  if (opts?.level && opts.level in RANKS) return RANKS[opts.level];
  const env = parseLevel(process.env.RSPFX_LOG_LEVEL);
  if (env) return RANKS[env];
  return RANKS.info;
}

function isJsonEnabled(opts?: LoggerOptions): boolean {
  if (opts?.json !== undefined) return opts.json;
  return process.env.RSPFX_LOG_JSON === '1';
}

function buildLogger(name: string, opts: LoggerOptions | undefined, parentFields: LogFields, levelRank: number, json: boolean, sinks: Array<(entry: LogEntry) => void> | undefined): Logger {
  function shouldLog(level: LogLevel): boolean {
    return RANKS[level] <= levelRank;
  }

  function emit(level: LogLevel, message: string, fields?: LogFields): void {
    if (!shouldLog(level)) return;
    const merged: LogFields = { ...parentFields, ...(fields ?? {}) };
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { level, name, message, fields: merged, timestamp };

    if (sinks && sinks.length > 0) {
      for (const sink of sinks) sink(entry);
      return;
    }

    if (json) {
      const line = JSON.stringify({ level, name, message, fields: merged, timestamp });
      process.stdout.write(line + '\n');
      return;
    }

    const fieldStr = Object.keys(merged).length > 0 ? ` ${Object.entries(merged).map(([k, v]) => `${k}=${String(v)}`).join(' ')}` : '';
    const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    stream.write(`${COLORS[level]}[${name}] ${level}: ${message}${fieldStr}${RESET}\n`);
  }

  const logger: Logger = {
    name,
    error: (m, f) => emit('error', m, f),
    warn: (m, f) => emit('warn', m, f),
    info: (m, f) => emit('info', m, f),
    debug: (m, f) => emit('debug', m, f),
    success: (m, f) => emit('success', m, f),
    trace: (m, f) => emit('trace', m, f),
    isLevelEnabled: (l) => shouldLog(l),
    withLevel: (l) => {
      const newRank = RANKS[l];
      const newJson = opts?.json ?? process.env.RSPFX_LOG_JSON === '1';
      const newSinks = opts?.sinks ? [...opts.sinks] : undefined;
      // withLevel should not carry parentFields; it creates a fresh logger with same name and new level, but if called on child, should preserve parentFields
      return buildLogger(name, { ...opts, level: l, json: newJson, sinks: newSinks }, parentFields, newRank, newJson, newSinks);
    },
    child: (extra) => {
      const mergedParent = { ...parentFields, ...extra };
      return buildLogger(name, opts, mergedParent, levelRank, json, sinks);
    }
  };

  return logger;
}

export function createLogger(name: string, opts?: LoggerOptions): Logger {
  const levelRank = resolveLevel(opts);
  const json = isJsonEnabled(opts);
  const sinks = opts?.sinks ? [...opts.sinks] : undefined;
  return buildLogger(name, opts, {}, levelRank, json, sinks);
}

import { formatError } from './format.js';

export function createDiagnosticFormatter(_logger: Logger): (err: import('./error.js').RspfxError | import('./error.js').AggregateRspfxError) => string {
  return (err) => {
    const json = process.env.RSPFX_LOG_JSON === '1';
    const useColor = !json && process.stdout.isTTY !== false;
    return formatError(err as unknown as import('./error.js').RspfxError, { color: useColor });
  };
}
