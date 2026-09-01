import * as v from 'valibot';
import { DEFAULT_DEV_PORT } from './constants.js';
import { SPFX_DEFAULT_TARGET, getSpfxVersions } from './versions.js';
import type { SpfxTarget } from './versions.js';

// ---------------------------------------------------------------------------
// Docs & hints — included in every validation message so user/AI knows how to fix
// See https://github.com/master8848/rspfx#configuration (fact home: CHANGELOG.md)
// Config files: rspfx.config.ts or rspfx.config.js (also .mjs/.cjs)
// ---------------------------------------------------------------------------
const DOCS_LINK = 'https://github.com/master8848/rspfx#configuration';
const CONFIG_FILE_HINT = 'rspfx.config.ts or rspfx.config.js';

// Helper to build actionable suffix
function hint(example: string): string {
  return ` — fix: ${example} in ${CONFIG_FILE_HINT} (see ${DOCS_LINK})`;
}

// ---------------------------------------------------------------------------
// TryComponent
// ---------------------------------------------------------------------------
export const TryComponentSchema = v.object({
  name: v.pipe(
    v.string('tryComponents[].name must be a string' + hint('set tryComponents: [{ name: "Hello" }]')),
    v.minLength(1, 'tryComponents[].name must be non-empty' + hint('set tryComponents: [{ name: "Hello" }]')),
    v.check((val) => val.trim().length > 0, 'tryComponents[].name must be non-empty' + hint('set tryComponents: [{ name: "Hello" }]'))
  ),
  /** Start location: file or directory. Relative to project root. Fallback is paths.webpartsDir/<name>/ */
  entry: v.optional(v.pipe(v.string('tryComponents[].entry must be a string' + hint('set tryComponents: [{ name: "Hello", entry: "src/webparts/hello/HelloWebPart.ts" }]')))),
  title: v.optional(v.string('tryComponents[].title must be a string' + hint('set tryComponents: [{ name: "Hello", title: "Hello" }]'))),
  description: v.optional(v.string('tryComponents[].description must be a string' + hint('set tryComponents: [{ name: "Hello" }]'))),
  iconName: v.optional(v.string('tryComponents[].iconName must be a string' + hint('set tryComponents: [{ name: "Hello", iconName: "Page" }]')))
});

export type TryComponent = v.InferOutput<typeof TryComponentSchema>;

export const TryComponentsSchema = v.array(TryComponentSchema);

export type FrameworkIdCore = 'vanilla' | 'react' | 'solid' | 'vue' | 'preact' | 'svelte';
export type FrameworkId = FrameworkIdCore | (string & { __custom?: never });

// ---------------------------------------------------------------------------
// FrameworkIdSchema
// ---------------------------------------------------------------------------
/**
 * Framework id schema — validates known frameworks but allows custom strings.
 *
 * Known ids: "vanilla", "react", "solid", "vue", "preact", "svelte".
 * Custom ids are allowed (e.g. "my-custom") — must be non-empty string.
 *
 * @example fix: framework: "react" in rspfx.config.ts
 * @example custom: framework: "my-framework" in rspfx.config.ts
 */
export const FrameworkIdSchema = v.union(
  [
    v.literal('vanilla'),
    v.literal('react'),
    v.literal('solid'),
    v.literal('vue'),
    v.literal('preact'),
    v.literal('svelte'),
    v.pipe(
      v.string('framework must be a string (got non-string)' + hint('set framework: "react"')),
      v.check((val) => val.trim().length > 0, 'framework must be non-empty string' + hint('set framework: "react"'))
    )
  ],
  'framework must be one of "vanilla", "react", "solid", "vue", "preact", "svelte" or a custom framework id' +
    hint('set framework: "react"')
);

// ---------------------------------------------------------------------------
// SpfxVersionSchema
// ---------------------------------------------------------------------------
/**
 * SPFx version schema — validated against the runtime registry (getSpfxVersions()).
 * Use registerSpfxVersion() to add custom versions; validation is dynamic.
 *
 * @example fix: spfxVersion: "1.23" in rspfx.config.ts
 */
