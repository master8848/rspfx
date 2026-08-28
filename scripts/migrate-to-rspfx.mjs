#!/usr/bin/env node
/**
 * migrate-to-rspfx.mjs — migrate an existing SPFx project off gulp/Heft/webpack
 * onto the RSPFX toolchain.
 *
 * Usage:
 *   node scripts/migrate-to-rspfx.mjs <project-dir>
 *
 * What it does (mechanical parts only — read the printed report, then read
 * docs/migrating-from-gulp-heft.md for the manual review checklist):
 *
 *   1. package.json — drop the Heft/webpack/gulp toolchain devDependencies,
 *      add `rspfx` scripts, relax the engines range.
 *   2. config/config.json — rewrite bundle entrypoints from the Heft output
 *      convention (`./lib/...WebPart.js`) to source (`./src/...WebPart.ts`) and
 *      rename bundle keys to match web part folder names (RSPFX requires the
 *      bundle name to equal the `src/webparts/<name>` folder).
 *   3. SCSS — rewrite `@import 'pkg:<pkg>/<path>'` (sass-loader ≥16.5 syntax)
 *      to a plain relative `node_modules` path so the bundled sass-loader
 *      resolves it.
 *   4. Delete Heft-only config files: rig.json, typescript.json, sass.json,
 *      deploy-azure-storage.json, spfx-customize-webpack.js.
 *   5. Write rspack.config.ts (RspfxPlugin-based; no dependency on @mbsks/rspfx-core
 *      required) and a plain tsconfig.json if the old one extends a rig.
 *
 * Note: `localizedResources` in config.json are handled natively — RSPFX maps
 * each string module (e.g. `import strings from 'XxxWebPartStrings'`) to the
 * default-locale source file. No import rewrites are needed. Multi-locale is
 * preserved in the manifest only if the source manifest already declares
 * `localizedPath` entries — otherwise the migrated project is single-locale.
 *
 * The script never installs dependencies, never deletes src/, and never touches
 * anything outside the project directory. Back up / commit before running.
 */

import fs from 'node:fs';
import path from 'node:path';

console.warn('[deprecated] scripts/migrate-to-rspfx.mjs is deprecated — use `rspfx migrate` instead. This wrapper will be removed in a future release.');

const projectRoot = process.argv[2];
if (!projectRoot) {
  console.error('usage: node scripts/migrate-to-rspfx.mjs <project-dir>');
  process.exit(1);
}

const log = (msg) => console.log(msg);

const TOOLCHAIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    if (pkg.version) return pkg.version;
  } catch {}
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../apps/cli/package.json', import.meta.url), 'utf8'));
    if (pkg.version) return pkg.version;
  } catch {}
  return '0.0.1';
})();

// ─── toolchain devDependencies that exist only to serve Heft/webpack/gulp ────
const TOOLCHAIN_DEPS = [
  '@babel/plugin-transform-logical-assignment-operators',
  '@babel/plugin-transform-nullish-coalescing-operator',
  '@babel/plugin-transform-optional-chaining',
  '@microsoft/eslint-config-spfx',
  '@microsoft/eslint-plugin-spfx',
  '@microsoft/rush-stack-compiler-2.7',
  '@microsoft/rush-stack-compiler-2.9',
  '@microsoft/rush-stack-compiler-3.3',
  '@microsoft/rush-stack-compiler-3.5',
  '@microsoft/rush-stack-compiler-3.7',
  '@microsoft/rush-stack-compiler-3.9',
  '@microsoft/rush-stack-compiler-4.0',
  '@microsoft/rush-stack-compiler-4.1',
  '@microsoft/rush-stack-compiler-4.2',
  '@microsoft/rush-stack-compiler-4.3',
  '@microsoft/rush-stack-compiler-4.5',
  '@microsoft/rush-stack-compiler-4.7',
  '@microsoft/sp-build-core-tasks',
  '@microsoft/sp-build-web',
  '@microsoft/spfx-heft-plugins',
  '@microsoft/spfx-web-build-rig',
  '@microsoft/sp-module-interfaces',
  '@rushstack/heft',
  '@rushstack/rig-package',
  '@types/webpack-env',
  'babel-loader',
  'css-loader',
  'eslint',
  'eslint-plugin-react-hooks',
  'gulp',
  'gulp-connect',
  'gulp-if',
  'gulp-open',
  'gulp-rename',
  'gulp-serve',
  'gulp-sourcemaps',
  'gulp-util',
  'html-loader',
  'ignore-loader',
  'os-browserify',
  'path-browserify',
  'process',
  'querystring-es3',
  'semver',
  'style-loader',
  'ts-loader',
  'url',
  'util',
  'webpack',
  'webpack-bundle-analyzer',
  'webpack-dev-server',
  'webpack-manifest-plugin',
  'webpack-merge'
];

const HEft_ONLY_CONFIG_FILES = [
  'rig.json',
  'typescript.json',
  'sass.json',
  'deploy-azure-storage.json',
  'spfx-customize-webpack.js'
];

