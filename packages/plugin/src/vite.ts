import os from 'node:os';
import fs from 'node:fs';
import * as fspEsm from 'node:fs/promises';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  resolveConfig,
  RSPFX_PLUGIN_MARKER,
  RSPFX_PLUGIN_OPTIONS,
  type FrameworkId,
  type RspfxBundlerPluginLike
} from '@mbsks/rspfx-core';
import {
  SPFX_PUBLIC_PATH_SENTINEL,
  scriptUrlCaptureLine,
  scriptUrlPublicPathExpression
} from '@mbsks/rspfx-compiler-rspack';
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';
import { createHookBus, getPlugins, type FrameworkPreset } from '@mbsks/rspfx-plugin-api';
import {
  readProject,
  resolveServeSettings,
  resolveServeMode,
  buildWorkbenchUrl,
  createManifestRegenerator,
  createRefreshRuntime,
  createReloadController,
  assembleRelease,
  openBrowser,
  loadFrameworkPreset,
  decodeIfEncoded,
  type ServeSettings
} from '@mbsks/rspfx-dev-runtime';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import type { BundleEntry } from '@mbsks/rspfx-compiler-rspack';
import type { RspfxPluginOptions } from './types.js';
import { collectExternals } from './shared.js';

const logger = createLogger('rspfx');

const viteAls = new AsyncLocalStorage<BundleEntry>();

// ---------------------------------------------------------------------------
// Vite version detection – dual Vite 7 (Rollup) / Vite 8 (Rolldown) support
// ---------------------------------------------------------------------------
/**
 * Resolve the installed Vite version string (e.g. "7.1.0" or "8.0.0") by
 * reading `vite/package.json` via the project's resolver first (project-local
 * Vite), then falling back to the rspfx installation's Vite. Returns
 * undefined when Vite is not installed or version cannot be read.
 */
function getViteVersion(root: string): string | undefined {
  const tryRead = (pkgPath: string): string | undefined => {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw) as { version?: string };
      return typeof pkg.version === 'string' ? pkg.version : undefined;
    } catch {
      return undefined;
    }
  };
  // 1) project-local vite
  try {
    const requireFromProject = createRequire(path.join(root, 'package.json'));
    const pkgPath = requireFromProject.resolve('vite/package.json');
    const v = tryRead(pkgPath);
    if (v) return v;
  } catch {}
  // 2) fallback to this package's vite
  try {
    const basePath = decodeIfEncoded(import.meta.url);
    const fallbackRequire = createRequire(basePath);
    const pkgPath = fallbackRequire.resolve('vite/package.json');
    const v = tryRead(pkgPath);
    if (v) return v;
  } catch {}
  return undefined;
}

function getViteMajor(root: string): number | undefined {
  const v = getViteVersion(root);
  if (!v) return undefined;
  const major = Number(v.split('.')[0] ?? '');
  return Number.isFinite(major) ? major : undefined;
}

function isVite8OrLater(root: string): boolean {
  const major = getViteMajor(root);
  return major !== undefined && major >= 8;
}

// Eager patch for Vite's loadAndTransform which does `fsp.readFile(file)` where
// `file` may be "/Volumes/New%20Volume/..." when the workspace path contains a
// space (pathToFileURL encodes it, Vite's cleanUrl leaves %20). Decode %20
// before the actual read so the build succeeds on such paths.
(() => {
  const patchTarget = (target: unknown): void => {
    try {
      const mod = target as { readFile: (...args: unknown[]) => Promise<unknown>; _rspfxPatched?: boolean };
      if (!mod || typeof mod.readFile !== 'function' || mod._rspfxPatched) return;
      const orig = mod.readFile.bind(mod);
      (mod as unknown as { readFile: unknown }).readFile = (file: unknown, ...args: unknown[]) => {
        if (typeof file === 'string' && file.includes('%')) {
          try {
            const decoded = decodeURIComponent(file);
            if (decoded !== file) file = decoded;
          } catch {}
        }
        return (orig as (...a: unknown[]) => unknown)(file, ...args);
      };
      mod._rspfxPatched = true;
    } catch {}
  };
  patchTarget(fs.promises);
  patchTarget(fspEsm as unknown);
  // Also patch the classic fs.readFile
  try {
    const fsAny = fs as unknown as { readFile: (...a: unknown[]) => unknown; _rspfxPatched?: boolean };
    if (fsAny && typeof fsAny.readFile === 'function' && !fsAny._rspfxPatched) {
      const orig = fsAny.readFile.bind(fs);
      fsAny.readFile = (file: unknown, ...args: unknown[]) => {
        if (typeof file === 'string' && file.includes('%')) {
          try {
            const d = decodeURIComponent(file as string);
            if (d !== file) file = d;
          } catch {}
        }
        return (orig as (...a: unknown[]) => unknown)(file, ...args);
      };
      fsAny._rspfxPatched = true;
    }
  } catch {}
})();