export const SpfxVersionSchema = v.pipe(
  v.string('spfxVersion must be a string like "1.23"' + hint('set spfxVersion: "1.23"')),
  v.check(
    (val) => getSpfxVersions().some((ver) => ver.target === val),
    // message computed dynamically on parse; fallback shows current allowed at call time
    `spfxVersion must be one of ${getSpfxVersions()
      .map((ver) => ver.target)
      .join(', ')}` + hint('set spfxVersion: "1.23"')
  )
);

// ---------------------------------------------------------------------------
// DevConfigSchema
// ---------------------------------------------------------------------------
/**
 * Dev server config schema.
 *
 * Validates dev.* fields with human-friendly messages that include
 * expected vs got and a fix hint pointing to rspfx.config.ts.
 *
 * @example
 * ```ts
 * // rspfx.config.ts
 * import { defineConfig } from '@mbsks/rspfx-core';
 * export default defineConfig({
 *   name: 'my-app',
 *   dev: { port: 4321, https: true, hostname: 'localhost' }
 * });
 * ```
 * Fix example: dev.port must be 1024-65535 (got 80) — fix: set dev: { port: 4321 } in rspfx.config.ts
 */
export const DevConfigSchema = v.strictObject(
  {
    port: v.optional(
      v.pipe(
        v.number('dev.port must be a number' + hint('set dev: { port: 4321 }')),
        v.integer('dev.port must be an integer' + hint('set dev: { port: 4321 }')),
        v.minValue(1024, 'dev.port must be >= 1024' + hint('set dev: { port: 4321 }')),
        v.maxValue(65535, 'dev.port must be <= 65535 (got out of range)' + hint('set dev: { port: 4321 }'))
      ),
      // also catch the combined range in one message for ergonomics via check
      // valibot will surface min/max messages above; keep this as docs
    ),
    https: v.optional(v.boolean('dev.https must be a boolean (true/false)' + hint('set dev: { https: true }'))),
    hostname: v.optional(
      v.pipe(
        v.string('dev.hostname must be a string' + hint('set dev: { hostname: "localhost" }')),
        v.minLength(1, 'dev.hostname must be non-empty' + hint('set dev: { hostname: "localhost" }'))
      )
    ),
    workbench: v.optional(v.boolean('dev.workbench must be a boolean' + hint('set dev: { workbench: true }'))),
    fastRefresh: v.optional(
      v.boolean('dev.fastRefresh must be a boolean' + hint('set dev: { fastRefresh: false }'))
    ),
    openBrowser: v.optional(
      v.boolean('dev.openBrowser must be a boolean' + hint('set dev: { openBrowser: false }'))
    ),
    tenantUrl: v.optional(
      v.pipe(
        v.string(
          'dev.tenantUrl must be a string URL like "https://contoso.sharepoint.com"' +
            hint('set dev: { tenantUrl: "https://contoso.sharepoint.com" }')
        ),
        v.url(
          'dev.tenantUrl must be a valid URL like "https://contoso.sharepoint.com"' +
            hint('set dev: { tenantUrl: "https://contoso.sharepoint.com" }')
        )
      )
    ),
    initialPage: v.optional(
      v.pipe(
        v.string('dev.initialPage must be a string' + hint('set dev: { initialPage: "https://contoso.sharepoint.com" }')),
        v.minLength(1, 'dev.initialPage must be non-empty' + hint('set dev: { initialPage: "https://contoso.sharepoint.com" }'))
      )
    ),
    autoTrust: v.optional(
      v.union(
        [v.boolean('dev.autoTrust must be boolean'), v.literal('prompt')],
        'dev.autoTrust must be boolean or "prompt" (got invalid)' + hint('set dev: { autoTrust: "prompt" }')
      )
    )
  },
  'unknown key in dev' + hint('remove unknown dev key or check docs')
);

