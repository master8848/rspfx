import path from 'node:path';
import fs from 'node:fs';
import {
  BASE_EXTENSIONS,
  BUILD_TIME_ALIASES,
  SOLID_REFRESH_STUB
} from '@mbsks/rspfx-compiler-rspack';
import { readProject } from '@mbsks/rspfx-dev-runtime';

/**
 * Build-time stub aliases (refresh plugins, vue-loader) for the native rspack path.
 */
function canResolveFromProject(projectRoot: string, specifier: string): boolean {
  const packageName = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]!;
  let dir = projectRoot;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', packageName))) {
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return false;
    }
    dir = parent;
  }
}

/**
 * The standard rspfx `resolve` block for the native rspack path
 * (`rspack build` / `rspack dev` with the scaffolded `rspack.config.ts`).
 *
 * Rspack builds its resolver factory from the config file at compiler-creation
 * time, so plugin-injected resolve options are not picked up — the scaffold
 * therefore declares this resolve block directly:
 *
 * ```ts
 * export default {
 *   mode: 'development',
 *   resolve: rspfxResolve(),
 *   plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', ... })]
 * };
 * ```
 *
 * Includes the TypeScript/JSX/SCSS extensions, the `.js → .ts` extension
 * alias, the build-time stub aliases (refresh plugins, vue-loader) and the
 * project's localized-resource aliases (from `config/config.json`).
 */
export function rspfxResolve(projectRoot = process.cwd()): Record<string, unknown> {
  const alias: Record<string, string> = { ...BUILD_TIME_ALIASES };
  if (canResolveFromProject(projectRoot, 'solid-refresh')) {
    // The real package is available — no stub needed.
  } else {
    alias['solid-refresh'] = SOLID_REFRESH_STUB;
  }
  try {
    const project = readProject(projectRoot, undefined, undefined);
    Object.assign(alias, project.localizedAliases);
  } catch {
    // No web part bundles yet — keep the base resolve (config.json may be
    // edited later; `rspfx build` always computes aliases itself).
  }
  return {
    extensions: [...BASE_EXTENSIONS],
    modules: ['node_modules'],
    extensionAlias: { '.js': ['.ts', '.js'] },
    ...(Object.keys(alias).length > 0 ? { alias } : {})
  };
}