/**
 * Environment contract between the CLI and the Vite plugin:
 * - `RSPFX_VITE_ENTRY` — the single bundle to build (AMD output is per-entry:
 *   Rollup cannot give each entry its own `define('id', …)` in one config).
 * - `RSPFX_VITE_AMD_ID` — explicit AMD library id (`<componentId>_<version>`).
 * - `RSPFX_VITE_MODE` — `'development'` | `'production'`.
 *
 * Unset (direct `vite dev` / `vite build`), the mode follows the vite command.
 */
export const VITE_ENV = {
  entry: 'RSPFX_VITE_ENTRY',
  amdId: 'RSPFX_VITE_AMD_ID',
  mode: 'RSPFX_VITE_MODE',
  fastRefresh: 'RSPFX_FAST_REFRESH'
} as const;

export interface ViteRspfxPlugin extends RspfxBundlerPluginLike {
  name: 'rspfx';
  config(
    config: unknown,
    env: { command: 'build' | 'serve'; mode: string }
  ): Promise<Record<string, unknown>>;
  buildStart(): void;
  moduleParsed(info: { id?: unknown }): void;
  buildEnd(): void;
  generateBundle(
    options: unknown,
    bundle: Record<string, { type: string; code?: string; source?: unknown }>
  ): void | Promise<void>;
  configureServer(server: unknown): void;
  closeBundle(): Promise<void>;
}

interface ViteBuildApi {
  build(options: Record<string, unknown>): Promise<unknown>;
}

interface ConnectMiddlewareServer {
  middlewares: {
    use(route: string, handler: (req: unknown, res: unknown) => void): void;
  };
  watcher?: { on(event: string, listener: (path: string) => void): unknown };
  httpServer?: { once(event: 'listening', listener: () => void): unknown };
}

interface ConnectResponse {
  setHeader(name: string, value: string): void;
  end(body: string): void;
  statusCode?: number;
}

interface ViteBuildOverrides {
  minify?: boolean;
  sourcemap?: boolean;
  emptyOutDir?: boolean;
}

interface ViteStatsJson {
  moduleCounts?: Record<string, number>;
}

const VITE_BASE_EXTENSIONS = ['.mjs', '.js', '.mts', '.jsx', '.ts', '.tsx', '.json'];

const presetCache = new Map<string, Promise<FrameworkPreset>>();

function loadPreset(root: string, framework: FrameworkId): Promise<FrameworkPreset> {
  const key = `${root}:${framework}`;
  let cached = presetCache.get(key);
  if (!cached) {
    cached = loadFrameworkPreset(framework, root).then((mod) => mod.preset as unknown as FrameworkPreset);
    presetCache.set(key, cached);
  }
  return cached;
}

function writeStats(root: string, entryName: string, moduleCount: number): void {
  const file = path.join(root, '.rspfx', 'stats.json');
  let existing: ViteStatsJson = {};
  try {
    existing = JSON.parse(fs.readFileSync(file, 'utf8')) as ViteStatsJson;
  } catch {
    // No stats file yet.
  }
  const moduleCounts: Record<string, number> = {
    ...(typeof existing.moduleCounts === 'object' && existing.moduleCounts !== null
      ? existing.moduleCounts
      : {}),
    [entryName]: moduleCount
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...existing, moduleCounts }, null, 2));
}

function inlineStyleCode(css: string): string {
  return (
    `\n(function(){var e=document.createElement("style");e.type="text/css";` +
    `e.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(e);})();\n`
  );
}

function inlineRemainingCssFiles(root: string, outDir: string, entryNames: string[]): void {
  const distDir = path.join(root, outDir);
  if (!fs.existsSync(distDir)) return;
  const cssFiles: string[] = [];
  const collect = (dir: string): void => {
    try {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          // vite emits to assets/ subdirectory
          if (entry === 'assets' || !entry.startsWith('.')) collect(full);
        } else if (entry.endsWith('.css')) {
          cssFiles.push(full);
        }
      }
    } catch {}
  };
  collect(distDir);
  if (cssFiles.length === 0) return;
  let combinedCss = '';
  for (const file of cssFiles) {
    try {
      combinedCss += fs.readFileSync(file, 'utf8') + '\n';
    } catch {}
  }
  if (!combinedCss.trim()) {
    for (const f of cssFiles) try { fs.rmSync(f, { force: true }); } catch {}
    return;
  }
  // Inline the same CSS into each entry's JS (SPFx loads one bundle per web part, each needs its styles)
  for (const entryName of entryNames) {
    const jsPath = path.join(distDir, `${entryName}.js`);
    if (!fs.existsSync(jsPath)) continue;
    let js = fs.readFileSync(jsPath, 'utf8');
    // Avoid double-inlining if generateBundle already inlined (check for first 200 chars of css)
    if (combinedCss.length > 200 && js.includes(combinedCss.slice(0, 200))) continue;
    // Preserve sourcemap comment
    const sourceMapUrlRegex = /\/\/# sourceMappingURL=.*(?:\r?\n)?$/;
    const match = js.match(sourceMapUrlRegex);
    const sourceMapComment = match ? match[0] : '';
    const codeWithoutMap = sourceMapComment ? js.slice(0, -sourceMapComment.length) : js;
    js = codeWithoutMap + inlineStyleCode(combinedCss) + (sourceMapComment || '');
    fs.writeFileSync(jsPath, js);
  }
  // Delete the now-inlined CSS files
  for (const f of cssFiles) {
    try { fs.rmSync(f, { force: true }); } catch {}
  }
  // Remove empty assets dir if needed
  try {
    const assetsDir = path.join(distDir, 'assets');
    if (fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length === 0) fs.rmdirSync(assetsDir);
  } catch {}
}

