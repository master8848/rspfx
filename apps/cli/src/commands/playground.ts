import { createLogger } from '@mbsks/rspfx-diagnostics';
import { startPlayground, type DevRuntimeHandle } from '@mbsks/rspfx-dev-runtime';
import { loadConfig } from '../config.js';

const logger = createLogger('rspfx');

export interface PlaygroundOptions {
  port?: number;
}

export async function runPlayground(cwd: string, opts: PlaygroundOptions = {}): Promise<DevRuntimeHandle> {
  const config = await loadConfig(cwd);
  const handle = await startPlayground({
    projectRoot: cwd,
    config,
    noBrowser: false,
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
