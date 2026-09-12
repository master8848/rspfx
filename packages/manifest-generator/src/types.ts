import * as v from 'valibot';

const MANIFEST_DOCS = 'https://github.com/master8848/rspfx#configuration';
export const ComponentManifestSchema = v.object({
  id: v.pipe(
    v.string('manifest id must be a string UUID — fix: set "id": "00000000-0000-4000-a000-000000000000" in *.manifest.json (see ' + MANIFEST_DOCS + ')'),
    v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'manifest id must be a UUID like "00000000-0000-4000-a000-000000000000" (got invalid) — fix: set "id": "00000000-0000-4000-a000-000000000000" in *.manifest.json (see ' + MANIFEST_DOCS + ')')
  ),
  alias: v.pipe(v.string('manifest alias must be a string — fix: set "alias": "HelloWebPart" in *.manifest.json (see ' + MANIFEST_DOCS + ')'), v.minLength(1, 'manifest alias must be non-empty — fix: set "alias": "HelloWebPart" in *.manifest.json (see ' + MANIFEST_DOCS + ')')),
  componentType: v.string('manifest componentType must be a string — fix: set "componentType": "WebPart" in *.manifest.json (see ' + MANIFEST_DOCS + ')'),
  version: v.pipe(
    v.string('manifest version must be a string — fix: set "version": "1.0.0.0" in *.manifest.json (see ' + MANIFEST_DOCS + ')'),
    v.regex(/^\d+\.\d+\.\d+(\.\d+)?$/, 'manifest version must be semver like "1.0.0.0" (got invalid) — fix: set "version": "1.0.0.0" in *.manifest.json (see ' + MANIFEST_DOCS + ')')
  ),
  manifestVersion: v.pipe(v.number('manifest manifestVersion must be a number — fix: set "manifestVersion": 2 in *.manifest.json (see ' + MANIFEST_DOCS + ')'), v.integer('manifest manifestVersion must be an integer — fix: set "manifestVersion": 2 in *.manifest.json (see ' + MANIFEST_DOCS + ')')),
  loaderConfig: v.object({
    internalModuleBaseUrls: v.array(v.string()),
    entryModuleId: v.string(),
    scriptResources: v.record(v.string(), v.unknown()),
    exportName: v.optional(v.string())
  })
});

export type ManifestIssue = { path: (string | number)[]; message: string; code: string };
export type ManifestResult<T> = { ok: true; value: T } | { ok: false; error: ManifestIssue[] };

function mapManifestIssues(issues: readonly v.BaseIssue<unknown>[], filePath: string): ManifestIssue[] {
  return issues.map((issue) => {
    const p = (issue as unknown as { path?: { key: string | number }[] }).path;
    const dotPath: (string | number)[] = p ? p.map((seg) => (seg as { key: string | number }).key) : [];
    let message = (issue as { message?: string }).message ?? 'Invalid value';
    const inputVal = (issue as { input?: unknown }).input;
    if (inputVal !== undefined && !message.includes('(got')) {
      try {
        const got = JSON.stringify(inputVal);
        const short = got.length > 60 ? got.slice(0, 57) + '...' : got;
        if (message.includes(' — fix:')) message = message.replace(' — fix:', ` (got ${short}) — fix:`);
        else message = `${message} (got ${short})`;
      } catch {}
    }
    if (!message.includes(filePath)) message = `${message} in ${filePath}`;
    if (!message.includes('fix:')) message += ` — fix: check ${filePath} (see ${MANIFEST_DOCS})`;
    return { path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' };
  });
}

export function validateComponentManifestJson(raw: unknown, filePath = '*.manifest.json'): ManifestResult<v.InferOutput<typeof ComponentManifestSchema>> {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw as string);
    } catch (e) {
      return {
        ok: false,
        error: [
          {
            path: [],
            message: `manifest is not valid JSON in ${filePath}: ${e instanceof Error ? e.message : String(e)} — fix: ensure ${filePath} is valid JSON with {"id":"00000000-0000-4000-a000-000000000000","alias":"HelloWebPart","componentType":"WebPart","version":"1.0.0.0","manifestVersion":2} (see ${MANIFEST_DOCS})`,
            code: 'CONFIG_VALIDATION_FAILED'
          }
        ]
      };
    }
  }
  const result = v.safeParse(ComponentManifestSchema, raw);
  if (!result.success) return { ok: false, error: mapManifestIssues(result.issues as unknown as v.BaseIssue<unknown>[], filePath) };
  return { ok: true, value: result.output };
}

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

export interface LocalizedResourceEntry {
  name: string;
  locales: string[];
}

export interface SyntheticManifestMeta {
  id: string;
  bundleName: string;
  title?: string;
  description?: string;
  iconName?: string;
}

export interface ManifestContext {
  projectRoot: string;
  production: boolean;
  baseUrls: { debug: string; release: string[] };
  packageVersion: string;
  bundleFiles: Map<string, string>;
  externals: string[];
  localizedResources?: LocalizedResourceEntry[];
  webpartsDir?: string;
  extensionsDir?: string;
  librariesDir?: string;
  entryModuleIds?: Record<string, string>;
  syntheticManifests?: SyntheticManifestMeta[];
}