/**
 * Byte-compat with the Rspack/official-SPFx bundle header: rollup quotes the
 * AMD id with double quotes (`define("id", …)`) while the official form is
 * single-quoted — normalize it, then prepend the script-URL capture line.
 */
function amdBundleTransform(entryName: string, code: string): string {
  let out = code;
  if (out.includes(SPFX_PUBLIC_PATH_SENTINEL)) {
    out = out.split('"' + SPFX_PUBLIC_PATH_SENTINEL + '"').join(scriptUrlPublicPathExpression(entryName));
  }
  out = out.replace(/^define\("([^"]*)",/, "define('$1',");
  return scriptUrlCaptureLine(entryName) + out;
}

/**
 * Vite 8 (Rolldown) does not support `output.format:'amd'`. We build as `es`
 * and post-process the ES chunk into an AMD `define('id', [...deps], factory)`
 * wrapper. External imports (e.g. `@microsoft/sp-webpart-base`) are converted
 * to `require` calls inside the factory so the SPFx loader's AMD path is
 * preserved.
 */
function esToAmd(entryName: string, esCode: string, amdId: string, externals: string[]): string {
  let code = esCode;
  if (code.includes(SPFX_PUBLIC_PATH_SENTINEL)) {
    code = code.split('"' + SPFX_PUBLIC_PATH_SENTINEL + '"').join(scriptUrlPublicPathExpression(entryName));
  }
  const externalSet = new Set(externals);
  const depsInUse = new Set<string>();
  // Convert `import ... from 'dep'` where dep is external (all imports in the
  // ES chunk are externals – local modules are already bundled).
  // Supports: `import Foo from 'dep'`, `import * as Foo from 'dep'`,
  // `import { a, b as c } from 'dep'`, `import Foo, { a } from 'dep'`,
  // `import 'dep'` (side-effect)
  code = code.replace(/import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g, (_m, clause: string, source: string) => {
    const src = source.trim();
    // Local relative imports should have been bundled – keep if not external, but
    // Rolldown shouldn't emit them for externals-only; treat unknown as external.
    if (!externalSet.has(src) && !src.startsWith('.')) {
      // Not a known external – likely still external, keep tracking
    }
    depsInUse.add(src);
    const trimmed = clause.trim();
    // `* as NS`
    const nsMatch = /^\*\s+as\s+(\w+)$/.exec(trimmed);
    if (nsMatch) {
      return `const ${nsMatch[1]} = require('${src}');`;
    }
    // `Default, { ... }` or `Default` or `{ ... }`
    const braceIdx = trimmed.indexOf('{');
    if (braceIdx !== -1) {
      const beforeBrace = trimmed.slice(0, braceIdx).trim().replace(/,$/, '');
      const bracePart = trimmed.slice(braceIdx).trim();
      // Extract named imports inside braces
      const inner = bracePart.replace(/^\{/, '').replace(/\}$/, '').trim();
      const lines: string[] = [];
      if (beforeBrace) {
        const defaultName = beforeBrace.split(',')[0]!.trim();
        if (defaultName) lines.push(`const ${defaultName} = require('${src}').default || require('${src}');`);
      }
      if (inner) {
        // Keep `a as b` mapping as `a: b` for destructuring
        const mapped = inner.replace(/\s+as\s+/g, ': ');
        lines.push(`const { ${mapped} } = require('${src}');`);
      }
      return lines.join('\n');
    }
    // Plain default import: `import Foo from 'dep'`
    if (trimmed) {
      return `const ${trimmed} = require('${src}').default || require('${src}');`;
    }
    return '';
  });
  // Side-effect only: `import 'dep';`
  code = code.replace(/import\s+['"]([^'"]+)['"]\s*;?/g, (_m, source: string) => {
    depsInUse.add(source);
    return `require('${source}');`;
  });
  // Strip remaining export keywords – SPFx entry is side-effectful; exports are not consumed.
  code = code.replace(/\bexport\s+default\s+/g, '');
  code = code.replace(/\bexport\s+\{\s*[^}]*\}\s*;?/g, '');
  code = code.replace(/\bexport\s+(const|let|var|function|class|async\s+function)\s+/g, '$1 ');
  // Build AMD define with deps that were actually imported (preserve order of externals for stability)
  const deps = externals.filter((e) => depsInUse.has(e));
  // Also include any depsInUse that weren't in externals (e.g. css side-effects)
  for (const d of depsInUse) if (!deps.includes(d)) deps.push(d);
  const depsArray = deps.map((d) => `'${d}'`).join(', ');
  const depsHeader = deps.length > 0 ? `'${amdId}', [${depsArray}], function(require, exports${deps.map((_, i) => `, dep${i}`).join('')}) {\n` : `'${amdId}', [], function(require, exports) {\n`;
  // Map deps to variable names for the factory args – we already emitted `const X = require('dep')` above,
  // but the AMD `require` inside factory shadows Node require; the emitted requires will resolve via AMD's require.
  // For simplicity we keep the emitted `require` calls; they will be resolved by the AMD loader's require.
  const wrapped = `define(${depsHeader}${code}\n});`;
  return scriptUrlCaptureLine(entryName) + wrapped;
}

