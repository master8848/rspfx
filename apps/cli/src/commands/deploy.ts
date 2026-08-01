import fs from 'node:fs';
import path from 'node:path';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { loadConfig } from '../config.js';
import { runPackage } from './package.js';
import { promptText } from '../prompts.js';

const logger = createLogger('rspfx');

export interface DeployOptions {
  build?: boolean;
}

export async function runDeploy(cwd: string, opts: DeployOptions = {}): Promise<void> {
  const result = await runPackage(cwd, { build: opts.build });
  const token = process.env.RSPFX_ACCESS_TOKEN;
  if (!token) {
    printManualInstructions(result.outputPath);
    return;
  }

  const config = await loadConfig(cwd);
  let tenant = config.deploy?.appCatalogSiteUrl ?? process.env.RSPFX_APP_CATALOG_URL;
  if (!tenant) {
    tenant = await promptText('App catalog site URL (e.g. https://contoso.sharepoint.com/sites/appcatalog)');
  }
  if (!tenant) {
    logger.warn('No app catalog URL configured. Skipping upload.');
    printManualInstructions(result.outputPath);
    return;
  }

  const fileName = path.basename(result.outputPath);
  const uploadUrl = `${tenant.replace(/\/+$/, '')}/_api/web/GetFolderByServerRelativeUrl('AppCatalog')/Files/add(url='${fileName}',overwrite=true)`;
  const body = fs.readFileSync(result.outputPath);

  logger.info(`Uploading ${fileName} to ${uploadUrl}...`);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream'
    },
    body
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new RspfxError('DEPLOY_FAILED', `Upload failed with status ${response.status}: ${detail.slice(0, 500)}`);
  }
  logger.success(`Deployed ${fileName} to the app catalog.`);
}

function printManualInstructions(outputPath: string): void {
  logger.info('No RSPFX_ACCESS_TOKEN set. Deploy manually:');
  logger.info(`  1. Open the SharePoint App Catalog site (Site contents -> Apps for SharePoint).`);
  logger.info(`  2. Upload the package: ${outputPath}`);
  logger.info(`  3. Confirm the "You trust this solution" prompt.`);
  logger.info('Or set RSPFX_ACCESS_TOKEN (and RSPFX_APP_CATALOG_URL) to upload via the CLI.');
}
