import type { RspfxConfig } from "@mbsks/rspfx-core";
import {
  type DevRuntimeHandle,
  type ServeMode,
  buildWorkbenchUrl,
  readProject,
  resolveServeMode,
  resolveServeSettings,
  startServe,
} from "@mbsks/rspfx-dev-runtime";
import { RspfxError, createLogger } from "@mbsks/rspfx-diagnostics";
import { type BundlerId, loadConfig } from "../config.js";
import { detectOfficialProject, loadOfficialConfig } from "../hybrid.js";
import { spawnRsbuildDev } from "../rsbuild.js";
import { spawnViteDev } from "../vite.js";

const logger = createLogger("rspfx");

export interface DevOptions {
  refresh?: boolean;
  browser?: boolean;
  port?: number;
  mode?: "local" | "sharepoint";
  tenant?: string;
}

export function localPreviewUnavailableWarning(
  bundler: "vite" | "rsbuild",
  mode: ServeMode,
): string | undefined {
  if (mode !== "local") {
    return undefined;
  }
  return (
    `Local preview (no SharePoint) is only available on the Rspack bundler path — this project uses ${bundler}. ` +
    "Pass --tenant <url> to serve the SharePoint workbench instead, or scaffold a project with the default Rspack config (rspack.config.ts)."
  );
}

export async function runDev(
  cwd: string,
  opts: DevOptions = {},
): Promise<DevRuntimeHandle> {
  let config: RspfxConfig;
  let bundler: BundlerId = "rspack";
  try {
    const loaded = await loadConfig(cwd);
    config = loaded.config;
    bundler = loaded.bundler;
  } catch (error) {
    // Hybrid mode: an official SPFx project (gulp/heft) has no rspfx bundler
    // config — synthesize one so `rspfx dev` works while production stays on
    // the official toolchain. See docs/hybrid-dev.md.
    const official =
      error instanceof RspfxError && error.code === "CONFIG_NOT_FOUND"
        ? detectOfficialProject(cwd)
        : undefined;
    if (!official) {
      throw error;
    }
    config = loadOfficialConfig(cwd);
    logger.warn(
      `Official SPFx project detected (${official.toolchainMarker}) — rspfx serves development bundles only. ` +
        "Keep production builds on the official toolchain (gulp bundle && gulp package-solution, or Heft on 1.23+).",
    );
  }

  if (bundler === "vite" || bundler === "rsbuild") {
    const project = readProject(cwd, config.paths, config.version, config);
    const settings = resolveServeSettings(
      { port: opts.port, tenantDomain: opts.tenant, config },
      project.serveJson,
    );
    const fastRefresh = opts.refresh ?? config.dev.fastRefresh ?? false;
    const child =
      bundler === "vite"
        ? spawnViteDev(cwd, { fastRefresh, openBrowser: opts.browser })
        : spawnRsbuildDev(cwd, { fastRefresh, openBrowser: opts.browser });

    logger.info(
      `Manifest server running at ${settings.origin}/temp/manifests.js`,
    );

    const serveMode = resolveServeMode(
      { mode: opts.mode, config },
      settings.tenantDomain,
    );
    const warning = localPreviewUnavailableWarning(bundler, serveMode);
    if (warning) {
      logger.warn(warning);
    }

    const workbenchUrl = buildWorkbenchUrl(settings, config);
    if (workbenchUrl) {
      printBox([
        "Open this URL in the SharePoint workbench (debug manifests):",
        "",
        workbenchUrl,
      ]);
    }

    let closing = false;
    const shutdown = async (): Promise<void> => {
      if (closing) {
        return;
      }
      closing = true;
      child.kill();
      process.exit(0);
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());

    return {
      url: settings.origin,
      port: settings.port,
      workbenchUrl,
      close: async () => {
        child.kill();
      },
    };
  }

  const handle = await startServe({
    projectRoot: cwd,
    config,
    fastRefresh: opts.refresh ?? config.dev.fastRefresh,
    noBrowser: opts.browser === true ? false : undefined,
    port: opts.port,
    mode: opts.mode,
    tenantDomain: opts.tenant,
  });

  if (handle.workbenchUrl) {
    printBox([
      "Open this URL in the SharePoint workbench (debug manifests):",
      "",
      handle.workbenchUrl,
    ]);
  }

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    await handle.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  return handle;
}

export function printBox(lines: string[]): void {
  const width = Math.min(
    Math.max(...lines.map((line) => line.length)) + 4,
    100,
  );
  const border = `┌${"─".repeat(width - 2)}┐`;
  const bottom = `└${"─".repeat(width - 2)}┘`;
  process.stdout.write(`\n${border}\n`);
  for (const line of lines) {
    const content =
      line.length > width - 4 ? `${line.slice(0, width - 4)}…` : line;
    process.stdout.write(`│ ${content.padEnd(width - 4)} │\n`);
  }
  process.stdout.write(`${bottom}\n\n`);
}
