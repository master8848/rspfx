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
import { createLogger } from "@mbsks/rspfx-diagnostics";
import { findSpDependencies } from "@mbsks/rspfx-manifest-generator";
import type { ComponentManifest } from "@mbsks/rspfx-manifest-generator";
import { getPlugins } from "@mbsks/rspfx-plugin-api";
import { loadConfigOrRefuseOfficial } from "../hybrid.js";
import { runRsbuildBuild } from "../rsbuild.js";
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
  const loaded = await loadConfigOrRefuseOfficial(cwd);
  const config = loaded.config;
  const project = readProject(cwd, config.paths, config.version, config);

  const externals = collectExternals(cwd, project);

  let stats: unknown;
  let outputFiles: string[];

  if (loaded.bundler === "vite" || loaded.bundler === "rsbuild") {
    const distDir = path.join(cwd, config.build.outDir ?? "dist");
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
    if (loaded.bundler === "vite") {
      await runViteBuild(cwd);
    } else {
      await runRsbuildBuild(cwd);
    }
    outputFiles = fs
      .readdirSync(distDir)
      .filter((file) => file.endsWith(".js"));
    stats = undefined;
  } else {
    const frameworkPreset = await loadFrameworkPreset(config.framework, cwd);
    const contributions = resolveContributionLoaders(
      frameworkPreset.preset.contributions({ fastRefresh: false }) as Record<
        string,
        unknown
      >,
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
    ctx.swcContributions = [contributions as Record<string, unknown>];

    for (const plugin of getPlugins()) {
      plugin.compilerHooks?.beforeCompile?.(ctx);
    }

    const result = await build(ctx);

    for (const plugin of getPlugins()) {
      plugin.compilerHooks?.afterStats?.(result.stats);
    }

    stats = result.stats;
    outputFiles = result.outputFiles;

    await assembleRelease({
      projectRoot: cwd,
      config,
      project,
      externals,
      outputFiles,
      production: true,
    });
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
}

function collectExternals(cwd: string, project: ReadProjectResult): string[] {
  return [
    ...findSpDependencies(cwd).keys(),
    ...project.externals,
    ...project.localizedResources.map((r) => r.name),
  ];
}