function transformEntryBundle(
  entryName: string,
  bundle: Record<string, { type: string; code?: string; map?: unknown; source?: unknown }>,
  opts: { isVite8?: boolean; amdId?: string; externals?: string[] } = {}
): void {
  const chunk = bundle[`${entryName}.js`] as
    | { type: string; code?: string; map?: { mappings: string } | null; source?: unknown }
    | undefined;
  if (!chunk || chunk.type !== 'chunk' || typeof chunk.code !== 'string') {
    return;
  }
  // Preserve sourceMappingURL at EOF: strip it, transform, then re-append so CSS injection doesn't break mapping
  const sourceMapUrlRegex = /\/\/# sourceMappingURL=.*(?:\r?\n)?$/;
  const match = chunk.code.match(sourceMapUrlRegex);
  const sourceMapComment = match ? match[0] : '';
  let codeWithoutMap = sourceMapComment ? chunk.code.slice(0, -sourceMapComment.length) : chunk.code;

  if (opts.isVite8) {
    const amdId = opts.amdId ?? entryName;
    const externals = opts.externals ?? [];
    codeWithoutMap = esToAmd(entryName, codeWithoutMap, amdId, externals);
  } else {
    codeWithoutMap = amdBundleTransform(entryName, codeWithoutMap);
  }
  for (const key of Object.keys(bundle)) {
    const asset = bundle[key];
    if (!asset || asset.type !== 'asset' || !key.endsWith('.css')) {
      continue;
    }
    const css =
      typeof asset.source === 'string'
        ? asset.source
        : Buffer.from(asset.source as ArrayBuffer).toString('utf8');
    codeWithoutMap += inlineStyleCode(css);
    delete bundle[key];
  }

  chunk.code = codeWithoutMap + (sourceMapComment || '');

  // Adjust sourcemap for the prepended capture line (1 line): prepend ';' to mappings
  if (chunk.map && typeof (chunk.map as { mappings?: unknown }).mappings === 'string') {
    const map = chunk.map as { mappings: string };
    if (!map.mappings.startsWith(';')) {
      map.mappings = ';' + map.mappings;
    }
  }
  // Also patch the separate .js.map asset if Rollup emitted it
  const mapAssetKey = `${entryName}.js.map`;
  const mapAsset = bundle[mapAssetKey] as { type: string; source?: unknown } | undefined;
  if (mapAsset && mapAsset.type === 'asset' && chunk.map) {
    try {
      const srcStr =
        typeof mapAsset.source === 'string'
          ? mapAsset.source
          : Buffer.from(mapAsset.source as ArrayBuffer).toString('utf8');
      const parsed = JSON.parse(srcStr) as { mappings?: string };
      if (typeof parsed.mappings === 'string' && !parsed.mappings.startsWith(';')) {
        parsed.mappings = ';' + parsed.mappings;
        (mapAsset as { source: unknown }).source = JSON.stringify(parsed);
      }
    } catch {}
  }
}

/**
 * Closes the remaining byte-compat gaps vs the Rspack path for a single-entry
 * build: prepend the script-URL capture line (same bytes as
 * `SpfxPublicPathPlugin`), rewrite the publicPath sentinel, normalize the AMD
 * id quoting, and inline the emitted CSS asset into the JS bundle (SPFx never
 * loads separate .css files).
 */
function createEntryPlugins(
  entryName: string,
  root: string,
  opts: { isVite8?: boolean; amdId?: string; externals?: string[] } = {}
): unknown[] {
  let moduleCount = 0;
  return [
    {
      name: 'rspfx-public-path',
      generateBundle(
        _options: unknown,
        bundle: Record<string, { type: string; code?: string; source?: unknown }>
      ) {
        transformEntryBundle(entryName, bundle, opts);
      }
    },
    {
      name: 'rspfx-stats',
      buildStart() {
        moduleCount = 0;
      },
      moduleParsed(info: { id?: unknown }) {
        if (typeof info?.id === 'string') {
          moduleCount += 1;
        }
      },
      buildEnd() {
        writeStats(root, process.env[VITE_ENV.entry] ?? entryName, moduleCount);
      }
    }
  ];
}

