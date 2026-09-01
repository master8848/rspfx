import * as v from 'valibot';

const CLI_DOCS = 'https://github.com/master8848/rspfx#configuration';

export const DevCliOptionsSchema = v.object({
  port: v.optional(
    v.pipe(
      v.number('dev --port must be a number — fix: pass --port 4321 (see ' + CLI_DOCS + ')'),
      v.integer('dev --port must be an integer — fix: pass --port 4321 (see ' + CLI_DOCS + ')'),
      v.minValue(1024, 'dev --port must be 1024-65535 — fix: pass --port 4321 (see ' + CLI_DOCS + ')'),
      v.maxValue(65535, 'dev --port must be 1024-65535 — fix: pass --port 4321 (see ' + CLI_DOCS + ')')
    )
  ),
  tenant: v.optional(
    v.pipe(
      v.string('dev --tenant must be a string URL — fix: pass --tenant https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.url('dev --tenant must be https://... — fix: pass --tenant https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.check((val) => val.startsWith('https://'), 'dev --tenant must be https://... — fix: pass --tenant https://contoso.sharepoint.com (see ' + CLI_DOCS + ')')
    )
  ),
  tenantUrl: v.optional(
    v.pipe(
      v.string('deploy --tenantUrl must be a string URL — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.url('deploy --tenantUrl must be https://... — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.check((val) => val.startsWith('https://'), 'deploy --tenantUrl must be https://... — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')')
    )
  ),
  mode: v.optional(v.picklist(['local', 'sharepoint'], 'dev --mode must be local or sharepoint — fix: pass --mode local (see ' + CLI_DOCS + ')')),
  browser: v.optional(v.boolean('dev --browser must be a boolean — fix: pass --browser (see ' + CLI_DOCS + ')')),
  refresh: v.optional(v.boolean('dev --refresh must be a boolean — fix: pass --refresh (see ' + CLI_DOCS + ')'))
});

export const BuildCliOptionsSchema = v.object({
  minify: v.optional(v.boolean('build --minify must be a boolean — fix: pass --minify or --no-minify (see ' + CLI_DOCS + ')')),
  sourcemap: v.optional(v.boolean('build --sourcemap must be a boolean — fix: pass --sourcemap (see ' + CLI_DOCS + ')')),
  port: v.optional(
    v.pipe(
      v.number('build port must be 1024-65535 — fix: set build port 4321 (see ' + CLI_DOCS + ')'),
      v.integer('build port must be an integer — fix: set build port 4321 (see ' + CLI_DOCS + ')'),
      v.minValue(1024, 'build port must be 1024-65535 — fix: set build port 4321 (see ' + CLI_DOCS + ')'),
      v.maxValue(65535, 'build port must be 1024-65535 — fix: set build port 4321 (see ' + CLI_DOCS + ')')
    )
  )
});

export const DeployCliOptionsSchema = v.object({
  tenantUrl: v.optional(
    v.pipe(
      v.string('deploy --tenantUrl must be https://... — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.url('deploy --tenantUrl must be https://... — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.check((val) => val.startsWith('https://'), 'deploy --tenantUrl must be https://... — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')'),
      v.check((val) => val.toLowerCase().includes('sharepoint'), 'deploy --tenantUrl must be a SharePoint URL — fix: pass --tenantUrl https://contoso.sharepoint.com (see ' + CLI_DOCS + ')')
    )
  ),
  sppkgPath: v.optional(
    v.pipe(
      v.string('deploy --sppkg must be a string path — fix: pass --sppkg sharepoint/solution/my-solution.sppkg (see ' + CLI_DOCS + ')'),
      v.minLength(1, 'deploy --sppkg must be non-empty — fix: pass --sppkg sharepoint/solution/my-solution.sppkg (see ' + CLI_DOCS + ')')
    )
  ),
  build: v.optional(v.boolean('deploy --build must be a boolean — fix: pass --build or --no-build (see ' + CLI_DOCS + ')'))
});

export type CliIssue = { path: (string | number)[]; message: string; code: string };
export type CliResult<T> = { ok: true; value: T } | { ok: false; error: CliIssue[] };

function mapCliIssues(issues: readonly v.BaseIssue<unknown>[]): CliIssue[] {
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
    if (!message.includes('fix:')) message += ' — fix: check CLI options (see ' + CLI_DOCS + ')';
    return { path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' };
  });
}

export function validateDevOptions(raw: unknown): CliResult<v.InferOutput<typeof DevCliOptionsSchema>> {
  const result = v.safeParse(DevCliOptionsSchema, raw);
  if (!result.success) return { ok: false, error: mapCliIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export function validateBuildOptions(raw: unknown): CliResult<v.InferOutput<typeof BuildCliOptionsSchema>> {
  const result = v.safeParse(BuildCliOptionsSchema, raw);
  if (!result.success) return { ok: false, error: mapCliIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export function validateDeployOptions(raw: unknown): CliResult<v.InferOutput<typeof DeployCliOptionsSchema>> {
  // Allow deploy to also validate tenantUrl from deploy options
  // Also support string tenantUrl vs tenant param
  const result = v.safeParse(DeployCliOptionsSchema, raw);
  if (!result.success) return { ok: false, error: mapCliIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export function tryValidateDevOptions(raw: unknown): CliResult<v.InferOutput<typeof DevCliOptionsSchema>> {
  return validateDevOptions(raw);
}
export function tryValidateBuildOptions(raw: unknown): CliResult<v.InferOutput<typeof BuildCliOptionsSchema>> {
  return validateBuildOptions(raw);
}
export function tryValidateDeployOptions(raw: unknown): CliResult<v.InferOutput<typeof DeployCliOptionsSchema>> {
  return validateDeployOptions(raw);
}
