export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'success';

export interface Logger {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  debug(message: string): void;
  success(message: string): void;
}

const RESET = '\x1b[0m';

const COLORS: Record<LogLevel, string> = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[2m',
  success: '\x1b[32m'
};

const RANKS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  success: 2,
  debug: 3
};

function configuredLevel(): number {
  switch (process.env.RSPFX_LOG_LEVEL) {
    case 'error':
      return 0;
    case 'warn':
      return 1;
    case 'debug':
      return 3;
    default:
      return 2;
  }
}

export function createLogger(name: string): Logger {
  function write(level: LogLevel, stream: NodeJS.WriteStream, message: string): void {
    if (RANKS[level] > configuredLevel()) {
      return;
    }
    stream.write(`${COLORS[level]}[${name}] ${level}: ${message}${RESET}\n`);
  }

  return {
    error: (message) => write('error', process.stderr, message),
    warn: (message) => write('warn', process.stderr, message),
    info: (message) => write('info', process.stdout, message),
    debug: (message) => write('debug', process.stdout, message),
    success: (message) => write('success', process.stdout, message)
  };
}
