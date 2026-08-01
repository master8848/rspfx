export type FrameworkId = 'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte';
export type SpfxTarget = '1.20' | '1.21' | '1.22';

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
  sourcemap?: boolean;
  minify?: boolean;
  splitChunks?: boolean;
  outDir?: string;
  releaseDir?: string;
}

export interface PlaygroundConfig {
  port?: number;
  enabled?: boolean;
}

export interface DeployConfig {
  tenantUrl?: string;
  username?: string;
  password?: string;
  appCatalogSiteUrl?: string;
}

export interface RspfxConfig {
  name: string;
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  fluent: boolean;
  language: 'typescript' | 'javascript';
  styling: 'css' | 'scss' | 'tailwind';
  dev: DevConfig;
  build: BuildConfig;
  playground?: PlaygroundConfig;
  deploy?: DeployConfig;
}

export function defineConfig(config: RspfxConfig): RspfxConfig {
  return config;
}

export function resolveConfig(config: Partial<RspfxConfig>): RspfxConfig {
  if (!config.name) {
    throw new Error('rspfx: "name" is required in rspfx.config');
  }
  return {
    name: config.name,
    framework: config.framework ?? 'vanilla',
    spfxVersion: config.spfxVersion ?? '1.22',
    fluent: config.fluent ?? false,
    language: config.language ?? 'typescript',
    styling: config.styling ?? 'scss',
    dev: {
      port: config.dev?.port ?? 4321,
      https: config.dev?.https ?? true,
      hostname: config.dev?.hostname ?? 'localhost',
      workbench: config.dev?.workbench ?? true,
      fastRefresh: config.dev?.fastRefresh ?? false,
      openBrowser: config.dev?.openBrowser ?? true,
      ...(config.dev?.tenantUrl !== undefined ? { tenantUrl: config.dev.tenantUrl } : {}),
      ...(config.dev?.initialPage !== undefined ? { initialPage: config.dev.initialPage } : {})
    },
    build: {
      sourcemap: config.build?.sourcemap ?? false,
      minify: config.build?.minify ?? true,
      splitChunks: config.build?.splitChunks ?? false,
      outDir: config.build?.outDir ?? 'dist',
      releaseDir: config.build?.releaseDir ?? 'release'
    },
    ...(config.playground !== undefined ? { playground: config.playground } : {}),
    ...(config.deploy !== undefined ? { deploy: config.deploy } : {})
  };
}
