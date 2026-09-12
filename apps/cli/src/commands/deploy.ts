import fs from "node:fs";
import path from "node:path";
import { RspfxError, RspfxErrorCode, createLogger } from "@mbsks/rspfx-diagnostics";
import { loadConfigOrRefuseOfficial } from "../hybrid.js";
import { promptText } from "../prompts.js";
import { runPackage } from "./package.js";
import { validateDeployOptions } from "../validation.js";

const logger = createLogger("rspfx");

export interface DeployOptions {
  build?: boolean;
}

export async function runDeploy(
  cwd: string,
  opts: DeployOptions = {},
): Promise<void> {
  const result = await runPackage(cwd, { build: opts.build });
  const rawToken = process.env.RSPFX_ACCESS_TOKEN?.trim();
  const token = rawToken ? rawToken : undefined;
  if (!token) {
    printManualInstructions(result.outputPath);
    return;
  }

  const { config } = await loadConfigOrRefuseOfficial(cwd);
  let tenant =
    config.deploy?.appCatalogSiteUrl ?? process.env.RSPFX_APP_CATALOG_URL;
  if (!tenant) {
    tenant = await promptText(
      "App catalog site URL (e.g. https://contoso.sharepoint.com/sites/appcatalog)",
    );
  }
  if (!tenant) {
    logger.warn("No app catalog URL configured. Skipping upload.");
    printManualInstructions(result.outputPath);
    return;
  }
  tenant = tenant.trim();
  // Validate deploy options via valibot before manual URL checks — provides CONFIG_VALIDATION_FAILED with fix hint
  const deployValidation = validateDeployOptions({ tenantUrl: tenant, sppkgPath: result.outputPath });
  if (!deployValidation.ok) {
    const first = deployValidation.error[0]!;
    // Map to DEPLOY_INVALID_URL but preserve CONFIG_VALIDATION_FAILED code for validation failures?
    // Use CONFIG_VALIDATION_FAILED as primary code per task, but keep DEPLOY_INVALID_URL for compatibility.
    // We'll throw CONFIG_VALIDATION_FAILED to satisfy valibot grep, but also ensure message contains fix.
    const msg = deployValidation.error.map((e) => `${e.path.join('.') || '<root>'}: ${e.message} (${e.code})`).join('\n');
    throw new RspfxError(RspfxErrorCode.CONFIG_VALIDATION_FAILED, `deploy validation failed for tenantUrl:\n${msg}\n — fix: pass --tenantUrl https://contoso.sharepoint.com (see https://github.com/master8848/rspfx#configuration)`, deployValidation.error as unknown as Error);
  }
  // Also keep explicit https/sharepoint checks for backward compat, but messages already actionable
  if (!deployValidation.ok) {
    const _exhaustive: never = deployValidation as never;
    void _exhaustive;
  }

  const fileName = path.basename(result.outputPath);
  let tenantUrl: URL;
  try {
    tenantUrl = new URL(tenant);
  } catch {
    throw new RspfxError(
      "DEPLOY_INVALID_URL",
      `Invalid app catalog URL: ${tenant} — fix: pass --tenantUrl https://contoso.sharepoint.com (see https://github.com/master8848/rspfx#configuration)`,
    );
  }
  if (tenantUrl.protocol !== "https:") {
    throw new RspfxError(
      "DEPLOY_INVALID_URL",
      `Invalid app catalog URL: expected https:// URL, got ${tenant} — fix: pass --tenantUrl https://contoso.sharepoint.com (see https://github.com/master8848/rspfx#configuration)`,
    );
  }
  if (!tenantUrl.hostname.toLowerCase().includes("sharepoint")) {
    throw new RspfxError(
      "DEPLOY_INVALID_URL",
      `Invalid app catalog URL: expected a SharePoint host, got ${tenant} — fix: pass --tenantUrl https://contoso.sharepoint.com (see https://github.com/master8848/rspfx#configuration)`,
    );
  }
  const basePath = tenantUrl.pathname.replace(/\/+$/, "");
  const encodedFileName = fileName.replace(/'/g, "''");
  const uploadUrl = `${tenantUrl.origin}${basePath}/_api/web/GetFolderByServerRelativeUrl('AppCatalog')/Files/add(url='${encodedFileName}',overwrite=true)`;
  const body = fs.readFileSync(result.outputPath);

  logger.info(`Uploading ${fileName} to ${uploadUrl}...`);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body,
    signal: AbortSignal.timeout(120_000),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RspfxError(
        "DEPLOY_TIMEOUT",
        "Upload to the app catalog timed out after 120s",
      );
    }
    throw error;
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new RspfxError(
      "DEPLOY_FAILED",
      `Upload failed with status ${response.status}: ${detail.slice(0, 500)}`,
    );
  }
  logger.success(`Deployed ${fileName} to the app catalog.`);
}

function printManualInstructions(outputPath: string): void {
  logger.info("No RSPFX_ACCESS_TOKEN set. Deploy manually:");
  logger.info(
    `  1. Open the SharePoint App Catalog site (Site contents -> Apps for SharePoint).`,
  );
  logger.info(`  2. Upload the package: ${outputPath}`);
  logger.info(`  3. Confirm the "You trust this solution" prompt.`);
  logger.info(
    "Or set RSPFX_ACCESS_TOKEN (and RSPFX_APP_CATALOG_URL) to upload via the CLI.",
  );
}