export type DevConfig = v.InferOutput<typeof DevConfigSchema>;

// ---------------------------------------------------------------------------
// BuildConfigSchema
// ---------------------------------------------------------------------------
/**
 * Build config schema — scaffold defaults for bundler.
 *
 * @example fix: build: { outDir: "dist" } in rspfx.config.ts
 */
export const BuildConfigSchema = v.strictObject(
  {
    /** @deprecated - set `devtool` in your rspack/vite/rsbuild config; this is scaffold-only default. */
    sourcemap: v.optional(
      v.boolean('build.sourcemap must be a boolean' + hint('set build: { sourcemap: false }'))
    ),
    /** @deprecated - set `optimization.minimize` / `build.minify` in your rspack/vite/rsbuild config; this is scaffold-only default. */
    minify: v.optional(v.boolean('build.minify must be a boolean' + hint('set build: { minify: true }'))),
    /**
     * @deprecated - must remain `false` for SPFx AMD correctness; chunks break the single-bundle contract. Set `optimization.splitChunks` in bundler config if you must override.
     * This is scaffold-only default.
     */
    splitChunks: v.optional(
      v.boolean('build.splitChunks must be a boolean' + hint('set build: { splitChunks: false }'))
    ),
    outDir: v.optional(
      v.pipe(
        v.string('build.outDir must be a string' + hint('set build: { outDir: "dist" }')),
        v.minLength(1, 'build.outDir must be non-empty' + hint('set build: { outDir: "dist" }'))
      )
    ),
    releaseDir: v.optional(
      v.pipe(
        v.string('build.releaseDir must be a string' + hint('set build: { releaseDir: "release" }')),
        v.minLength(1, 'build.releaseDir must be non-empty' + hint('set build: { releaseDir: "release" }'))
      )
    ),
    /** Path to tsconfig file, relative to projectRoot or absolute. */
    tsconfigPath: v.optional(
      v.pipe(
        v.string('build.tsconfigPath must be a string' + hint('set build: { tsconfigPath: "./tsconfig.json" }')),
        v.minLength(1, 'build.tsconfigPath must be non-empty' + hint('set build: { tsconfigPath: "./tsconfig.json" }'))
      )
    )
  },
  'unknown key in build' + hint('remove unknown build key')
);

export type BuildConfig = v.InferOutput<typeof BuildConfigSchema>;

// ---------------------------------------------------------------------------
// PathsConfigSchema
// ---------------------------------------------------------------------------
/**
 * Paths config schema.
 *
 * @example fix: paths: { srcDir: "src" } in rspfx.config.ts
 */
export const PathsConfigSchema = v.strictObject(
  {
    srcDir: v.optional(
      v.pipe(
        v.string('paths.srcDir must be a string' + hint('set paths: { srcDir: "src" }')),
        v.minLength(1, 'paths.srcDir must be non-empty' + hint('set paths: { srcDir: "src" }'))
      )
    ),
    webpartsDir: v.optional(
      v.pipe(
        v.string('paths.webpartsDir must be a string' + hint('set paths: { webpartsDir: "src/webparts" }')),
        v.minLength(1, 'paths.webpartsDir must be non-empty' + hint('set paths: { webpartsDir: "src/webparts" }'))
      )
    ),
    extensionsDir: v.optional(
      v.pipe(
        v.string('paths.extensionsDir must be a string' + hint('set paths: { extensionsDir: "src/extensions" }')),
        v.minLength(1, 'paths.extensionsDir must be non-empty' + hint('set paths: { extensionsDir: "src/extensions" }'))
      )
    ),
    librariesDir: v.optional(
      v.pipe(
        v.string('paths.librariesDir must be a string' + hint('set paths: { librariesDir: "src/libraries" }')),
        v.minLength(1, 'paths.librariesDir must be non-empty' + hint('set paths: { librariesDir: "src/libraries" }'))
      )
    ),
    configDir: v.optional(
      v.pipe(
        v.string('paths.configDir must be a string' + hint('set paths: { configDir: "config" }')),
        v.minLength(1, 'paths.configDir must be non-empty' + hint('set paths: { configDir: "config" }'))
      )
    )
  },
  'unknown key in paths' + hint('remove unknown paths key')
);

