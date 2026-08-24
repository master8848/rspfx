import type { Compiler, Configuration } from '@rspack/core';
import {
  resolveConfig,
  RSPFX_PLUGIN_MARKER,
  RSPFX_PLUGIN_OPTIONS,
  type RspfxBundlerPluginLike,
  type RspfxConfig
} from '@mbsks/rspfx-core';
import {
  createRspackConfig,
  type LocalizedResource
} from '@mbsks/rspfx-compiler-rspack';
import { findSpDependencies } from '@mbsks/rspfx-manifest-generator';
import {
  readProject,
  loadFrameworkPreset,
  resolveContributionLoaders,
  createCompileContext,
  assembleRelease,
  type ReadProjectResult
} from '@mbsks/rspfx-dev-runtime';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import { createHookBus, getPlugins } from '@mbsks/rspfx-plugin-api';
import type { RspfxPluginOptions } from './types.js';

const logger = createLogger('rspfx');

/**
 * The Rspack/Webpack-compatible rspfx plugin. Use it in `rspack.config.ts`:
 *
 * ```ts
 * import { RspfxPlugin } from '@mbsks/rspfx-plugin';
 * export default {
 *   mode: 'development',
 *   plugins: [new RspfxPlugin({ name: 'my-app', framework: 'react', dev: {...}, build: {...} })]
 * };
 * ```
 *
 * Running the compiler directly — `rspack build` / `rspack dev` — is fully
 * supported: `apply` composes the complete SPFx configuration (entries,
 * externals, AMD output, framework loader contributions, swc/SCSS rules,
 * public-path capture and localized-resource emission), and assembles the
 * release output (component manifests + `release/` assets) after a production
 * compile, exactly like `rspfx build`.
 *
 * Entries/externals are applied synchronously in `apply` (rspack registers
 * entries from the options at compiler-creation time); the async parts —
 * framework presets, loader resolution, rules and output — are overlaid on
 * `compiler.options` at `beforeRun`/`watchRun`, which rspack re-reads when
 * the compiler instance is created.
 *
 * (Turbopack does not support webpack plugins and cannot run this interface.)
 */
export class RspfxPlugin implements RspfxBundlerPluginLike {
  [key: symbol]: unknown;
  private readonly _options: RspfxConfig;
  private readonly projectRoot: string;
  private project: ReadProjectResult | undefined;
  private outputFiles: string[] = [];
  private configured = false;
  readonly [RSPFX_PLUGIN_MARKER]: true = true;

  get [RSPFX_PLUGIN_OPTIONS](): RspfxConfig {
    return this._options;
  }

  /** Convenience accessor; the CLI reads `plugin[RSPFX_PLUGIN_OPTIONS]`. */
  get options(): RspfxConfig {
    return this._options;
  }

  constructor(options: RspfxPluginOptions) {
    const { projectRoot, ...rest } = options;
    this.projectRoot = projectRoot ?? process.cwd();
    this._options = resolveConfig(rest);
  }

