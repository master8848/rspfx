import fs from 'node:fs';

/**
 * Local preview page: the Vite-style entry served at `/` by `rspfx dev` in
 * local mode. Static HTML (no SharePoint) that injects the discovered web
 * part list into `window.__RSPFX_COMPONENTS__` and loads the local runtime
 * bootstrap bundle (`/dist/local-runtime.js`), which in turn loads each web
 * part bundle and mounts it with an emulated SPFx context.
 *
 * SECURITY: `window.__RSPFX_COMPONENTS__` and the per-bundle
 * `window.__rspfx_script_url_*` globals (see `compiler-rspack/src/public-path.ts`)
 * are XSS-sensitive — any script that can overwrite them can redirect chunk
 * loads or inject components. The page is dev-only (never shipped), but editor
 * XSS in a dependency could still overwrite the chunk base (publicPath) or
 * component list. We freeze `__RSPFX_COMPONENTS__` with
 * `Object.defineProperty(..., { writable:false, configurable:false })` after
 * assignment so later scripts cannot silently replace it. The chunk URL globals
 * are captured at bundle top-level via `document.currentScript` before user code
 * runs, but remain overwritable if an attacker runs before the bundle — documented.
 */

export interface LocalPageComponent {
  id: string;
  alias: string;
  bundleName: string;
  amdId: string;
  componentType?: 'WebPart' | 'Extension';
  extensionType?: string;
  localizedResources?: string[];
  items?: Record<string, { title?: { default?: string }; type?: string }>;
  preconfiguredEntries?: { properties?: Record<string, unknown> }[];
}

export interface LocalPageOptions {
  projectName: string;
  origin: string;
  components: LocalPageComponent[];
  reloadClientScript: string;
}

export function buildLocalPageHtml(opts: LocalPageOptions): string {
  const componentsJson = JSON.stringify(opts.components).replace(/</g, '\\u003c');
  // Escape origin for safe interpolation into <script src="...">; hostname is validated via URL parsing.
  const safeOrigin = escapeHtml(opts.origin);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.projectName)} — local preview</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif;
    background: #f3f2f1;
    color: #323130;
  }
  .rspfx-bar {
    display: flex; align-items: baseline; gap: 12px;
    padding: 10px 20px;
    background: #ffffff;
    border-bottom: 1px solid #edebe9;
    font-size: 14px;
  }
  .rspfx-bar b { font-size: 15px; }
  .rspfx-hint { color: #605e5c; font-size: 12px; }
  #__rspfx_host { max-width: 900px; margin: 24px auto; padding: 0 20px; }
  .rspfx-wp-card {
    background: #ffffff;
    border: 1px solid #edebe9;
    border-radius: 4px;
    box-shadow: 0 1.6px 3.6px rgba(0,0,0,0.132), 0 0.3px 0.9px rgba(0,0,0,0.108);
    margin-bottom: 20px;
    overflow: hidden;
  }
  .rspfx-wp-card header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #edebe9;
    background: #faf9f8;
  }
  .rspfx-wp-card h2 { margin: 0; font-size: 14px; font-weight: 600; color: #323130; }
  .rspfx-wp-status { font-size: 11px; color: #605e5c; }
  .rspfx-wp-type {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 2px 8px; border-radius: 10px;
    background: #e5f1fb; color: #004578;
  }
  .rspfx-wp-ready { color: #107c10; }
  .rspfx-wp-root { min-height: 120px; padding: 16px; }
  .rspfx-ac-placeholder { min-height: 8px; border-radius: 2px; }
  .rspfx-ac-placeholder:empty { display: none; }
  .rspfx-fc-table, .rspfx-lvcs-toolbar { margin-bottom: 12px; }
  .rspfx-fc-table {
    border-collapse: collapse; width: 100%; font-size: 13px;
  }
  .rspfx-fc-table th, .rspfx-fc-table td {
    border: 1px solid #edebe9; padding: 6px 10px; text-align: left;
  }
  .rspfx-fc-table th { background: #faf9f8; font-weight: 600; }
  .rspfx-fc-cell { min-height: 20px; }
  .rspfx-lvcs-toolbar { display: flex; gap: 8px; }
  .rspfx-lvcs-button {
    font: inherit; font-size: 13px; padding: 5px 12px;
    border: 1px solid #8a8886; border-radius: 2px; background: #ffffff; cursor: pointer;
  }
  .rspfx-lvcs-button:hover { background: #f3f2f1; }
  .rspfx-lvcs-button:disabled { opacity: 0.5; cursor: default; }
  .rspfx-wp-error {
    margin: 8px 0 0; padding: 10px;
    background: #fde7e9; color: #a4262c;
    font-size: 12px; white-space: pre-wrap;
    border-radius: 2px;
  }
  .rspfx-wp-fatal {
    max-width: 900px; margin: 24px auto; padding: 12px 16px;
    background: #fde7e9; color: #a4262c;
    border: 1px solid #f1707b; border-radius: 4px;
    font-size: 13px;
  }
</style>
</head>
<body>
<header class="rspfx-bar">
  <b>${escapeHtml(opts.projectName)}</b>
  <span>local preview</span>
  <span class="rspfx-hint">no SharePoint required — run <code>rspfx dev --tenant &lt;url&gt;</code> to debug in the real workbench, or add <code>?locale=fr-fr</code> to preview another language</span>
</header>
<div id="__rspfx_host"></div>
<script>
  window.__RSPFX_COMPONENTS__ = ${componentsJson};
  try { Object.defineProperty(window, '__RSPFX_COMPONENTS__', { value: window.__RSPFX_COMPONENTS__, writable: false, configurable: false }); } catch {}
</script>
<script src="${safeOrigin}/dist/local-runtime.js"></script>
<script>${opts.reloadClientScript}</script>
</body>
</html>
`;
}

export function readLocalPageComponents(
  bundles: { bundleName: string; manifestPath: string }[],
  packageVersion: string
): LocalPageComponent[] {
  const components: LocalPageComponent[] = [];
  for (const bundle of bundles) {
    const manifest = JSON.parse(fs.readFileSync(bundle.manifestPath, 'utf8')) as {
      id?: string;
      alias?: string;
      componentType?: 'WebPart' | 'Extension';
      extensionType?: string;
      items?: Record<string, { title?: { default?: string }; type?: string }>;
      preconfiguredEntries?: { properties?: Record<string, unknown> }[];
      loaderConfig?: {
        scriptResources?: Record<string, { type?: string }>;
      };
    };
    if (!manifest.id) {
      continue;
    }
    const scriptResources = manifest.loaderConfig?.scriptResources ?? {};
    components.push({
      id: manifest.id,
      alias: manifest.alias ?? manifest.id,
      bundleName: bundle.bundleName,
      amdId: `${manifest.id}_${packageVersion}`,
      componentType: manifest.componentType,
      extensionType: manifest.extensionType,
      items: manifest.items,
      localizedResources: Object.entries(scriptResources)
        .filter(([, resource]) => resource?.type === 'localizedPath')
        .map(([name]) => name),
      preconfiguredEntries: manifest.preconfiguredEntries
    });
  }
  return components;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
