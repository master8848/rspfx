import { SPFX_DEFAULT_TARGET } from './versions.js';
import type { SpfxTarget } from './versions.js';

export type FrameworkIdCore = 'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });

export interface DevConfig {
  port?: number;
  https?: boolean;
  hostname?: string;
  workbench?: boolean;
  fastRefresh?: boolean;
  openBrowser?: boolean;
  tenantUrl?: string;
  initialPage?: string;
}

export interface BuildConfig {
  /** @deprecated - set `devtool` in your rspack/vite/rsbuild config; this is scaffold-only default. */
  sourcemap?: boolean;
  /** @deprecated - set `optimization.minimize` / `build.minify` in your rspack/vite/rsbuild config; this is scaffold-only default. */
  minify?: boolean;
  /**
   * @deprecated - must remain `false` for SPFx AMD correctness; chunks break the single-bundle contract. Set `optimization.splitChunks` in bundler config if you must override.
   * This is scaffold-only default.
   */
  splitChunks?: boolean;
  outDir?: string;
  releaseDir?: string;
}

export interface PathsConfig {
  srcDir?: string;
  webpartsDir?: string;
  extensionsDir?: string;
  librariesDir?: string;
  configDir?: string;
}

export interface DeployConfig {
  tenantUrl?: string;
  username?: string;
  password?: string;
  appCatalogSiteUrl?: string;
}

export interface TeamsConfig {
  enabled?: boolean;
}

export interface RspfxConfig {
  name: string;
  /** Build-time package version used in AMD library names and manifests; overrides package.json "version". */
  version?: string;
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  dev: DevConfig;
  build: BuildConfig;
  paths?: PathsConfig;
  deploy?: DeployConfig;
  /** Teams integration; when enabled, teams/manifest.json and icons are auto-created. Disabled by default. */
  teams?: boolean | TeamsConfig;
}

export function defineConfig<const T extends RspfxConfig>(config: T): T {
  return config;
}

export type Issue = { path: (string | number)[]; message: string; code: string };
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function tryResolveConfig(raw: unknown): Result<RspfxConfig, Issue[]> {
  const issues: Issue[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: [{ path: [], message: 'config must be an object', code: 'INVALID_PACKAGE_CONFIG' }] };
  }
  const cfg = raw as Partial<RspfxConfig> & Record<string, unknown>;
  const knownKeys = new Set(['name', 'version', 'framework', 'spfxVersion', 'dev', 'build', 'paths', 'deploy', 'teams']);
  for (const k of Object.keys(cfg)) {
    if (!knownKeys.has(k)) {
      issues.push({ path: [k], message: `unknown key "${k}"`, code: 'INVALID_OPTION' });
    }
  }
  if (!cfg.name || typeof cfg.name !== 'string') {
    issues.push({ path: ['name'], message: '"name" is required', code: 'INVALID_PACKAGE_CONFIG' });
  }
  if (issues.length > 0) return { ok: false, error: issues };
  try {
    const resolved = resolveConfig(cfg as RspfxConfig);
    return { ok: true, value: resolved };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: [{ path: [], message: msg, code: 'INVALID_PACKAGE_CONFIG' }] };
  }
}

export const configDefaults: Required<Pick<RspfxConfig, 'dev' | 'build'>> & { paths: Required<PathsConfig> } = {
  dev: {
    port: 4321,
    https: true,
    hostname: 'localhost',
    workbench: true,
    fastRefresh: false,
    openBrowser: false
  },
  build: {
    sourcemap: false,
    minify: true,
    splitChunks: false,
    outDir: 'dist',
    releaseDir: 'release'
  },
  paths: {
    srcDir: 'src',
    webpartsDir: 'src/webparts',
    extensionsDir: 'src/extensions',
    librariesDir: 'src/libraries',
    configDir: 'config'
  }
};

export function resolvePathDefaults(paths?: PathsConfig): Required<PathsConfig> {
  return {
    srcDir: paths?.srcDir ?? configDefaults.paths.srcDir,
    webpartsDir: paths?.webpartsDir ?? configDefaults.paths.webpartsDir,
    extensionsDir: paths?.extensionsDir ?? configDefaults.paths.extensionsDir,
    librariesDir: paths?.librariesDir ?? configDefaults.paths.librariesDir,
    configDir: paths?.configDir ?? configDefaults.paths.configDir
  };
}

/** @deprecated use tryResolveConfig — this wrapper throws on validation error */
export function resolveConfig(config: RspfxConfig | Partial<RspfxConfig>): RspfxConfig {
  if (!config.name) {
    throw new Error('"name" is required in the bundler config (rspack.config.ts)');
  }
  let teams: TeamsConfig | undefined;
  if (config.teams !== undefined) {
    if (typeof config.teams === 'boolean') {
      teams = { enabled: config.teams };
    } else if (typeof config.teams === 'object' && config.teams !== null) {
      teams = { enabled: !!(config.teams as TeamsConfig).enabled };
    }
  }
  return {
    name: config.name,
    ...(config.version !== undefined ? { version: config.version } : {}),
    framework: config.framework ?? 'vanilla',
    spfxVersion: config.spfxVersion ?? SPFX_DEFAULT_TARGET,
    dev: {
      port: config.dev?.port ?? configDefaults.dev.port,
      https: config.dev?.https ?? configDefaults.dev.https,
      hostname: config.dev?.hostname ?? configDefaults.dev.hostname,
      workbench: config.dev?.workbench ?? configDefaults.dev.workbench,
      fastRefresh: config.dev?.fastRefresh ?? configDefaults.dev.fastRefresh,
      openBrowser: config.dev?.openBrowser ?? configDefaults.dev.openBrowser,
      ...(config.dev?.tenantUrl !== undefined ? { tenantUrl: config.dev.tenantUrl } : {}),
      ...(config.dev?.initialPage !== undefined ? { initialPage: config.dev.initialPage } : {})
    },
    build: {
      sourcemap: config.build?.sourcemap ?? configDefaults.build.sourcemap,
      minify: config.build?.minify ?? configDefaults.build.minify,
      splitChunks: config.build?.splitChunks ?? configDefaults.build.splitChunks,
      outDir: config.build?.outDir ?? configDefaults.build.outDir,
      releaseDir: config.build?.releaseDir ?? configDefaults.build.releaseDir
    },
    paths: resolvePathDefaults(config.paths),
    ...(config.deploy !== undefined ? { deploy: config.deploy } : {}),
    ...(teams !== undefined ? { teams } : {})
  };
}
