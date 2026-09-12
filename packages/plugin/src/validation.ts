import * as v from 'valibot';

const PLUGIN_DOCS = 'https://github.com/master8848/rspfx#configuration';

export const RspfxPluginOptionsSchema = v.object({
  name: v.pipe(
    v.string('plugin option "name" must be a string — fix: set plugins: [rspfxVite({ name: "my-app" })] in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'),
    v.minLength(1, 'plugin option "name" must be non-empty — fix: set plugins: [rspfxVite({ name: "my-app" })] in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'),
    v.check((val) => val.trim().length > 0, 'plugin option "name" must be non-empty — fix: set plugins: [rspfxVite({ name: "my-app" })] in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')
  ),
  projectRoot: v.optional(
    v.pipe(
      v.string('plugin option "projectRoot" must be a string — fix: set projectRoot: "/path/to/project" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'),
      v.minLength(1, 'plugin option "projectRoot" must be non-empty — fix: set projectRoot: "/path/to/project" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')
    )
  ),
  framework: v.optional(
    v.pipe(
      v.string('plugin option "framework" must be a string — fix: set framework: "react" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'),
      v.minLength(1, 'plugin option "framework" must be non-empty — fix: set framework: "react" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')
    )
  ),
  version: v.optional(v.pipe(v.string('plugin option "version" must be a string — fix: set version: "1.0.0" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.regex(/^\d+\.\d+\.\d+/, 'plugin option "version" must be semver like "1.0.0" (got invalid) — fix: set version: "1.0.0" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
  spfxVersion: v.optional(v.string('plugin option "spfxVersion" must be a string — fix: set spfxVersion: "1.23" in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')),
  dev: v.optional(v.object({
    port: v.optional(v.pipe(v.number('plugin option "dev.port" must be a number — fix: set dev: { port: 4321 } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.integer('plugin option "dev.port" must be an integer — fix: set dev: { port: 4321 } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minValue(1024, 'plugin option "dev.port" must be 1024-65535 — fix: set dev: { port: 4321 } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.maxValue(65535, 'plugin option "dev.port" must be 1024-65535 — fix: set dev: { port: 4321 } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    https: v.optional(v.boolean('plugin option "dev.https" must be a boolean — fix: set dev: { https: true } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')),
    hostname: v.optional(v.pipe(v.string('plugin option "dev.hostname" must be a string — fix: set dev: { hostname: "localhost" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "dev.hostname" must be non-empty — fix: set dev: { hostname: "localhost" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    tenantUrl: v.optional(v.pipe(v.string('plugin option "dev.tenantUrl" must be a URL — fix: set dev: { tenantUrl: "https://contoso.sharepoint.com" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.url('plugin option "dev.tenantUrl" must be a valid URL — fix: set dev: { tenantUrl: "https://contoso.sharepoint.com" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    initialPage: v.optional(v.pipe(v.string('plugin option "dev.initialPage" must be a string — fix: set dev: { initialPage: "https://..." } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "dev.initialPage" must be non-empty — fix: set dev: { initialPage: "https://..." } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    workbench: v.optional(v.boolean('plugin option "dev.workbench" must be a boolean — fix: set dev: { workbench: true } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')),
    fastRefresh: v.optional(v.boolean('plugin option "dev.fastRefresh" must be a boolean — fix: set dev: { fastRefresh: false } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')),
    openBrowser: v.optional(v.boolean('plugin option "dev.openBrowser" must be a boolean — fix: set dev: { openBrowser: false } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))
  })),
  build: v.optional(v.object({
    outDir: v.optional(v.pipe(v.string('plugin option "build.outDir" must be a string — fix: set build: { outDir: "dist" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "build.outDir" must be non-empty — fix: set build: { outDir: "dist" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    sourcemap: v.optional(v.boolean('plugin option "build.sourcemap" must be a boolean — fix: set build: { sourcemap: false } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')),
    minify: v.optional(v.boolean('plugin option "build.minify" must be a boolean — fix: set build: { minify: true } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))
  })),
  paths: v.optional(v.object({
    srcDir: v.optional(v.pipe(v.string('plugin option "paths.srcDir" must be a string — fix: set paths: { srcDir: "src" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "paths.srcDir" must be non-empty — fix: set paths: { srcDir: "src" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    webpartsDir: v.optional(v.pipe(v.string('plugin option "paths.webpartsDir" must be a string — fix: set paths: { webpartsDir: "src/webparts" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "paths.webpartsDir" must be non-empty — fix: set paths: { webpartsDir: "src/webparts" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    extensionsDir: v.optional(v.pipe(v.string('plugin option "paths.extensionsDir" must be a string — fix: set paths: { extensionsDir: "src/extensions" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "paths.extensionsDir" must be non-empty — fix: set paths: { extensionsDir: "src/extensions" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    librariesDir: v.optional(v.pipe(v.string('plugin option "paths.librariesDir" must be a string — fix: set paths: { librariesDir: "src/libraries" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "paths.librariesDir" must be non-empty — fix: set paths: { librariesDir: "src/libraries" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'))),
    configDir: v.optional(v.pipe(v.string('plugin option "paths.configDir" must be a string — fix: set paths: { configDir: "config" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.minLength(1, 'plugin option "paths.configDir" must be non-empty — fix: set paths: { configDir: "config" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')))
  })),
  deploy: v.optional(v.object({
    tenantUrl: v.optional(v.pipe(v.string('plugin option "deploy.tenantUrl" must be a URL — fix: set deploy: { tenantUrl: "https://contoso.sharepoint.com" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')'), v.url('plugin option "deploy.tenantUrl" must be a valid URL — fix: set deploy: { tenantUrl: "https://contoso.sharepoint.com" } in rspfx.config.ts (see ' + PLUGIN_DOCS + ')')))
  }))
});

export type PluginIssue = { path: (string | number)[]; message: string; code: string };
export type PluginResult<T> = { ok: true; value: T } | { ok: false; error: PluginIssue[] };

function mapPluginIssues(issues: readonly v.BaseIssue<unknown>[]): PluginIssue[] {
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
    if (!message.includes('fix:')) message += ' — fix: set plugins: [...] in rspfx.config.ts (see ' + PLUGIN_DOCS + ')';
    return { path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' };
  });
}

export function validatePluginOptions(raw: unknown): PluginResult<v.InferOutput<typeof RspfxPluginOptionsSchema>> {
  const result = v.safeParse(RspfxPluginOptionsSchema, raw);
  if (!result.success) return { ok: false, error: mapPluginIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export function tryValidatePluginOptions(raw: unknown): PluginResult<v.InferOutput<typeof RspfxPluginOptionsSchema>> {
  return validatePluginOptions(raw);
}