const PKG_IMPORT_RE = /@import\s+['"]pkg:([^/'"]+)\/([^'"]+)['"]/g;

const RSPFX_SCRIPTS = {
  dev: 'rspfx dev',
  'dev:refresh': 'rspfx dev --refresh',
  build: 'rspfx build',
  package: 'rspfx package',
  analyze: 'rspfx analyze',
  doctor: 'rspfx doctor',
  clean: 'rspfx clean'
};

// ─── 1. package.json ─────────────────────────────────────────────────────────
const packageJsonPath = path.join(projectRoot, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  log(`✗ no package.json at ${projectRoot}`);
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const devDeps = pkg.devDependencies ?? {};
const removed = Object.keys(devDeps).filter((name) => TOOLCHAIN_DEPS.includes(name));
for (const name of removed) {
  delete devDeps[name];
}
devDeps['@mbsks/rspfx-plugin'] = `^${TOOLCHAIN_VERSION}`;
pkg.devDependencies = devDeps;
const removedHeftScripts = [];
if (pkg.scripts?.start && pkg.scripts.start.includes('heft')) {
  removedHeftScripts.push('start');
  delete pkg.scripts.start;
}
if (pkg.scripts?.['eject-webpack']) {
  removedHeftScripts.push('eject-webpack');
  delete pkg.scripts['eject-webpack'];
}
pkg.scripts = { ...pkg.scripts, ...RSPFX_SCRIPTS };
if (pkg.engines?.node) {
  pkg.engines.node = '>=20.0.0';
}
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 4) + '\n');
log(`✓ package.json: removed ${removed.length} toolchain devDependencies` +
  (removed.length ? ` (${removed.join(', ')})` : '') + ', added rspfx scripts' +
  (removedHeftScripts.length ? `, dropped heft scripts (${removedHeftScripts.join(', ')})` : '') +
  ', added @mbsks/rspfx-plugin devDependency');

// ─── 2. config/config.json ───────────────────────────────────────────────────
const configJsonPath = path.join(projectRoot, 'config', 'config.json');
if (fs.existsSync(configJsonPath)) {
  const cfg = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
  if (cfg.bundles) {
    for (const [bundleName, entry] of Object.entries(cfg.bundles)) {
      for (const component of entry.components ?? []) {
        if (typeof component.entrypoint === 'string') {
          let entrypoint = component.entrypoint;
          if (entrypoint.startsWith('./lib/')) {
            const src = './src/' + entrypoint.slice('./lib/'.length);
            const base = src.replace(/\.(js|ts|tsx)$/, '');
            entrypoint = fs.existsSync(path.join(projectRoot, base + '.ts'))
              ? base + '.ts'
              : fs.existsSync(path.join(projectRoot, base + '.tsx'))
                ? base + '.tsx'
                : base + '.js';
            component.entrypoint = entrypoint;
          }
        }
        if (typeof component.manifest === 'string' && component.manifest.startsWith('./lib/')) {
          component.manifest = './src/' + component.manifest.slice('./lib/'.length).replace(/\.js$/, '.json');
        }
      }
      const manifestPath = entry.components?.[0]?.manifest ?? '';
      const match = manifestPath.match(/src\/(?:webparts|extensions|libraries)\/([^/]+)\//);
      if (match && match[1] && match[1] !== bundleName) {
        cfg.bundles[match[1]] = cfg.bundles[bundleName];
        delete cfg.bundles[bundleName];
        log(`✓ config.json: renamed bundle "${bundleName}" → "${match[1]}" (must match component folder)`);
      }
    }
  }
  fs.writeFileSync(configJsonPath, JSON.stringify(cfg, null, 4) + '\n');
  log('✓ config.json: entrypoints rewritten from ./lib/ to ./src/');
} else {
  log('– config/config.json not found (web parts will be auto-discovered from src/webparts/*)');
}

// ─── 3. `pkg:` sass imports → relative node_modules paths ────────────────────
const srcDir = path.join(projectRoot, 'src');
const pkgImportsFixed = [];
if (fs.existsSync(srcDir)) {
  const walk = (dir) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        walk(full);
      } else if (dirent.name.endsWith('.scss')) {
        let content = fs.readFileSync(full, 'utf8');
        if (content.includes('pkg:')) {
          content = content.replace(PKG_IMPORT_RE, (match, pkgName, pkgPath) => {
            const rel = path
              .relative(path.dirname(full), path.join(projectRoot, 'node_modules', pkgName, pkgPath))
              .replace(/\\/g, '/');
            const specifier = rel.startsWith('.') ? rel : './' + rel;
            pkgImportsFixed.push(`${path.relative(projectRoot, full)}: pkg:${pkgName}/${pkgPath} → ${specifier}`);
            return `@import '${specifier}'`;
          });
          fs.writeFileSync(full, content);
        }
      }
    }
  };
  walk(srcDir);
}
if (pkgImportsFixed.length > 0) {
  log(`✓ rewrote ${pkgImportsFixed.length} sass \`pkg:\` imports to relative node_modules paths`);
} else {
  log('– no sass `pkg:` imports found');
}