/**
 * The Vite plugin. Use it in `vite.config.ts` with the same options object as
 * `RspfxPlugin`:
 *
 * ```ts
 * import { rspfxVite } from '@mbsks/rspfx-plugin';
 * export default {
 *   plugins: [rspfxVite({ name: 'my-app', framework: 'react', dev: { ... }, build: { ... } })]
 * };
 * ```
 *
 * - `rspfx build` / direct `vite build` build every web part bundle (one vite
 *   build per entry, since Rollup cannot give each entry its own
 *   `define('id', …)` in a single config), then assemble the release output
 *   (component manifests + `release/` assets) exactly like the Rspack path.
 * - `rspfx dev` / direct `vite dev` serve `/temp/manifests.js`, watch sources,
 *   rebuild the AMD bundles to `dist/` and open the workbench.
 */
export function rspfxVite(options: RspfxPluginOptions): ViteRspfxPlugin {
  const { projectRoot, ...rest } = options;
  const root = projectRoot ?? process.cwd();
  const resolved = resolveConfig(rest);
  let command: 'build' | 'serve' = 'serve';

  const effectiveMode = (): 'development' | 'production' =>
    (process.env[VITE_ENV.mode] as 'development' | 'production' | undefined) ??
    (command === 'serve' ? 'development' : 'production');

  const createConfig = async (overrides: ViteBuildOverrides = {}, entryOverride?: BundleEntry): Promise<Record<string, unknown>> => {
    const project = readProject(root, resolved.paths, resolved.version, resolved);
    const settings = resolveServeSettings({ config: resolved }, project.serveJson);
    const mode = effectiveMode();
    const alsEntry = viteAls.getStore();
    const entry = entryOverride ?? (alsEntry ? alsEntry : selectEntry(project.webParts.entries, process.env[VITE_ENV.entry]));
    const amdId = entryOverride
      ? `${entryOverride.componentIds[0]}_${entryOverride.version}`
      : alsEntry
        ? `${alsEntry.componentIds[0]}_${alsEntry.version}`
        : (process.env[VITE_ENV.amdId] ?? `${entry.componentIds[0]}_${entry.version}`);
    const externals = collectExternals(root, project.externals, project.localizedResources);

    // Dual Vite 7 (Rollup) / Vite 8 (Rolldown) support.
    // Vite 7 uses Rollup which natively supports AMD (`output.format: 'amd'`).
    // Vite 8 uses Rolldown which does NOT support AMD (https://github.com/rolldown/rolldown/issues/2528).
    // For Vite 8 we output ES via Rolldown and post-process to AMD in `transformEntryBundle`.
    const viteVersion = getViteVersion(root);
    const viteMajor = viteVersion ? Number(viteVersion.split('.')[0] ?? '') : undefined;
    const isVite8 = viteMajor !== undefined && Number.isFinite(viteMajor) && viteMajor >= 8;

    const certs =
      mode === 'development' && settings.https
        ? await ensureCertificates(path.join(os.homedir(), '.rspfx', 'certs'), settings.hostname)
        : undefined;

    const fastRefresh =
      command === 'serve' && (process.env[VITE_ENV.fastRefresh] === '1' || (resolved.dev.fastRefresh ?? false));
    const preset = await loadPreset(root, resolved.framework);
    const viteContribs = preset.vite?.({ fastRefresh });
    const define: Record<string, string> = {
      DEBUG: JSON.stringify(mode === 'development'),
      DEPRECATED_UNIT_TEST: JSON.stringify(false),
      'process.env.NODE_ENV': JSON.stringify(mode)
    };
    if (viteContribs?.define) {
      // Allowlist only the known safe keys; drop any RSPFX_* or unknown keys to avoid leakage.
      const allowed = new Set(['DEBUG', 'DEPRECATED_UNIT_TEST', 'process.env.NODE_ENV']);
      for (const [k, v] of Object.entries(viteContribs.define)) {
        if (k.startsWith('RSPFX_') || k.includes('RSPFx')) {
          logger.warn(`Ignoring disallowed define key '${k}' from vite contributions (RSPFx leakage blocked)`);
          continue;
        }
        if (!allowed.has(k)) {
          logger.warn(`Ignoring disallowed define key '${k}' from vite contributions (allowlist: ${[...allowed].join(', ')})`);
          continue;
        }
        define[k] = v;
      }
    }

    // Shared Rollup/Rolldown options.
    // Vite 7 (Rollup) natively supports AMD – use `rollupOptions` with `format:'amd'`.
    // Vite 8 (Rolldown) does not support AMD – use `rolldownOptions` with `format:'es'`
    // and convert to AMD post-bundle in `transformEntryBundle` (see `wrapEsAsAmd`).
    const rollupOptions = isVite8
      ? {
          input: { [entry.name]: entry.import },
          external: externals,
          output: {
            format: 'es',
            entryFileNames: '[name].js',
            chunkFileNames: 'chunk.[name].js',
            assetFileNames: 'assets/[hash][extname]'
          }
        }
      : {
          input: { [entry.name]: entry.import },
          external: externals,
          preserveEntrySignatures: true,
          output: {
            format: 'amd',
            amd: { id: amdId },
            entryFileNames: '[name].js',
            chunkFileNames: 'chunk.[name].js',
            assetFileNames: 'assets/[hash][extname]',
            exports: 'named'
          }
        };

    return {
      root,
      base: './',
      define,
      esbuild: viteContribs?.esbuild,
      plugins: [
        ...createEntryPlugins(entry.name, root, { isVite8, amdId, externals }),
        ...(viteContribs?.plugins ?? [])
      ],
      css: {
        modules: {
          localsConvention: 'asIs',
          scopeBehaviour: 'local' as const
        }
      },
      resolve:
        viteContribs?.resolveExtensions && viteContribs.resolveExtensions.length > 0
          ? { extensions: [...new Set([...VITE_BASE_EXTENSIONS, ...viteContribs.resolveExtensions])] }
          : undefined,
      optimizeDeps: {
        cacheDir: path.join(root, '.vite'),
        include: ['react', 'react-dom']
      },
      server: {
        host: settings.hostname,
        port: settings.port,
        https: certs ? { key: certs.key, cert: certs.cert } : settings.https ? true : false,
        open: false
      },
      // Future-proof experimental flag: Vite 7 ignores unknown keys, Vite 8
      // currently has no Rollup fallback – this is a no-op today but documents
      // intent and will take effect if a future Vite 8.x re-introduces a
      // `rolldown: false` / `builder: 'rollup'` escape hatch.
      // See https://vite.dev/guide/migration and https://github.com/vitejs/vite/discussions/22820
      experimental: {
        // `rolldown: false` is the hypothetical flag discussed for Vite 8 to
        // force Rollup. It is ignored on Vite 7 and currently not implemented
        // on Vite 8, but including it makes the config forward-compatible.
        rolldown: false
      } as unknown as Record<string, unknown>,
      build: {
        outDir: resolved.build.outDir,
        emptyOutDir: overrides.emptyOutDir ?? false,
        cssCodeSplit: false,
        ...(overrides.minify !== undefined
          ? { minify: overrides.minify }
          : resolved.build.minify !== undefined
            ? { minify: resolved.build.minify }
            : {}),
        ...(overrides.sourcemap !== undefined
          ? {
              sourcemap:
                overrides.sourcemap === true && mode === 'production' ? 'hidden' : overrides.sourcemap
            }
          : command === 'serve'
            ? { sourcemap: true }
            : resolved.build.sourcemap
              ? { sourcemap: mode === 'production' ? 'hidden' : true }
              : {}),
        rollupOptions,
        // Vite 8 alias – same object, Rolldown reads this key preferentially
        rolldownOptions: rollupOptions
      } as Record<string, unknown>
    };
  };

  const currentEntryName = (): string => {
    const alsEntry = viteAls.getStore();
    if (alsEntry) return alsEntry.name;
    const project = readProject(root, resolved.paths, resolved.version, resolved);
    return process.env[VITE_ENV.entry] ?? project.webParts.entries[0]!.name;
  };

  let moduleCount = 0;

  return {
    name: 'rspfx',
    [RSPFX_PLUGIN_MARKER]: true,
    [RSPFX_PLUGIN_OPTIONS]: resolved,

    async config(_config, env) {
      command = env.command === 'build' ? 'build' : 'serve';
      return createConfig({ emptyOutDir: true });
    },

    buildStart() {
      moduleCount = 0;
    },

    moduleParsed(info: { id?: unknown }) {
      if (typeof info?.id === 'string') {
        moduleCount += 1;
      }
    },

    buildEnd() {
      try {
        writeStats(root, currentEntryName(), moduleCount);
      } catch {
        // No web parts discovered — nothing to record.
      }
    },

    generateBundle(
      _options: unknown,
      bundle: Record<string, { type: string; code?: string; source?: unknown }>
    ) {
      if (command !== 'build') {
        return;
      }
      let entryName: string;
      try {
        entryName = currentEntryName();
      } catch {
        return;
      }
      transformEntryBundle(entryName, bundle);
    },

    async configureServer(server) {
      const project = readProject(root, resolved.paths, resolved.version, resolved);
      const settings = resolveServeSettings({ config: resolved }, project.serveJson);
      const mode = resolveServeMode({ mode: undefined, config: resolved }, settings.tenantDomain);
      const reload = createReloadController();
      const originRef: { value: string } = { value: settings.origin };
      const fastRefresh =
        command === 'serve' &&
        (process.env[VITE_ENV.fastRefresh] === '1' || (resolved.dev.fastRefresh ?? false));
      const refreshRuntime = fastRefresh ? createRefreshRuntime(resolved.framework) : undefined;
      const entryModuleIds: Record<string, string> = {};
      project.webParts.bundles.forEach((bundle, index) => {
        entryModuleIds[project.webParts.manifestIds[index]!] = bundle.bundleName;
      });
      const regenerator = createManifestRegenerator({
        projectRoot: root,
        production: false,
        origin: () => originRef.value,
        packageVersion: project.webParts.packageVersion,
        entries: project.webParts.entries,
        externals: collectExternals(root, project.externals, project.localizedResources),
        localizedResources: project.localizedResources,
        webpartsDir: resolved.paths?.webpartsDir,
        extensionsDir: resolved.paths?.extensionsDir,
        librariesDir: resolved.paths?.librariesDir,
        entryModuleIds,
        refreshRuntime,
        bundleUrlSuffix: () => `?t=${reload.current}`
      });

      void createHookBus(getPlugins(), { logger: logger.child({ phase: 'beforeStart' }) })
        .emitBeforeStart({ mode, port: settings.port })
        .then((result) => {
          if (!result.ok) logger.warn(`beforeStart hook failed: ${result.error.message}`);
        });

      const rebuildAll = async (): Promise<void> => {
        const vite = await importViteFrom(root);
        await Promise.all(
          project.webParts.entries.map((entry, index) =>
            viteAls.run(entry, async () => {
              await (vite as unknown as ViteBuildApi).build({
                ...(await createConfig({ minify: false, sourcemap: true, emptyOutDir: index === 0 }, entry))
              });
            })
          )
        );
        await regenerator.regenerate();
        reload.tick();
      };

      let timer: ReturnType<typeof setTimeout> | undefined;
      const scheduleRebuild = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void rebuildAll().catch((error) => {
            logger.error(
              `Vite rebuild failed: ${error instanceof Error ? error.message : String(error)}`
            );
          });
        }, 300);
      };

      void rebuildAll().catch((error) => {
        logger.error(`Initial Vite build failed: ${error instanceof Error ? error.message : String(error)}`);
      });

      const devServer = server as ConnectMiddlewareServer;
      devServer.watcher?.on('change', scheduleRebuild);
      devServer.watcher?.on('add', scheduleRebuild);
      devServer.watcher?.on('unlink', scheduleRebuild);

      devServer.middlewares.use('/temp/manifests.js', (_req, res) => {
        const response = res as ConnectResponse;
        void regenerator
          .regenerate()
          .then(() => {
            response.setHeader('Content-Type', 'application/javascript');
            response.setHeader('Cache-Control', 'no-store');
            response.end(regenerator.manifestsJs + reload.clientScript);
          })
          .catch((error: unknown) => {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : String(error));
          });
      });

      devServer.middlewares.use(reload.path, (_req, res) => {
        reload.handle(_req, res as ConnectResponse);
      });

      // Browser open is once-only on initial dev server start — never on HMR/rebuild.
      // Uses `httpServer.once('listening')` (not `on`) and `browserOpened` guard.
      // Respects CLI `--browser` via `RSPFX_OPEN_BROWSER` env (set by `rspfx dev`),
      // falling back to `config.dev.openBrowser`. Rebuild hooks (`rebuildAll`/
      // `scheduleRebuild`) intentionally do NOT open the browser.
      let browserOpened = false;
      devServer.httpServer?.once('listening', () => {
        originRef.value = updateOriginWithActualPort(settings, devServer);
        const workbenchUrl = buildWorkbenchUrl({ ...settings, origin: originRef.value }, resolved);
        const shouldOpenBrowser =
          process.env.RSPFX_OPEN_BROWSER === '1'
            ? true
            : process.env.RSPFX_OPEN_BROWSER === '0'
              ? false
              : (resolved.dev.openBrowser ?? false);
        if (!browserOpened && workbenchUrl && shouldOpenBrowser) {
          browserOpened = true;
          openBrowser(workbenchUrl);
          logger.info(`Workbench: ${workbenchUrl}`);
        }
        {
          const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'afterStart' }) });
          void bus.emitAfterStart({ url: originRef.value }).catch((e) => logger.warn(`afterStart hook failed: ${e instanceof Error ? e.message : String(e)}`));
        }
      });
      logger.success(`Manifest server running at ${settings.origin}/temp/manifests.js`);
    },

    async closeBundle() {
      if (command !== 'build') {
        return;
      }
      const project = readProject(root, resolved.paths, resolved.version, resolved);
      const vite = await importViteFrom(root);
      await Promise.all(
        project.webParts.entries.slice(1).map((entry) =>
          viteAls.run(entry, async () => {
            await (vite as unknown as ViteBuildApi).build({
              ...(await createConfig({}, entry))
            });
          })
        )
      );
      // Vite 7 with cssCodeSplit:false may still emit a lone CSS asset to dist/assets/*.css
      // outside of Rollup's bundle map (not visible in generateBundle). Inline any leftover
      // CSS files from disk into each entry's JS so SPFx loads styles via a single AMD bundle.
      try {
        inlineRemainingCssFiles(root, resolved.build.outDir ?? 'dist', project.webParts.entries.map((e) => e.name));
      } catch (error) {
        logger.warn(`Failed to inline CSS from disk: ${error instanceof Error ? error.message : String(error)}`);
      }
      await assembleRelease({
        projectRoot: root,
        config: resolved,
        project,
        externals: collectExternals(root, project.externals, project.localizedResources),
        outputFiles: project.webParts.entries.map((entry) => `${entry.name}.js`),
        production: true
      });
    }
  };
}

