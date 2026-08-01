import { createLogger } from '@mbsks/rspfx-diagnostics';
import { startServe, type DevRuntimeHandle } from '@mbsks/rspfx-dev-runtime';
import { loadConfig } from '../config.js';

const logger = createLogger('rspfx');

export interface DevOptions {
  refresh?: boolean;
  browser?: boolean;
  port?: number;
  tenant?: string;
}

export async function runDev(cwd: string, opts: DevOptions = {}): Promise<DevRuntimeHandle> {
  const config = await loadConfig(cwd);
  const handle = await startServe({
    projectRoot: cwd,
    config,
    fastRefresh: opts.refresh ?? config.dev.fastRefresh,
    noBrowser: !opts.browser,
    port: opts.port,
    tenantDomain: opts.tenant
  });

  if (handle.workbenchUrl) {
    printBox(['Open this URL in the SharePoint workbench (debug manifests):', '', handle.workbenchUrl]);
  }

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

export function printBox(lines: string[]): void {
  const width = Math.min(Math.max(...lines.map((line) => line.length)) + 4, 100);
  const border = `┌${'─'.repeat(width - 2)}┐`;
  const bottom = `└${'─'.repeat(width - 2)}┘`;
  process.stdout.write(`\n${border}\n`);
  for (const line of lines) {
    const content = line.length > width - 4 ? `${line.slice(0, width - 4)}…` : line;
    process.stdout.write(`│ ${content.padEnd(width - 4)} │\n`);
  }
  process.stdout.write(`${bottom}\n\n`);
}
