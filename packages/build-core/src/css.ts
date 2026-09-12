import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireForResolve = createRequire(import.meta.url);

export const POSTCSS_CONFIG_FILES = [
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'postcss.config.ts',
  'postcss.config.cts',
  'postcss.config.mts',
  'postcss.config.json'
];

export function tryResolve(name: string, projectRoot: string): string | undefined {
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req.resolve(name);
  } catch {}
  try {
    return requireForResolve.resolve(name);
  } catch {}
  return undefined;
}

export function hasPostcssConfig(root: string): boolean {
  for (const f of POSTCSS_CONFIG_FILES) {
    try {
      if (fs.existsSync(path.join(root, f))) return true;
    } catch {}
  }
  return false;
}

// Alias kept for backward compat with compiler-rspack naming
export const hasPostcssConfigFile = hasPostcssConfig;

export function inlineStyleCode(css: string): string {
  return (
    `\n(function(){var e=document.createElement("style");e.type="text/css";` +
    `e.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(e);})();\n`
  );
}