export type PathsConfig = v.InferOutput<typeof PathsConfigSchema>;

// ---------------------------------------------------------------------------
// DeployConfigSchema
// ---------------------------------------------------------------------------
/**
 * Deploy config schema.
 *
 * @example fix: deploy: { tenantUrl: "https://contoso.sharepoint.com" } in rspfx.config.ts
 */
export const DeployConfigSchema = v.strictObject(
  {
    tenantUrl: v.optional(
      v.pipe(
        v.string('deploy.tenantUrl must be a string URL' + hint('set deploy: { tenantUrl: "https://contoso.sharepoint.com" }')),
        v.url(
          'deploy.tenantUrl must be a valid URL' + hint('set deploy: { tenantUrl: "https://contoso.sharepoint.com" }')
        )
      )
    ),
    username: v.optional(
      v.pipe(
        v.string('deploy.username must be a string' + hint('set deploy: { username: "user@contoso.onmicrosoft.com" }')),
        v.minLength(1, 'deploy.username must be non-empty' + hint('set deploy: { username: "user@contoso.onmicrosoft.com" }'))
      )
    ),
    password: v.optional(
      v.pipe(v.string('deploy.password must be a string' + hint('set deploy: { password: "****" }')))
    ),
    appCatalogSiteUrl: v.optional(
      v.pipe(
        v.string(
          'deploy.appCatalogSiteUrl must be a string URL' +
            hint('set deploy: { appCatalogSiteUrl: "https://contoso.sharepoint.com/sites/appcatalog" }')
        ),
        v.url(
          'deploy.appCatalogSiteUrl must be a valid URL' +
            hint('set deploy: { appCatalogSiteUrl: "https://contoso.sharepoint.com/sites/appcatalog" }')
        )
      )
    )
  },
  'unknown key in deploy' + hint('remove unknown deploy key')
);

export type DeployConfig = v.InferOutput<typeof DeployConfigSchema>;

// ---------------------------------------------------------------------------
// TeamsConfigSchema
// ---------------------------------------------------------------------------
/**
 * Teams config object schema (enabled flag).
 *
 * @example fix: teams: { enabled: true } in rspfx.config.ts
 */
export const TeamsConfigObjectSchema = v.strictObject(
  {
    enabled: v.optional(v.boolean('teams.enabled must be a boolean' + hint('set teams: { enabled: true }')))
  },
  'unknown key in teams' + hint('remove unknown teams key — allowed: enabled')
);

/**
 * Teams field schema — accepts boolean shorthand or object.
 * Use boolean for quick enable/disable, object for future extensibility.
 *
 * @example fix: teams: true in rspfx.config.ts
 * @example fix: teams: { enabled: true } in rspfx.config.ts
 */
export const TeamsConfigSchema = v.union(
  [
    v.boolean('teams must be boolean or object' + hint('set teams: true')),
    TeamsConfigObjectSchema
  ],
  'teams must be boolean or { enabled: boolean }' + hint('set teams: true or teams: { enabled: true }')
);

// Inferred TeamsConfig for object form; field allows boolean | object
export type TeamsConfig = v.InferOutput<typeof TeamsConfigObjectSchema>;
export type TeamsField = v.InferOutput<typeof TeamsConfigSchema>;