  apply(compiler: Compiler): void {
    let project: ReadProjectResult;
    try {
      project = readProject(this.projectRoot, this._options.paths, this._options.version, this._options);
    } catch (error) {
      logger.warn(
        'RspfxPlugin: no web part bundles discovered — SPFx configuration skipped. ' +
          `Run "rspfx build"/"rspfx dev" for the full pipeline (${error instanceof Error ? error.message : String(error)})`
      );
      return;
    }
    this.project = project;
    this.outputFiles = project.webParts.entries.map((entry) => `${entry.name}.js`);

    const options = compiler.options as unknown as Configuration;
    if (options.externalsType === undefined) {
      options.externalsType = 'amd';
    }
    options.entry = Object.fromEntries(
      project.webParts.entries.map((entry) => [
        entry.name,
        {
          import: [entry.import],
          library: { type: 'amd', name: `${entry.componentIds[0]!}_${entry.version}` }
        }
      ])
    );
    options.externals = this.collectExternals(project);

    compiler.hooks.beforeRun.tapPromise('rspfx-pipeline', () => this.configureCompiler(compiler, options));
    compiler.hooks.watchRun.tapPromise('rspfx-pipeline', () => this.configureCompiler(compiler, options));
    compiler.hooks.done.tapPromise('rspfx-release', async (stats) => {
      {
        const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'afterStats' }) });
        try {
          await bus.emitAfterStats(stats as unknown as import('@mbsks/rspfx-plugin-api').Stats);
        } catch {}
        logger.child({ phase: 'afterStats' }).trace('afterStats emitted');
      }
      if (!this.configured || !this.project) {
        return;
      }
      if (stats.hasErrors()) {
        return;
      }
      const production = compiler.options.mode === 'production';
      if (!production) {
        return;
      }
      await assembleRelease({
        projectRoot: this.projectRoot,
        config: this._options,
        project: this.project,
        externals: this.collectExternals(this.project),
        outputFiles: this.outputFiles,
        production
      });
    });
  }

  private async configureCompiler(compiler: Compiler, options: Configuration): Promise<void> {
    if (this.configured) {
      return;
    }
    this.configured = true;
    try {
      const frameworkPreset = await loadFrameworkPreset(this._options.framework, this.projectRoot);
      const contributions = resolveContributionLoaders(
        ((frameworkPreset.preset.rspack
          ? frameworkPreset.preset.rspack({ fastRefresh: false })
          : frameworkPreset.preset.contributions?.({ fastRefresh: false })) ?? {}) as Record<string, unknown>,
        frameworkPreset.moduleUrl
      );

      const production = compiler.options.mode === 'production';
      let ctx = createCompileContext({
        projectRoot: this.projectRoot,
        config: this._options,
        entries: this.project!.webParts.entries,
        externals: [...findSpDependencies(this.projectRoot).keys(), ...this.project!.externals],
        localizedAliases: this.project!.localizedAliases,
        localizedResources: this.project!.localizedResources,
        fastRefresh: false,
        production,
        serveMode: false,
        build: { ...this._options.build }
      });
      // HookBus: beforeCompile may mutate the compile context
      {
        const bus = createHookBus(getPlugins(), { logger: logger.child({ phase: 'beforeCompile' }) });
        const result = await bus.emitBeforeCompile(ctx as unknown as import('@mbsks/rspfx-plugin-api').CompileContext);
        if (!result.ok) throw result.error;
        ctx = result.value as unknown as typeof ctx;
      }
      ctx.swcContributions = [contributions as Record<string, unknown>];

      const full = (await createRspackConfig(ctx)) as Configuration;
      const libraryType =
        full.output?.library && typeof full.output.library === 'object' && 'type' in full.output.library
          ? String(full.output.library.type)
          : undefined;
      options.mode = full.mode;
      options.output = {
        ...options.output,
        ...full.output,
        ...(libraryType ? { externalsType: libraryType } : {})
      };
      options.module = { ...options.module, rules: [...(options.module?.rules ?? []), ...(full.module?.rules ?? [])] };
      options.optimization = { ...options.optimization, ...full.optimization };
      options.devtool = full.devtool;
      for (const plugin of full.plugins ?? []) {
        const candidate = plugin as { apply?(c: Compiler): void };
        if (typeof candidate?.apply === 'function') {
          candidate.apply(compiler);
        }
      }
    } catch (error) {
      logger.warn(
        `RspfxPlugin: failed to apply SPFx compiler configuration — continuing with defaults (${error instanceof Error ? error.message : String(error)})`
      );
    }
  }

  private collectExternals(project: ReadProjectResult): string[] {
    return [
      ...new Set([
        ...findSpDependencies(this.projectRoot).keys(),
        ...project.externals,
        ...project.localizedResources.map((resource: LocalizedResource) => resource.name)
      ])
    ];
  }
}
