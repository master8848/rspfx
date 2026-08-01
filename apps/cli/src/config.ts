import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { resolveConfig, type RspfxConfig } from '@mbsks/rspfx-core';
import { RspfxError } from '@mbsks/rspfx-diagnostics';

export function findConfigFile(projectRoot: string): string | undefined {
  for (const candidate of ['rspfx.config.ts', 'rspfx.config.js']) {
    const file = path.join(projectRoot, candidate);
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return undefined;
}

export async function loadConfig(projectRoot: string): Promise<RspfxConfig> {
  const configPath = findConfigFile(projectRoot);
  if (!configPath) {
    throw new RspfxError(
      'CONFIG_NOT_FOUND',
      `No rspfx.config.ts found in ${projectRoot}. Run "rspfx new" to scaffold a project.`
    );
  }
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const mod = await jiti.import(path.resolve(configPath));
  const raw = ((mod as { default?: unknown }).default ?? mod) as Partial<RspfxConfig>;
  return resolveConfig(raw);
}
