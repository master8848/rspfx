# @mbsks/rspfx-diagnostics

Diagnostics for [RSPFx](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Structured logging, typed errors, benchmarks, and formatting helpers shared across the toolchain and CLI.

## Install

```sh
npm i @mbsks/rspfx-diagnostics
```

## Usage

```ts
import { createLogger, RspfxError, formatBytes, reportBenchmark, timeStart } from '@mbsks/rspfx-diagnostics';

const log = createLogger({ level: 'info' });
log.info('building %s', 'my-webpart');

try {
  // ...
} catch (cause) {
  throw new RspfxError('E1001', 'something failed', cause);
}

const elapsed = timeStart();
// ... work ...
reportBenchmark('my-step', elapsed());

console.log(formatBytes(1_500_000)); // "1.4 MB"
```

## API

- `createLogger(opts)` / `Logger` / `LogLevel` — structured logger (level from `RSPFX_LOG_LEVEL` env var)
- `RspfxError` — typed error with code, message, and cause
- `reportBenchmark`, `timeStart`, `trace` — timing/telemetry
- `formatBytes` — human-readable byte sizes

## Links

- [Documentation](https://rspfx.mbsks.me) — [Getting Started](https://rspfx.mbsks.me/docs/getting-started)
- [GitHub](https://github.com/master8848/rspfx)
- License: MIT
