import type { BuildConfig as BuildConfigType, FrameworkId as FrameworkIdType } from '@mbsks/rspfx-core';

export type { BuildConfig, FrameworkId } from '@mbsks/rspfx-core';

export interface BundleEntry {
  name: string;
  import: string;
  componentIds: string[];
  version: string;
}

export interface CompileContext {
  projectRoot: string;
  framework: FrameworkIdType;
  fastRefresh: boolean;
  production: boolean;
  entries: BundleEntry[];
  externals: string[];
  build: BuildConfigType;
  serveMode?: boolean;
  additionalPlugins?: unknown[];
  swcContributions?: Record<string, unknown>[];
  tailwind?: boolean;
}

export interface BuildResult {
  stats: unknown;
  outputFiles: string[];
}

export interface WatchHandle {
  close(): Promise<void>;
}

export interface DevServerOptions {
  port?: number;
  hostname?: string;
  https?: boolean;
  certs?: { key: string; cert: string };
  hot?: boolean;
  allowedHosts?: 'all' | string[];
  routes?: { path: string; handler: (req: unknown, res: unknown) => void }[];
  staticFolders?: { path: string; urlPrefix: string }[];
}

export interface StartDevServerResult {
  close(): Promise<void>;
  port: number;
  compiler: unknown;
  onEmit(cb: (stats: unknown) => void): void;
}