// ─── 4. delete Heft-only config files ────────────────────────────────────────
const configDir = path.join(projectRoot, 'config');
if (fs.existsSync(configDir)) {
  const deleted = [];
  for (const file of HEft_ONLY_CONFIG_FILES) {
    if (fs.existsSync(path.join(configDir, file))) {
      fs.unlinkSync(path.join(configDir, file));
      deleted.push(file);
    }
  }
  if (deleted.length > 0) {
    log(`✓ removed Heft-only config files: ${deleted.join(', ')}`);
  }
}

// ─── 5. rspack.config.ts + tsconfig.json ─────────────────────────────────────
const projectName = (pkg.name ?? 'my-app').replace(/^@[^/]+\//, '');
const framework = (pkg.dependencies?.react ?? pkg.devDependencies?.react) ? 'react' : 'vanilla';
const hasScss = fs.existsSync(path.join(srcDir, 'webparts')) &&
  fs.readdirSync(path.join(srcDir, 'webparts'), { recursive: true }).some((f) => f.endsWith('.scss'));
const styling = hasScss || pkg.dependencies?.sass ? 'scss' : 'css';
let defaultSpfxVersion = '1.23';
let supportedTargets = ['1.20', '1.21', '1.22', '1.23'];
try {
  const versionsPath = path.join(new URL('.', import.meta.url).pathname, '../packages/core/src/versions.ts');
  const content = fs.readFileSync(versionsPath, 'utf8');
  const match = content.match(/SPFX_DEFAULT_TARGET:\s*SpfxTarget\s*=\s*'([^']+)'/);
  if (match?.[1]) defaultSpfxVersion = match[1];
  const targetMatches = [...content.matchAll(/target:\s*'([^']+)'/g)];
  if (targetMatches.length > 0) supportedTargets = targetMatches.map((m) => m[1]);
} catch {
  // fallback to 1.23 / hardcoded list
}
// Detect SPFx version from @microsoft/sp-core-library, robust to "^1.20.0", "~1.21.0", ">=1.23.0", etc.
let spfxVersion = defaultSpfxVersion;
let spfxSource = 'fallback';
const rawSpfx = pkg.dependencies?.['@microsoft/sp-core-library'] ?? pkg.devDependencies?.['@microsoft/sp-core-library'];
if (rawSpfx !== undefined) {
  const m = /(\d+)\.(\d+)\./.exec(rawSpfx);
  const candidate = m ? `${m[1]}.${m[2]}` : '';
  if (candidate && supportedTargets.includes(candidate)) {
    spfxVersion = candidate;
    spfxSource = 'detected';
    log(`ℹ detected SPFx version ${spfxVersion} from @microsoft/sp-core-library ${rawSpfx}`);
  } else if (candidate) {
    log(`ℹ SPFx version "${rawSpfx}" (target "${candidate}") not in supported targets — using default ${defaultSpfxVersion}`);
  } else {
    log(`ℹ could not parse SPFx version from "${rawSpfx}" — using default ${defaultSpfxVersion}`);
  }
} else {
  log(`ℹ no @microsoft/sp-core-library found — using default SPFx version ${defaultSpfxVersion}`);
}

const configContent = `import { RspfxPlugin } from '@mbsks/rspfx-plugin';

export default {
  mode: 'development',
  plugins: [
    new RspfxPlugin({
      name: '${projectName}',
      framework: '${framework}',
      spfxVersion: '${spfxVersion}',
      styling: '${styling}',
      dev: {
        // https://{tenantdomain}/... is taken from config/serve.json initialPage
        tenantUrl: 'https://contoso.sharepoint.com'
      }
    })
  ]
};
`;
const configTsPath = path.join(projectRoot, 'rspack.config.ts');
if (!fs.existsSync(configTsPath)) {
  fs.writeFileSync(configTsPath, configContent);
  const spfxLabel = spfxSource === 'detected' ? `${spfxVersion} (detected)` : `${spfxVersion} (default)`;
  log(`✓ wrote rspack.config.ts with RspfxPlugin (framework: ${framework}, styling: ${styling}, spfx: ${spfxLabel}) — edit dev.tenantUrl`);
}

// tsconfig is always left as-is — user's config is respected (scaffold defaults to TS7, migrate keeps existing)

// ─── report ──────────────────────────────────────────────────────────────────
log('');
log('Migration done. Next steps (see docs/migrating-from-gulp-heft.md):');
log('  1. pnpm install   # or npm install / yarn');
log('  2. rspfx dev      # workbench-first development');
log('  3. rspfx package  # → sharepoint/solution/*.sppkg');
log('  4. Review the report below for gaps:');
log('');
if (removed.length === 0) {
  log('  • no known Heft/gulp toolchain devDependencies were present — double-check manually');
}
if (fs.existsSync(path.join(projectRoot, 'src', 'extensions'))) {
  log('  • src/extensions/ detected — extension components will be built as AMD bundles (Type=Extension)');
}
if (fs.existsSync(path.join(projectRoot, 'src', 'libraries'))) {
  log('  • src/libraries/ detected — library components will be built as AMD bundles (Type=Library)');
}
log('  • multi-locale: string modules resolve to the default locale; multi-locale bundles need');
log('    localizedPath scriptResources in the source manifest (not generated from config.json yet)');