function updateOriginWithActualPort(
  settings: ServeSettings,
  devServer: ConnectMiddlewareServer
): string {
  try {
    const address = (devServer.httpServer as { address(): unknown } | undefined)?.address();
    if (address && typeof address === 'object' && 'port' in address) {
      return `${settings.scheme}://${settings.hostname}:${(address as { port: number }).port}`;
    }
  } catch {
    // Fall back to the configured origin.
  }
  return settings.origin;
}

function selectEntry(
  entries: BundleEntry[],
  entryName: string | undefined
): BundleEntry {
  const entry = entryName
    ? entries.find((candidate) => candidate.name === entryName)
    : entries[0];
  if (!entry) {
    throw new RspfxError(
      'VITE_NO_ENTRY',
      entryName
        ? `No web part bundle "${entryName}" found. Discovered: ${entries.map((e) => e.name).join(', ') || 'none'}`
        : 'No web part bundles found. Check config/config.json or src/webparts/.'
    );
  }
  return entry;
}

async function withEnv(entry: BundleEntry, fn: () => Promise<void>): Promise<void> {
  const previousEntry = process.env[VITE_ENV.entry];
  const previousAmdId = process.env[VITE_ENV.amdId];
  process.env[VITE_ENV.entry] = entry.name;
  process.env[VITE_ENV.amdId] = `${entry.componentIds[0]}_${entry.version}`;
  try {
    await fn();
  } finally {
    if (previousEntry === undefined) {
      delete process.env[VITE_ENV.entry];
    } else {
      process.env[VITE_ENV.entry] = previousEntry;
    }
    if (previousAmdId === undefined) {
      delete process.env[VITE_ENV.amdId];
    } else {
      process.env[VITE_ENV.amdId] = previousAmdId;
    }
  }
}

