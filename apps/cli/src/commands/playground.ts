import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { startPlayground, type DevRuntimeHandle } from '@mbsks/rspfx-dev-runtime';
import { loadConfig } from '../config.js';

const logger = createLogger('rspfx');

export interface PlaygroundOptions {
  port?: number;
}

export async function runPlayground(cwd: string, opts: PlaygroundOptions = {}): Promise<DevRuntimeHandle> {
  const loaded = await loadConfig(cwd);
  if (loaded.bundler === 'vite') {
    throw new RspfxError(
      'PLAYGROUND_VITE_UNSUPPORTED',
      'The playground is not supported for Vite projects yet. Use "rspack.config.ts" with RspfxPlugin, or run "vite" directly.'
    );
  }
  if (loaded.bundler === 'rsbuild') {
    throw new RspfxError(
      'PLAYGROUND_RSBUILD_UNSUPPORTED',
      'The playground is not supported for Rsbuild projects yet. Use "rspack.config.ts" with RspfxPlugin, or run "rsbuild dev" directly.'
    );
  }
  const handle = await startPlayground({
    projectRoot: cwd,
    config: loaded.config,
    port: opts.port
  });

  logger.info(`Playground: ${handle.url}`);

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    await handle.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  return handle;
}
