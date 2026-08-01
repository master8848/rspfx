export interface ComponentManifest {
  id: string;
  alias: string;
  componentType: string;
  version: string;
  manifestVersion: number;
  loaderConfig: {
    internalModuleBaseUrls: string[];
    entryModuleId: string;
    scriptResources: Record<string, unknown>;
    exportName?: string;
  };
  [k: string]: unknown;
}

export interface ManifestContext {
  projectRoot: string;
  production: boolean;
  baseUrls: { debug: string; release: string[] };
  packageVersion: string;
  bundleFiles: Map<string, string>;
  externals: string[];
}