async function importViteFrom(root: string): Promise<unknown> {
  let resolved: string;
  try {
    // Use filesystem path directly (no file:// URL) so Node's resolver never
    // sees an encoded %20. This resolves to Vite's CJS entry (index.cjs) via
    // require.resolve, which avoids ESM file URL %20 handling in Vite/Vitest.
    const requireFromProject = createRequire(path.join(root, 'package.json'));
    resolved = decodeIfEncoded(requireFromProject.resolve('vite'));
  } catch (error) {
    // Fallback to the rspfx installation's vite (covers temp fixtures outside the project tree and pnpm isolated layouts).
    try {
      const basePath = decodeIfEncoded(import.meta.url);
      const fallbackRequire = createRequire(basePath);
      resolved = decodeIfEncoded(fallbackRequire.resolve('vite'));
    } catch {
      throw new RspfxError(
        'VITE_NOT_FOUND',
        'Vite is not installed in this project. Add "vite" to devDependencies (rspfx dev/build use the project-local Vite).',
        error as unknown as Error
      );
    }
  }
  resolved = decodeIfEncoded(resolved);
  // Prefer CJS require to avoid Vitest/Vite dev server ESM transform with %20.
  // Vite's CJS build is deprecated but still functional and avoids file URL encoding.
  try {
    const req = createRequire(fileURLToPath(import.meta.url));
    const mod = req(resolved);
    patchViteForSpaces(mod);
    return mod;
  } catch {
    const viteMod = await import(pathToFileURL(resolved).href);
    patchViteForSpaces(viteMod);
    return viteMod;
  }
}

