import fs from "node:fs";
import path from "node:path";
import {
  type FrameworkId,
  type RspfxConfig,
  SPFX_VERSIONS,
  isSpfxTarget,
} from "@mbsks/rspfx-core";
import { RspfxError } from "@mbsks/rspfx-diagnostics";
import { type LoadedProject, loadConfig } from "./config.js";

/**
 * Hybrid mode: an officially scaffolded SPFx project (gulp/heft toolchain) keeps
 * its production pipeline and uses rspfx only for `rspfx dev`. See
 * docs/hybrid-dev.md. Detection requires config/config.json (the definitive
 * SPFx project marker) plus a toolchain marker file at the project root.
 */
export interface OfficialProjectInfo {
  toolchainMarker: string;
}

const TOOLCHAIN_MARKERS: readonly string[] = [
  "gulpfile.js",
  "gulpfile.mjs",
  "heft.json",
  ".yo-rc.json",
];

const FRAMEWORK_DEPS: readonly [pkg: string, framework: FrameworkId][] = [
  ["react", "react"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["preact", "preact"],
  ["solid-js", "solid"],
];

interface OfficialPackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function detectOfficialProject(
  projectRoot: string,
): OfficialProjectInfo | undefined {
  if (!fs.existsSync(path.join(projectRoot, "config", "config.json"))) {
    return undefined;
  }
  for (const marker of TOOLCHAIN_MARKERS) {
    if (fs.existsSync(path.join(projectRoot, marker))) {
      return { toolchainMarker: marker };
    }
  }
  return undefined;
}

/**
 * Synthesizes an RspfxConfig from an official SPFx project layout. Only the
 * identity fields are derived here; serve settings (port/hostname/initialPage)
 * come from config/serve.json and components/externals/localized resources from
 * config/config.json via readProject, exactly as for rspfx-scaffolded projects.
 */
export function loadOfficialConfig(projectRoot: string): RspfxConfig {
  const packageJson = readPackageJson(projectRoot);
  const name = (packageJson.name ?? path.basename(projectRoot)).replace(
    /^@[^/]+\//,
    "",
  );
  const spfxVersion = resolveSpfxVersion(projectRoot, packageJson);
  assertSpPackagesInstalled(projectRoot);
  return {
    name,
    ...(packageJson.version !== undefined
      ? { version: packageJson.version }
      : {}),
    framework: detectFramework(packageJson),
    spfxVersion,
    language: "typescript",
    dev: {},
    build: {},
  };
}

function readPackageJson(projectRoot: string): OfficialPackageJson {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    ) as OfficialPackageJson;
  } catch {
    return {};
  }
}

function allDependencies(
  packageJson: OfficialPackageJson,
): Record<string, string> {
  return { ...packageJson.dependencies, ...packageJson.devDependencies };
}

function resolveSpfxVersion(
  projectRoot: string,
  packageJson: OfficialPackageJson,
): RspfxConfig["spfxVersion"] {
  const raw = allDependencies(packageJson)["@microsoft/sp-core-library"];
  if (raw === undefined) {
    throw new RspfxError(
      "OFFICIAL_SPFX_VERSION_UNKNOWN",
      `No @microsoft/sp-core-library dependency found in ${path.join(projectRoot, "package.json")}. Is this an SPFx project?`,
    );
  }
  const match = /(\d+)\.(\d+)\./.exec(raw);
  const target = match ? `${match[1]}.${match[2]}` : "";
  if (!isSpfxTarget(target)) {
    throw new RspfxError(
      "OFFICIAL_SPFX_VERSION_UNSUPPORTED",
      `SPFx version "${raw}" (@microsoft/sp-core-library) is not supported by rspfx. Supported targets: ${SPFX_VERSIONS.map((v) => v.target).join(", ")}.`,
    );
  }
  return target;
}

function detectFramework(packageJson: OfficialPackageJson): FrameworkId {
  const deps = allDependencies(packageJson);
  for (const [pkg, framework] of FRAMEWORK_DEPS) {
    if (deps[pkg] !== undefined) {
      return framework;
    }
  }
  return "vanilla";
}

function assertSpPackagesInstalled(projectRoot: string): void {
  if (
    fs.existsSync(
      path.join(projectRoot, "node_modules", "@microsoft", "sp-core-library"),
    )
  ) {
    return;
  }
  throw new RspfxError(
    "OFFICIAL_DEPS_NOT_INSTALLED",
    `@microsoft/sp-* packages are not installed in ${projectRoot}. Run your package manager's install command first.`,
  );
}

/**
 * Loads the rspfx bundler-plugin config for production commands, refusing with
 * a dedicated error when invoked on an official SPFx project: there the rspfx
 * contract is dev-only (`rspfx dev`); builds/packages stay on gulp/heft.
 */
export async function loadConfigOrRefuseOfficial(
  projectRoot: string,
): Promise<LoadedProject> {
  try {
    return await loadConfig(projectRoot);
  } catch (error) {
    if (error instanceof RspfxError && error.code === "CONFIG_NOT_FOUND") {
      const official = detectOfficialProject(projectRoot);
      if (official) {
        throw officialBuildRefusal(official.toolchainMarker);
      }
    }
    throw error;
  }
}

function officialBuildRefusal(toolchainMarker: string): RspfxError {
  return new RspfxError(
    "OFFICIAL_TOOLCHAIN_BUILD",
    `This is an official SPFx project (found config/config.json and ${toolchainMarker}) — rspfx provides only \`rspfx dev\` here. Keep production builds on the official toolchain (e.g. \`gulp bundle && gulp package-solution\`, or Heft on 1.23+). To migrate fully to rspfx builds see docs/migrating-from-gulp-heft.md.`,
  );
}