// ---------------------------------------------------------------------------
// RspfxConfigSchema
// ---------------------------------------------------------------------------
/**
 * Main RSPFx config schema — strict, with actionable messages.
 *
 * - Rejects unknown top-level keys with: 'unknown key "X" — remove it or check rspfx.config.ts docs'
 * - Validates `name` non-empty, `framework` and `spfxVersion` as above
 * - Nested objects use strictObject to surface unknown nested keys
 *
 * All error messages include:
 *  - expected vs got (where available — valibot issue includes input)
 *  - file hint: rspfx.config.ts or rspfx.config.js
 *  - docs link as comment and in message suffix (see DOCS_LINK)
 *
 * Use `tryResolveConfig(raw)` to get `Result<RspfxConfig, Issue[]>` with mapped issues.
 * Use `defineConfig({...})` for type-safe authoring with autocomplete.
 *
 * @example
 * ```ts
 * // rspfx.config.ts
 * import { defineConfig } from '@mbsks/rspfx-core';
 * export default defineConfig({
 *   name: 'my-app',
 *   framework: 'react',
 *   spfxVersion: '1.23',
 *   dev: { port: 4321 },
 *   build: { outDir: 'dist' }
 * });
 * ```
 * Error example: unknown key "unknownKey" — remove it or check rspfx.config.ts docs (see https://github.com/master8848/rspfx#configuration)
 */
export const RspfxConfigSchema = v.strictObject(
  {
    name: v.pipe(
      v.string('name must be a string' + hint('set name: "my-app"')),
      v.check((val) => val.trim().length > 0, 'name must be non-empty' + hint('set name: "my-app"'))
    ),
    /** Build-time package version used in AMD library names and manifests; overrides package.json "version". */
    version: v.optional(
      v.pipe(
        v.string('version must be a string like "1.0.0"' + hint('set version: "1.0.0"')),
        v.regex(/^\d+\.\d+\.\d+/, 'version must be semver like "1.0.0" (got invalid)' + hint('set version: "1.0.0"'))
      )
    ),
    framework: v.optional(FrameworkIdSchema),
    spfxVersion: v.optional(SpfxVersionSchema),
    dev: v.optional(DevConfigSchema),
    build: v.optional(BuildConfigSchema),
    paths: v.optional(PathsConfigSchema),
    deploy: v.optional(DeployConfigSchema),
    /** Teams integration; when enabled, teams/manifest.json and icons are auto-created. Disabled by default. */
    teams: v.optional(TeamsConfigSchema),
    /** Try mode: run dev server without migrating config.json manifests. */
    devTryMode: v.optional(v.boolean('devTryMode must be a boolean' + hint('set devTryMode: true'))),
    /** Components to synthesize in try mode. */
    tryComponents: v.optional(v.array(TryComponentSchema, 'tryComponents must be an array' + hint('set tryComponents: [{ name: "Hello" }]'))),
    /** Path to tsconfig file, relative to projectRoot or absolute. Alias for build.tsconfigPath; build takes precedence. */
    tsconfigPath: v.optional(
      v.pipe(
        v.string('tsconfigPath must be a string' + hint('set tsconfigPath: "./tsconfig.json"')),
        v.minLength(1, 'tsconfigPath must be non-empty' + hint('set tsconfigPath: "./tsconfig.json"'))
      )
    )
  },
  'unknown key' + hint('remove unknown key or check docs')
);

// Inferred RspfxConfig — keep resolved shape compatible with manual interface
export type RspfxConfig = v.InferOutput<typeof RspfxConfigSchema> & {
  // Ensure required fields after resolveConfig defaults are applied
  framework: FrameworkId;
  spfxVersion: SpfxTarget;
  dev: DevConfig;
  build: BuildConfig;
};

export function defineConfig<const T extends RspfxConfig>(config: T): T {
  return config;
}

export type Issue = { path: (string | number)[]; message: string; code: string };
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function parseRSPFXConfig(raw: unknown): Result<RspfxConfig, Issue[]> {
  return tryResolveConfig(raw);
}

/**
 * Map valibot issues to our Issue[] with actionable messages.
 * - Converts strict_object unknown-key issues to 'unknown key "X" — remove it or check rspfx.config.ts docs'
 * - Ensures every message contains file hint and docs link
 * - Includes got value where available via issue.input
 */
