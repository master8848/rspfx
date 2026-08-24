import fs from "node:fs";
import path from "node:path";
import { build } from "@mbsks/rspfx-compiler-rspack";
import type { RspfxConfig } from "@mbsks/rspfx-core";
import {
  type ReadProjectResult,
  assembleRelease,
  createCompileContext,
  loadFrameworkPreset,
  readProject,
  resolveContributionLoaders,
} from "@mbsks/rspfx-dev-runtime";
import { createLogger, RspfxError } from "@mbsks/rspfx-diagnostics";
import { findSpDependencies } from "@mbsks/rspfx-manifest-generator";
import type { ComponentManifest } from "@mbsks/rspfx-manifest-generator";
import { loadConfig } from "../config.js";
import { loadConfigOrRefuseOfficial } from "../hybrid.js";
import { runRsbuildBuild } from "../rsbuild.js";
import { runRspackBuild } from "../rspack.js";
import { runViteBuild } from "../vite.js";

const logger = createLogger("rspfx");

export interface BuildOptions {
  minify?: boolean;
  sourcemap?: boolean;
}

export interface BuildOutput {
  stats: unknown;
  outputFiles: string[];
  manifests: ComponentManifest[];
  distDir: string;
  releaseDir: string;
  releaseManifestsDir: string;
  releaseAssetsDir: string;
}

export async function runBuild(
  cwd: string,
  opts: BuildOptions = {},
): Promise<BuildOutput> {
  let loaded = await loadConfigWithSynthesis(cwd);
  const synthesizedCleanup = loaded.synthesizedPath;
  try {
    const config = loaded.config;
    const bundler = loaded.bundler;

    let stats: unknown;
    let outputFiles: string[];

    if (bundler === "vite" || bundler === "rsbuild" || bundler === "rspack") {
      const handled = await runDelegatedBuild(cwd, config, bundler, opts, loaded);
      stats = handled.stats;
      outputFiles = handled.outputFiles;
    } else {
      // Should not happen - fallback to direct
      const result = await runDirectBuild(cwd, config, opts, loaded);
      stats = result.stats;
      outputFiles = result.outputFiles;
    }

    const distDir = path.join(cwd, config.build.outDir ?? "dist");
    const releaseDir = path.join(cwd, config.build.releaseDir ?? "release");
    const releaseManifestsDir = path.join(releaseDir, "manifests");
    const releaseAssetsDir = path.join(releaseDir, "assets");

    const manifests: ComponentManifest[] = [];
    if (fs.existsSync(releaseManifestsDir)) {
      for (const file of fs.readdirSync(releaseManifestsDir)) {
        if (!file.endsWith(".manifest.json")) {
          continue;
        }
        manifests.push(
          JSON.parse(
            fs.readFileSync(path.join(releaseManifestsDir, file), "utf8"),
          ) as ComponentManifest,
        );
      }
    }

    logger.info(
      `Release output: ${releaseDir}/manifests (${manifests.length} components), ${releaseDir}/assets`,
    );
    return {
      stats,
      outputFiles,
      manifests,
      distDir,
      releaseDir,
      releaseManifestsDir,
      releaseAssetsDir,
    };
  } finally {
    if (synthesizedCleanup) {
      try {
        fs.rmSync(synthesizedCleanup, { force: true });
      } catch {}
    }
  }
}