function patchViteForSpaces(_viteMod: unknown): void {
  // Vite's dev server loadAndTransform does `file = cleanUrl(id)` then
  // `fsp.readFile(file)`. When the workspace path contains a space, `id`
  // / `url` may be "/Volumes/New%20Volume/..." and cleanUrl leaves %20 literal.
  // Monkey-patch both fs.promises and fs/promises to decode %20 on the fly.
  const patch = (target: unknown): void => {
    try {
      const fsp = target as { readFile: typeof fs.promises.readFile; _rspfxPatched?: boolean };
      if (!fsp || typeof fsp.readFile !== 'function' || fsp._rspfxPatched) return;
      const origReadFile = fsp.readFile.bind(fsp);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fsp.readFile as any) = (file: string, ...args: unknown[]) => {
        if (typeof file === 'string' && file.includes('%')) {
          try {
            const decoded = decodeURIComponent(file);
            if (decoded !== file) file = decoded;
          } catch {
            // keep original
          }
        }
        // @ts-expect-error variadic
        return origReadFile(file, ...args);
      };
      fsp._rspfxPatched = true;
    } catch {
      // best-effort
    }
  };
  patch(fs.promises);
  try {
    // Also patch the separate 'node:fs/promises' ESM namespace that Vite imports
    // as `import fsp from 'node:fs/promises'`.
    const fspModule = createRequire(fileURLToPath(import.meta.url))('node:fs/promises') as unknown;
    patch(fspModule);
    // Also patch 'fs/promises' without node: prefix (Vite also imports it)
    try {
      const fspModule2 = createRequire(fileURLToPath(import.meta.url))('fs/promises') as unknown;
      patch(fspModule2);
    } catch {}
  } catch {}
}