function mapValibotIssues(
  issues: readonly v.BaseIssue<unknown>[],
  raw: unknown
): Issue[] {
  const allowedSpfx = getSpfxVersions()
    .map((ver) => ver.target)
    .join(', ');
  const result: Issue[] = [];

  // Helper to get dotPath from issue
  const getDotPath = (issue: v.BaseIssue<unknown>): (string | number)[] => {
    const p = (issue as unknown as { path?: { key: string | number }[] }).path;
    if (!p) return [];
    return p.map((seg) => (seg as { key: string | number }).key);
  };

  // Helper to push a single issue with friendly handling
  const handleSingle = (issue: v.BaseIssue<unknown>, overridePath?: (string | number)[]) => {
    const dotPath: (string | number)[] = overridePath ?? getDotPath(issue);
    let message = (issue as { message?: string }).message ?? 'Invalid value';
    const issueType = (issue as { type?: string }).type ?? '';
    const expected = (issue as { expected?: string }).expected;
    const received = (issue as { received?: string }).received;
    const inputVal = (issue as { input?: unknown }).input;

    // Missing required field (handles both object and strict_object where received undefined)
    if (received === 'undefined' && expected?.includes('"')) {
      const field = dotPath.join('.');
      const fieldName = String(dotPath[dotPath.length - 1] ?? field);
      let hintExample = `set ${field}: "value"`;
      if (field === 'name' || fieldName === 'name') hintExample = 'set name: "my-app"';
      else if (field === 'framework') hintExample = 'set framework: "react"';
      else if (field === 'spfxVersion') hintExample = 'set spfxVersion: "1.23"';
      else if (fieldName) hintExample = `set ${fieldName}: "value"`;
      // Try to use more specific message if we already have good pipe message? but missing is generic
      message = `${field} is required (got undefined)` + hint(hintExample);
      result.push({ path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' });
      return;
    }

    const isStrict = issueType === 'strict_object' || issueType === 'strictObject';

    if (isStrict) {
      const lastKey = dotPath[dotPath.length - 1];
      const keyMatch = message.match(/["']([^"']+)["']/) ?? message.match(/key\s+["']?(\w+)["']?/i);
      const unknownKey =
        typeof lastKey === 'string' && lastKey.length > 0
          ? String(lastKey)
          : keyMatch
            ? keyMatch[1]!
            : 'unknown';
      const parentPath = dotPath.length > 1 ? dotPath.slice(0, -1).join('.') : '';
      if (parentPath) {
        if (parentPath === 'teams') {
          message = `unknown teams key "${unknownKey}" — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        } else if (parentPath.startsWith('dev')) {
          message = `unknown key "${unknownKey}" in dev — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        } else if (parentPath.startsWith('build')) {
          message = `unknown key "${unknownKey}" in build — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        } else if (parentPath.startsWith('paths')) {
          message = `unknown key "${unknownKey}" in paths — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        } else if (parentPath.startsWith('deploy')) {
          message = `unknown key "${unknownKey}" in deploy — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        } else {
          message = `unknown key "${unknownKey}" — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        }
      } else {
        const key: string = typeof lastKey === 'string' ? String(lastKey) : (unknownKey as string);
        const displayKey: string = key && key !== 'unknown' ? key : (unknownKey as string);
        message = `unknown key "${displayKey}" — remove it or check rspfx.config.ts docs (see ${DOCS_LINK})`;
        if (dotPath.length === 0 && displayKey !== 'unknown') {
          (dotPath as (string | number)[]).push(displayKey as string);
        }
      }
      result.push({ path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' });
      return;
    }

    // Missing required field: object with Invalid key Expected "..." received undefined
    if (
      issueType === 'object' &&
      message.toLowerCase().includes('invalid key') &&
      expected?.includes('"') &&
      received === 'undefined'
    ) {
      const field = dotPath.join('.');
      const fieldName = String(dotPath[dotPath.length - 1] ?? field);
      // Specialize hint per field
      let hintExample = `set ${field}: "value"`;
      if (field === 'name' || field.endsWith('.name')) hintExample = 'set name: "my-app"';
      else if (field === 'framework') hintExample = 'set framework: "react"';
      else if (field === 'spfxVersion') hintExample = 'set spfxVersion: "1.23"';
      else if (fieldName) hintExample = `set ${fieldName}: "value"`;
      message = `${field} is required (got undefined)` + hint(hintExample);
      result.push({ path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' });
      return;
    }

    // Generic handling: ensure message contains file hint, docs, got
    const hasGot = message.toLowerCase().includes('(got');
    if (!hasGot && inputVal !== undefined) {
      let gotStr: string;
      try {
        const json = JSON.stringify(inputVal);
        gotStr = json.length > 80 ? json.slice(0, 77) + '...' : json;
      } catch {
        gotStr = String(inputVal);
      }
      if (gotStr !== undefined && gotStr !== 'undefined') {
        if (message.includes(' — fix:')) {
          message = message.replace(' — fix:', ` (got ${gotStr}) — fix:`);
        } else if (message.includes(DOCS_LINK)) {
          message = `${message} (got ${gotStr})`;
        } else {
          message = `${message} (got ${gotStr})` + hint('check ' + CONFIG_FILE_HINT);
        }
      }
    }
    if (!message.includes(CONFIG_FILE_HINT) && !message.includes('rspfx.config')) {
      message = `${message}` + hint('check');
    }
    if (!message.includes(DOCS_LINK) && !message.includes('see https')) {
      message = `${message} (see ${DOCS_LINK})`;
    }
    if (dotPath.join('.') === 'spfxVersion' || message.includes('spfxVersion')) {
      if (!message.includes(allowedSpfx) && allowedSpfx.length > 0) {
        if (message.includes('one of')) {
          message = message.replace(/one of [^—]+/, `one of ${allowedSpfx}`);
        } else {
          message = `${message} (allowed: ${allowedSpfx})`;
        }
      }
    }
    if (dotPath.join('.') === 'dev.port' && inputVal !== undefined) {
      if (!message.includes('1024-65535')) {
        message = `dev.port must be 1024-65535 (got ${JSON.stringify(inputVal)})` + hint('set dev: { port: 4321 }');
      } else if (!message.includes('(got')) {
        message = message.replace(' — fix:', ` (got ${JSON.stringify(inputVal)}) — fix:`);
      }
    }
    result.push({ path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' });
  };

  for (const issue of issues) {
    const issueType = (issue as { type?: string }).type ?? '';
    const nested = (issue as unknown as { issues?: readonly v.BaseIssue<unknown>[] }).issues;
    // Union with nested strict_object: surface inner strict errors with combined path
    if (issueType === 'union' && Array.isArray(nested) && nested.length > 0) {
      const basePath = getDotPath(issue);
      const strictInners = nested.filter((n) => (n as { type?: string }).type === 'strict_object');
      if (strictInners.length > 0) {
        for (const inner of strictInners) {
          const innerPath = getDotPath(inner);
          const combined = [...basePath, ...innerPath];
          handleSingle(inner as v.BaseIssue<unknown>, combined);
        }
        continue;
      }
      // If union has no strict inner but is for teams etc, still handle generic union as single
      // Fall through to handleSingle for the union itself
    }
    handleSingle(issue);
  }

  if (result.length === 0 && (typeof raw !== 'object' || raw === null)) {
    result.push({
      path: [],
      message: `config must be an object (got ${typeof raw})` + hint('export default defineConfig({ name: "my-app" })'),
      code: 'CONFIG_VALIDATION_FAILED'
    });
  }

  return result;
}

export function tryResolveConfig(raw: unknown): Result<RspfxConfig, Issue[]> {
  // Use valibot safeParse for full schema validation
  const parsed = v.safeParse(RspfxConfigSchema, raw);
  if (!parsed.success) {
    const issues = mapValibotIssues(parsed.issues as unknown as v.BaseIssue<unknown>[], raw);
    return { ok: false, error: issues };
  }

  // parsed.output contains validated (but still partial) config with correct types
  // Use resolveConfig to fill defaults and normalize teams/paths
  try {
    // Cast parsed.output as RspfxConfig | Partial<RspfxConfig> for resolveConfig
    // resolveConfig will fill framework/spfxVersion/dev/build defaults
    const resolved = resolveConfig(parsed.output as unknown as RspfxConfig);
    return { ok: true, value: resolved };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: [{ path: [], message: msg + hint('check'), code: 'CONFIG_VALIDATION_FAILED' }] };
  }
}

export const configDefaults: Required<Pick<RspfxConfig, 'dev' | 'build'>> & { paths: Required<PathsConfig> } = {
  dev: {
    port: DEFAULT_DEV_PORT,
    https: true,
    hostname: 'localhost',
    workbench: true,
    fastRefresh: false,
    openBrowser: false,
    autoTrust: 'prompt' as unknown as boolean | 'prompt'
  },
  build: {
    sourcemap: false,
    minify: true,
    splitChunks: false,
    outDir: 'dist',
    releaseDir: 'release',
    tsconfigPath: undefined as unknown as string
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
  // Optionally validate via schema for early error (kept permissive to avoid throwing)
  if (paths !== undefined) {
    const check = v.safeParse(PathsConfigSchema, paths);
    if (!check.success) {
      // Fall through to defaults for invalid keys, but keep original behavior: don't throw, use defaults
      // This validation is for diagnostics; real validation happens in tryResolveConfig
    }
  }
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
    const err = new Error('"name" is required in the bundler config (rspack.config.ts)');
    (err as unknown as Record<string, unknown>).code = 'CONFIG_VALIDATION_FAILED';
    throw err;
  }
  let teams: TeamsConfig | undefined;
  if (config.teams !== undefined) {
    if (typeof config.teams === 'boolean') {
      teams = { enabled: config.teams };
    } else if (typeof config.teams === 'object' && config.teams !== null) {
      teams = { enabled: !!(config.teams as TeamsConfig).enabled };
    }
  }
  const buildTsconfigPath = (config.build as unknown as Record<string, unknown>)?.tsconfigPath as string | undefined ?? (config as unknown as Record<string, unknown>).tsconfigPath as string | undefined;
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
      autoTrust: (config.dev?.autoTrust as boolean | 'prompt' | undefined) ?? (process.env.CI || process.env.GITHUB_ACTIONS || process.env.TF_BUILD ? (false as unknown as boolean | 'prompt') : ('prompt' as unknown as boolean | 'prompt')),
      ...(config.dev?.tenantUrl !== undefined ? { tenantUrl: config.dev.tenantUrl } : {}),
      ...(config.dev?.initialPage !== undefined ? { initialPage: config.dev.initialPage } : {})
    },
    build: {
      sourcemap: config.build?.sourcemap ?? configDefaults.build.sourcemap,
      minify: config.build?.minify ?? configDefaults.build.minify,
      splitChunks: config.build?.splitChunks ?? configDefaults.build.splitChunks,
      outDir: config.build?.outDir ?? configDefaults.build.outDir,
      releaseDir: config.build?.releaseDir ?? configDefaults.build.releaseDir,
      tsconfigPath: buildTsconfigPath
    },
    paths: resolvePathDefaults(config.paths),
    ...(config.deploy !== undefined ? { deploy: config.deploy } : {}),
    ...(teams !== undefined ? { teams } : {}),
    ...(config.devTryMode !== undefined ? { devTryMode: config.devTryMode } : {}),
    ...(config.tryComponents !== undefined ? { tryComponents: config.tryComponents } : {}),
    ...(buildTsconfigPath ? { tsconfigPath: buildTsconfigPath } : {})
  };
}