async function loadConfigWithSynthesis(cwd: string): Promise<{
  config: RspfxConfig;
  bundler: "vite" | "rsbuild" | "rspack";
  configFile: string;
  userModuleRules?: unknown[];
  synthesizedPath?: string;
}> {
  try {
    const loaded = await loadConfigOrRefuseOfficial(cwd);
    return loaded as any;
  } catch (error) {
    if (error instanceof RspfxError && error.code === "CONFIG_NOT_FOUND") {
      // Zero-config synthesis: create minimal rspack.config.ts with RspfxPlugin so delegation works
      const pkgPath = path.join(cwd, "package.json");
      let name = path.basename(cwd).replace(/^@[^/]+\//, "");
      let framework = "vanilla";
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
          name?: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        if (pkg.name) name = pkg.name.replace(/^@[^/]+\//, "");
        const deps = {
          ...(pkg.dependencies ?? {}),
          ...(pkg.devDependencies ?? {}),
        };
        if (deps["react"]) framework = "react";
        else if (deps["vue"]) framework = "vue";
        else if (deps["svelte"]) framework = "svelte";
        else if (deps["preact"]) framework = "preact";
        else if (deps["solid-js"]) framework = "solid";
      } catch {}
      const synthesizedPath = path.join(cwd, "rspack.config.ts");
      if (!fs.existsSync(synthesizedPath)) {
        const safeName = name.replace(/'/g, "\\'");
        const safeFramework = framework.replace(/'/g, "\\'");
        const content =
          `import { RspfxPlugin } from '@mbsks/rspfx-plugin';\n\n` +
          `export default {\n` +
          `  mode: 'production',\n` +
          `  plugins: [new RspfxPlugin({ name: '${safeName}', framework: '${safeFramework}' as any })]\n` +
          `};\n`;
        fs.writeFileSync(synthesizedPath, content);
        const loaded = await loadConfig(cwd);
        return { ...loaded, synthesizedPath } as any;
      }
      // If file already exists but load still failed, rethrow original
      throw error;
    }
    throw error;
  }
}

async function runDelegatedBuild(
  cwd: string,
  config: RspfxConfig,
  bundler: "vite" | "rsbuild" | "rspack",
  opts: BuildOptions,
  loaded: { userModuleRules?: unknown[] },
): Promise<{ stats: unknown; outputFiles: string[] }> {
  const distDir = path.join(cwd, config.build.outDir ?? "dist");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  if (bundler === "vite") {
    await runViteBuild(cwd);
    const outputFiles = fs
      .readdirSync(distDir)
      .filter((file) => file.endsWith(".js"));
    return { stats: undefined, outputFiles };
  }
  if (bundler === "rsbuild") {
    await runRsbuildBuild(cwd);
    const outputFiles = fs
      .readdirSync(distDir)
      .filter((file) => file.endsWith(".js"));
    return { stats: undefined, outputFiles };
  }
  // rspack delegation
  try {
    runRspackBuild(cwd);
    const outputFiles = fs
      .readdirSync(distDir)
      .filter((file) => file.endsWith(".js"));
    // assembleRelease is handled by RspfxPlugin's done hook on production build
    return { stats: undefined, outputFiles };
  } catch (error) {
    if (error instanceof RspfxError && (error as unknown as { code: string }).code === "RSPACK_NOT_FOUND") {
      // Fallback to direct in-process build when bin not available
      logger.warn(
        "Rspack CLI not found, falling back to in-process build (install @rspack/cli for delegation)",
      );
      const result = await runDirectBuild(cwd, config, opts, loaded);
      return result;
    }
    throw error;
  }
}

async function runDirectBuild(
  cwd: string,
  config: RspfxConfig,
  opts: BuildOptions,
  loaded: { userModuleRules?: unknown[]; rspfx?: { plugins: readonly unknown[] } },
): Promise<{ stats: unknown; outputFiles: string[] }> {
  const project = readProject(cwd, config.paths, config.version, config);
  const externals = collectExternals(cwd, project);

  const frameworkPreset = await loadFrameworkPreset(config.framework, cwd);
  const contributions = resolveContributionLoaders(
    ((frameworkPreset.preset.rspack
      ? frameworkPreset.preset.rspack({ fastRefresh: false })
      : frameworkPreset.preset.contributions?.({ fastRefresh: false })) ?? {}) as Record<string, unknown>,
    frameworkPreset.moduleUrl,
  );

  const ctx = createCompileContext({
    projectRoot: cwd,
    config,
    entries: project.webParts.entries,
    externals,
    localizedAliases: project.localizedAliases,
    localizedResources: project.localizedResources,
    fastRefresh: false,
    production: true,
    serveMode: false,
    build: {
      ...config.build,
      ...(opts.minify !== undefined ? { minify: opts.minify } : {}),
      ...(opts.sourcemap !== undefined ? { sourcemap: opts.sourcemap } : {}),
    },
  });
  if (loaded.userModuleRules) {
    (ctx as any).userModuleRules = loaded.userModuleRules;
  }
  ctx.swcContributions = [contributions as Record<string, unknown>];

  for (const plugin of ((loaded as { rspfx?: { plugins: readonly { compilerHooks?: { beforeCompile?: (c: unknown) => unknown; afterStats?: (s: unknown) => unknown } }[] } }).rspfx?.plugins ?? [])) {
    (plugin as unknown as { compilerHooks?: { beforeCompile?: (c: unknown) => unknown } }).compilerHooks?.beforeCompile?.(ctx as unknown);
  }

  const result = await build(ctx, loaded.userModuleRules);

  for (const plugin of ((loaded as { rspfx?: { plugins: readonly { compilerHooks?: { afterStats?: (s: unknown) => unknown } }[] } }).rspfx?.plugins ?? [])) {
    (plugin as unknown as { compilerHooks?: { afterStats?: (s: unknown) => unknown } }).compilerHooks?.afterStats?.(result.stats as unknown);
  }

  await assembleRelease({
    projectRoot: cwd,
    config,
    project,
    externals,
    outputFiles: result.outputFiles,
    production: true,
  });

  return { stats: result.stats, outputFiles: result.outputFiles };
}

function collectExternals(cwd: string, project: ReadProjectResult): string[] {
  return [
    ...findSpDependencies(cwd).keys(),
    ...project.externals,
    ...project.localizedResources.map((r) => r.name),
  ];
}
