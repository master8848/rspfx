import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@mbsks/rspfx-diagnostics';

export function expandEnvVars(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }
  let result = input;
  result = result.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?:\:(-)?([^\}]*))?\}/g,
    (_match: string, varName: string, dash: string | undefined, defaultValue: string | undefined) => {
      const envVal = process.env[varName];
      if (envVal !== undefined && envVal !== '') {
        return envVal;
      }
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return '';
    }
  );
  result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match: string, varName: string) => {
    const envVal = process.env[varName];
    if (envVal !== undefined) {
      return envVal;
    }
    return '';
  });
  return result;
}

export function expandObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'string') {
    return expandEnvVars(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return (obj as unknown[]).map((item) => expandObject(item as unknown)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      out[key] = expandObject(value as unknown);
    }
    return out as T;
  }
  return obj;
}

export function loadDotEnv(projectRoot: string): void {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (e) {
    createLogger('rspfx').debug(`Failed to parse .env: ${String(e)}`);
  }
}
