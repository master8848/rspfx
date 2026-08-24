import fs from "node:fs";
import path from "node:path";
import { createLogger, formatBytes } from "@mbsks/rspfx-diagnostics";
import {
  type BuildPackageResult,
  buildPackage,
  validateSppkg,
} from "@mbsks/rspfx-sppkg-builder";
import { loadConfig } from "../config.js";
import { loadConfigOrRefuseOfficial } from "../hybrid.js";
import { runBuild } from "./build.js";

const logger = createLogger("rspfx");

export interface PackageOptions {
  build?: boolean;
}

export async function runPackage(
  cwd: string,
  opts: PackageOptions = {},
): Promise<BuildPackageResult> {
  if (opts.build !== false) {
    await runBuild(cwd, {});
  }
  const { config, rspfx } = await loadConfig(cwd).catch(() => loadConfigOrRefuseOfficial(cwd) as unknown as { config: typeof import('@mbsks/rspfx-core').configDefaults & { build: { releaseDir?: string }; paths?: { configDir?: string } }; rspfx?: { plugins: readonly unknown[] } });
  const releaseDir = config.build.releaseDir ?? "release";
  invokeBeforePackage(cwd, releaseDir, (rspfx as unknown as { plugins: readonly unknown[] } | undefined)?.plugins ?? []);
  const teamsDir = path.join(cwd, "teams");
  const sharepointDir = path.join(cwd, "sharepoint");
  const configDir = config.paths?.configDir ?? "config";
  const result = await buildPackage({
    projectRoot: cwd,
    solutionConfigPath: path.join(configDir, "package-solution.json"),
    manifestsDir: path.join(releaseDir, "manifests"),
    assetsDir: path.join(releaseDir, "assets"),
    outDir: undefined,
    production: true,
    teamsDir: fs.existsSync(teamsDir) ? "teams" : undefined,
    resxDir:
      fs.existsSync(sharepointDir) &&
      fs
        .readdirSync(sharepointDir)
        .some((file) => /^Resources.*\.resx$/.test(file))
        ? "sharepoint"
        : undefined,
  });

  const size = fs.statSync(result.outputPath).size;
  logger.success(
    `Package created: ${result.outputPath} (${formatBytes(size)})`,
  );

  for (const plugin of ((rspfx as unknown as { plugins: readonly { packageHooks?: { afterPackage?: (o: unknown) => unknown } }[] } | undefined)?.plugins ?? [])) {
    (plugin as unknown as { packageHooks?: { afterPackage?: (o: unknown) => unknown } }).packageHooks?.afterPackage?.({ sppkgPath: result.outputPath } as unknown);
  }

  const validation = await validateSppkg(result.outputPath);
  if (!validation.ok) {
    for (const error of validation.errors) {
      logger.error(`Package validation failed: ${error}`);
    }
  } else {
    logger.info(
      `Package validation passed (${result.zipEntries.length} entries)`,
    );
  }

  return result;
}

function invokeBeforePackage(cwd: string, releaseDir: string, plugins: readonly unknown[] = []): void {
  const manifestsDir = path.join(cwd, releaseDir, "manifests");
  const assetsDir = path.join(cwd, releaseDir, "assets");
  const manifests: unknown[] = [];
  if (fs.existsSync(manifestsDir)) {
    for (const file of fs.readdirSync(manifestsDir)) {
      if (!file.endsWith(".manifest.json")) {
        continue;
      }
      manifests.push(
        JSON.parse(fs.readFileSync(path.join(manifestsDir, file), "utf8")),
      );
    }
  }
  const files: { path: string; content: Uint8Array }[] = [];
  if (fs.existsSync(assetsDir)) {
    for (const name of fs.readdirSync(assetsDir)) {
      const filePath = path.join(assetsDir, name);
      if (!fs.statSync(filePath).isFile()) {
        continue;
      }
      files.push({ path: name, content: fs.readFileSync(filePath) });
    }
  }
  for (const plugin of plugins as readonly { packageHooks?: { beforePackage?: (o: unknown) => unknown } }[]) {
    (plugin as unknown as { packageHooks?: { beforePackage?: (o: unknown) => unknown } }).packageHooks?.beforePackage?.({ manifests, files } as unknown);
  }
}
