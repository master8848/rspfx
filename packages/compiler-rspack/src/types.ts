import type { BuildConfig as BuildConfigType, FrameworkId as FrameworkIdType } from '@mbsks/rspfx-core';

export type { BuildConfig, FrameworkId } from '@mbsks/rspfx-core';

export interface BundleEntry {
  name: string;
  import: string;
  componentIds: string[];
  version: string;
}

export interface LocalizedResourceFile {
  locale: string;
  path: string;
}

export interface LocalizedResource {
  name: string;
  files: LocalizedResourceFile[];
}

/**
 * A function external (webpack-compatible): receives the resolve data and
 * returns the AMD module name to externalize, or `undefined` to keep bundling.
 */
export interface ExternalMatcher {
  (data: { request?: string }): string | undefined;
}

export interface CompileContext {
  projectRoot: string;
  framework: FrameworkIdType;
  fastRefresh: boolean;
  production: boolean;
  entries: BundleEntry[];
  externals: (string | ExternalMatcher)[];
  aliases?: Record<string, string>;
  localizedResources?: LocalizedResource[];
  build: BuildConfigType;
  serveMode?: boolean;
  additionalPlugins?: unknown[];
  swcContributions?: Record<string, unknown>[];
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
  routes?: {
    path: string;
    handler: (req: unknown, res: unknown, next?: (err?: unknown) => void) => void;
  }[];
  staticFolders?: { path: string; urlPrefix: string }[];
}

export interface StartDevServerResult {
  close(): Promise<void>;
  port: number;
  compiler: unknown;
  onEmit(cb: (stats: unknown) => void): () => void;
}
