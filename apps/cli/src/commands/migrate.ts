import fs from 'node:fs';
import path from 'node:path';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import { isSpfxTarget, SPFX_DEFAULT_TARGET, type SpfxTarget } from '@mbsks/rspfx-core';
import { promptConfirm } from '../prompts.js';

const logger = createLogger('rspfx');

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

const HEFT_ONLY_CONFIG_FILES = [
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
} as const;

export type MigrateFrom = 'auto' | 'heft' | 'gulp';
export type MigrateBundler = 'vite' | 'rsbuild' | 'rspack';

export interface MigrateOptions {
  from?: MigrateFrom;
  bundler?: MigrateBundler;
  spfxVersion?: string;
  dryRun?: boolean;
  revert?: boolean;
  force?: boolean;
  yes?: boolean;
}

export interface MigrateResult {
  migrated: boolean;
  reverted: boolean;
  dryRun: boolean;
  backupPath: string;
}

const BACKUP_DIR = '.rspfx';
const BACKUP_FILE = 'migrate-backup.json';

interface BackupSnapshot {
  timestamp: string;
  bundler: MigrateBundler;
  files: Record<string, string | null>;
  deletedHeftFiles: Record<string, string>;
  scssFixes: Record<string, string>;
}

function resolveConfigDir(cwd: string): string {
  // Try to read existing bundler config to get paths.configDir; fallback to 'config'
  try {
    const candidates = ['rspack.config.ts', 'rspack.config.js', 'vite.config.ts', 'vite.config.js', 'rsbuild.config.ts', 'rsbuild.config.js'];
    for (const f of candidates) {
      if (fs.existsSync(path.join(cwd, f))) {
        // We can't easily parse without jiti; just use default. Migration runs before config exists usually.
        break;
      }
    }
  } catch {
    // ignore
  }
  // Also check if config dir is custom via reading package.json? Not needed.
  return 'config';
}

function detectFrom(cwd: string): MigrateFrom | undefined {
  if (fs.existsSync(path.join(cwd, 'heft.json'))) return 'heft';
  if (fs.existsSync(path.join(cwd, 'gulpfile.js')) || fs.existsSync(path.join(cwd, 'gulpfile.mjs'))) return 'gulp';
  return undefined;
}

function readJsonIfExists(filePath: string): unknown | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return undefined;
  }
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function bundlerConfigFile(bundler: MigrateBundler): string {
  if (bundler === 'vite') return 'vite.config.ts';
  if (bundler === 'rsbuild') return 'rsbuild.config.ts';
  return 'rspack.config.ts';
}

function buildBundlerConfigContent(bundler: MigrateBundler, projectName: string, framework: string, spfxVersion: string, styling: string): string {
  const commonOpts = `      name: '${projectName}',\n      framework: '${framework}',\n      spfxVersion: '${spfxVersion}',\n      styling: '${styling}',\n      dev: {\n        // https://{tenantdomain}/... is taken from config/serve.json initialPage\n        tenantUrl: 'https://contoso.sharepoint.com'\n      }`;
  if (bundler === 'vite') {
    return `import { rspfxVite } from '@mbsks/rspfx-plugin';\n\nexport default {\n  plugins: [\n    rspfxVite({\n${commonOpts}\n    })\n  ]\n};\n`;
  }
  if (bundler === 'rsbuild') {
    return `import { rspfxRsbuild } from '@mbsks/rspfx-plugin';\n\nexport default {\n  plugins: [\n    rspfxRsbuild({\n${commonOpts}\n    })\n  ]\n};\n`;
  }
  return `import { RspfxPlugin } from '@mbsks/rspfx-plugin';\n\nexport default {\n  mode: 'development',\n  plugins: [\n    new RspfxPlugin({\n${commonOpts}\n    })\n  ]\n};\n`;
}

export async function runMigrate(cwd: string, opts: MigrateOptions = {}): Promise<MigrateResult> {
  const projectRoot = path.resolve(cwd);
  const bundler: MigrateBundler = opts.bundler ?? 'vite';
  if (!['vite', 'rsbuild', 'rspack'].includes(bundler)) {
    throw new RspfxError('INVALID_OPTION', `Unknown bundler '${bundler}'. Expected one of: vite, rsbuild, rspack`);
  }
  if (opts.spfxVersion !== undefined && !isSpfxTarget(opts.spfxVersion)) {
    throw new RspfxError('INVALID_OPTION', `Unknown spfx version '${opts.spfxVersion}'.`);
  }
  const from: MigrateFrom = opts.from ?? 'auto';
  if (!['auto', 'heft', 'gulp'].includes(from)) {
    throw new RspfxError('INVALID_OPTION', `Unknown --from '${from}'. Expected auto, heft, gulp`);
  }

  const configDir = resolveConfigDir(projectRoot);
  const backupPath = path.join(projectRoot, BACKUP_DIR, BACKUP_FILE);

  if (opts.revert) {
    if (!fs.existsSync(backupPath)) {
      throw new RspfxError('MIGRATE_NO_BACKUP', `No backup found at ${path.relative(projectRoot, backupPath)}. Nothing to revert.`);
    }
    if (opts.dryRun) {
      const snap = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as BackupSnapshot;
      logger.info('[dry-run] Would revert migration from backup:');
      for (const [rel, content] of Object.entries(snap.files)) {
        logger.info(`  ${content === null ? 'delete' : 'restore'} ${rel}`);
      }
      for (const [rel] of Object.entries(snap.deletedHeftFiles)) {
        logger.info(`  restore ${path.join(configDir, rel)}`);
      }
      for (const [rel] of Object.entries(snap.scssFixes)) {
        logger.info(`  restore scss ${rel}`);
      }
      const bFile = bundlerConfigFile(snap.bundler);
      logger.info(`  delete ${bFile} (if created)`);
      return { migrated: false, reverted: false, dryRun: true, backupPath };
    }
    const snap = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as BackupSnapshot;
    // Restore files
    for (const [rel, content] of Object.entries(snap.files)) {
      const abs = path.join(projectRoot, rel);
      if (content === null) {
        if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
      } else {
        ensureDir(path.dirname(abs));
        fs.writeFileSync(abs, content);
      }
    }
    // Restore heft files
    for (const [rel, content] of Object.entries(snap.deletedHeftFiles)) {
      const abs = path.join(projectRoot, configDir, rel);
      ensureDir(path.dirname(abs));
      fs.writeFileSync(abs, content);
    }
    // Restore scss
    for (const [rel, content] of Object.entries(snap.scssFixes)) {
      const abs = path.join(projectRoot, rel);
      ensureDir(path.dirname(abs));
      fs.writeFileSync(abs, content);
    }
    // Remove bundler config if it was newly created (content was null)
    const bFile = bundlerConfigFile(snap.bundler);
    const relBundler = bFile;
    if (snap.files[relBundler] === null && fs.existsSync(path.join(projectRoot, bFile))) {
      fs.rmSync(path.join(projectRoot, bFile), { force: true });
    }
    // Also remove alternative bundler configs if they were created outside snapshot? Not needed.
    fs.rmSync(backupPath, { force: true });
    // Try to remove .rspfx dir if empty
    try {
      if (fs.existsSync(path.join(projectRoot, BACKUP_DIR)) && fs.readdirSync(path.join(projectRoot, BACKUP_DIR)).length === 0) {
        fs.rmdirSync(path.join(projectRoot, BACKUP_DIR));
      }
    } catch {
      // ignore
    }
    logger.success(`Reverted migration — restored backup from ${path.relative(projectRoot, backupPath)}`);
    return { migrated: false, reverted: true, dryRun: false, backupPath };
  }

  // Validate project
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new RspfxError('MIGRATE_NO_PACKAGE_JSON', `No package.json at ${projectRoot}`);
  }

  if (from === 'heft' || from === 'gulp') {
    const detected = detectFrom(projectRoot);
    if (detected && detected !== from) {
      logger.warn(`--from ${from} specified but detected ${detected} marker`);
    }
  } else if (from === 'auto') {
    const detected = detectFrom(projectRoot);
    if (!detected && !fs.existsSync(path.join(projectRoot, configDir, 'config.json'))) {
      logger.warn('Could not detect heft/gulp toolchain — proceeding anyway');
    } else if (detected) {
      logger.info(`Detected ${detected} project`);
    }
  }

  // Check if already migrated (rspack/vite/rsbuild config exists)
  const existingBundlerFile = bundlerConfigFile(bundler);
  const existingConfigExists = fs.existsSync(path.join(projectRoot, existingBundlerFile));
  if (existingConfigExists && !opts.force && !opts.dryRun) {
    const ok = opts.yes ? true : await promptConfirm(`${existingBundlerFile} already exists. Overwrite?`, false);
    if (!ok) {
      throw new RspfxError('MIGRATE_ABORTED', `Migration aborted — ${existingBundlerFile} exists (use --force to overwrite)`);
    }
  }

  // Gather plan data without mutating yet
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: Record<string, string>;
  };
  const projectName = (pkg.name ?? 'my-app').replace(/^@[^/]+\//, '');
  const framework = (pkg.dependencies?.react ?? pkg.devDependencies?.react) ? 'react' : 'vanilla';

  // styling detection
  let styling = 'css';
  try {
    const srcDir = path.join(projectRoot, 'src');
    const hasScss =
      fs.existsSync(path.join(srcDir, 'webparts')) &&
      fs.readdirSync(path.join(srcDir, 'webparts'), { recursive: true } as unknown as { recursive: boolean }).some((f) => String(f).endsWith('.scss'));
    if (hasScss || pkg.dependencies?.sass) styling = 'scss';
    else if (pkg.devDependencies?.sass) styling = 'scss';
  } catch {
    // ignore
  }

  const spfxVersion: SpfxTarget = (opts.spfxVersion as SpfxTarget) ?? SPFX_DEFAULT_TARGET;

  const plan: string[] = [];

  // package.json changes
  const devDeps = pkg.devDependencies ?? {};
  const removed = Object.keys(devDeps).filter((name) => TOOLCHAIN_DEPS.includes(name));
  if (removed.length > 0) plan.push(`remove ${removed.length} toolchain devDependencies: ${removed.join(', ')}`);
  else plan.push('no known Heft/gulp toolchain devDependencies to remove');
  plan.push('add @mbsks/rspfx-plugin devDependency');
  plan.push(`add rspfx scripts: ${Object.keys(RSPFX_SCRIPTS).join(', ')}`);
  if (pkg.engines?.node) plan.push(`relax engines.node to >=20.0.0`);

  // config/config.json
  const configJsonPath = path.join(projectRoot, configDir, 'config.json');
  const configJsonExists = fs.existsSync(configJsonPath);
  if (configJsonExists) {
    plan.push('rewrite config/config.json entrypoints from ./lib/ to ./src/ and rename bundles');
  } else {
    plan.push('config/config.json not found — will be auto-created on next build');
  }

  // SCSS
  const srcDirPath = path.join(projectRoot, 'src');
  let scssCount = 0;
  if (fs.existsSync(srcDirPath)) {
    const walk = (dir: string): void => {
      for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, dirent.name);
        if (dirent.isDirectory()) walk(full);
        else if (dirent.name.endsWith('.scss')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('pkg:')) scssCount++;
        }
      }
    };
    try {
      walk(srcDirPath);
    } catch {
      // ignore
    }
  }
  if (scssCount > 0) plan.push(`rewrite ${scssCount} scss pkg: imports`);
  else plan.push('no scss pkg: imports found');

  // Heft files
  const configDirAbs = path.join(projectRoot, configDir);
  const heftFilesToDelete: string[] = [];
  if (fs.existsSync(configDirAbs)) {
    for (const file of HEFT_ONLY_CONFIG_FILES) {
      if (fs.existsSync(path.join(configDirAbs, file))) heftFilesToDelete.push(file);
    }
  }
  if (heftFilesToDelete.length > 0) plan.push(`delete Heft-only files: ${heftFilesToDelete.join(', ')}`);
  else plan.push('no Heft-only config files to delete');

  // bundler config
  if (!existingConfigExists) plan.push(`write ${existingBundlerFile} with ${bundler} plugin (framework: ${framework}, styling: ${styling}, spfx: ${spfxVersion})`);
  else plan.push(`overwrite ${existingBundlerFile} (force)`);

  // tsconfig
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  let tsconfigWillReplace = false;
  if (fs.existsSync(tsconfigPath)) {
    try {
      const raw = fs.readFileSync(tsconfigPath, 'utf8');
      const jsonc = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
      const tsconfig = JSON.parse(jsonc) as { extends?: string };
      if (typeof tsconfig.extends === 'string' && tsconfig.extends.includes('rig')) tsconfigWillReplace = true;
    } catch {
      // ignore
    }
  }
  if (tsconfigWillReplace) plan.push('replace rig-based tsconfig.json with plain config');
  else plan.push('leave tsconfig.json as-is');

  if (opts.dryRun) {
    logger.info('[dry-run] Migration plan:');
    for (const line of plan) logger.info(`  • ${line}`);
    logger.info('[dry-run] No files were modified. Run without --dry-run to apply.');
    return { migrated: false, reverted: false, dryRun: true, backupPath };
  }

  // Confirm unless --yes or --force
  if (!opts.yes && !opts.force) {
    const ok = await promptConfirm('Proceed with migration? This will modify package.json, config files, and scss.', true);
    if (!ok) {
      throw new RspfxError('MIGRATE_ABORTED', 'Migration aborted by user');
    }
  }

  // Build backup snapshot
  const snapshot: BackupSnapshot = {
    timestamp: new Date().toISOString(),
    bundler,
    files: {},
    deletedHeftFiles: {},
    scssFixes: {}
  };
  // files to backup
  const filesToSnapshot = [
    'package.json',
    path.join(configDir, 'config.json'),
    'tsconfig.json',
    existingBundlerFile
  ];
  for (const rel of filesToSnapshot) {
    const abs = path.join(projectRoot, rel);
    snapshot.files[rel] = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  }

  // Heft files content
  for (const file of heftFilesToDelete) {
    const abs = path.join(configDirAbs, file);
    snapshot.deletedHeftFiles[file] = fs.readFileSync(abs, 'utf8');
  }

  // SCSS fixes snapshot
  const scssOriginals: Record<string, string> = {};
  if (fs.existsSync(srcDirPath)) {
    const walk = (dir: string): void => {
      for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, dirent.name);
        if (dirent.isDirectory()) walk(full);
        else if (dirent.name.endsWith('.scss')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('pkg:')) {
            const rel = path.relative(projectRoot, full);
            scssOriginals[rel] = content;
          }
        }
      }
    };
    walk(srcDirPath);
  }
  snapshot.scssFixes = scssOriginals;

  // Ensure backup dir
  ensureDir(path.join(projectRoot, BACKUP_DIR));
  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2));

  // 1. package.json
  const newPkg = JSON.parse(JSON.stringify(pkg)) as typeof pkg;
  newPkg.devDependencies = newPkg.devDependencies ?? {};
  for (const name of removed) delete (newPkg.devDependencies as Record<string, string>)[name];
  (newPkg.devDependencies as Record<string, string>)['@mbsks/rspfx-plugin'] = '^0.0.1';
  newPkg.devDependencies = (newPkg.devDependencies as Record<string, string>);
  if (newPkg.scripts?.start && newPkg.scripts.start.includes('heft')) {
    delete newPkg.scripts.start;
  }
  if (newPkg.scripts?.['eject-webpack']) {
    delete newPkg.scripts['eject-webpack'];
  }
  newPkg.scripts = { ...(newPkg.scripts ?? {}), ...RSPFX_SCRIPTS };
  if (newPkg.engines?.node) {
    newPkg.engines.node = '>=20.0.0';
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(newPkg, null, 4) + '\n');
  logger.info(`✓ package.json: removed ${removed.length} toolchain deps, added rspfx scripts`);

  // 2. config/config.json
  if (fs.existsSync(configJsonPath)) {
    const cfg = JSON.parse(fs.readFileSync(configJsonPath, 'utf8')) as {
      bundles?: Record<string, { components: { entrypoint: string; manifest: string }[] }>;
    };
    if (cfg.bundles) {
      for (const [bundleName, entry] of Object.entries(cfg.bundles)) {
        for (const component of entry.components ?? []) {
          if (typeof component.entrypoint === 'string') {
            let entrypoint = component.entrypoint;
            if (entrypoint.startsWith('./lib/')) {
              const src = './src/' + entrypoint.slice('./lib/'.length);
              const base = src.replace(/\.(js|ts|tsx)$/, '');
              entrypoint =
                fs.existsSync(path.join(projectRoot, base + '.ts'))
                  ? base + '.ts'
                  : fs.existsSync(path.join(projectRoot, base + '.tsx'))
                    ? base + '.tsx'
                    : base + '.js';
              component.entrypoint = entrypoint;
            } else if (entrypoint.startsWith('lib/')) {
              const src = 'src/' + entrypoint.slice('lib/'.length);
              const base = src.replace(/\.(js|ts|tsx)$/, '');
              const candidate = fs.existsSync(path.join(projectRoot, base + '.ts'))
                ? base + '.ts'
                : fs.existsSync(path.join(projectRoot, base + '.tsx'))
                  ? base + '.tsx'
                  : base + '.js';
              component.entrypoint = './' + candidate;
            }
          }
          if (typeof component.manifest === 'string' && component.manifest.startsWith('./lib/')) {
            component.manifest = './src/' + component.manifest.slice('./lib/'.length).replace(/\.js$/, '.json');
          } else if (typeof component.manifest === 'string' && component.manifest.startsWith('lib/')) {
            component.manifest = './src/' + component.manifest.slice('lib/'.length).replace(/\.js$/, '.json');
            if (!component.manifest.startsWith('./')) component.manifest = './' + component.manifest;
          }
        }
        const manifestPath = (entry.components?.[0] as { manifest?: string } | undefined)?.manifest ?? '';
        const match = manifestPath.match(/src\/(?:webparts|extensions|libraries)\/([^/]+)\//);
        if (match?.[1] && match[1] !== bundleName) {
          (cfg.bundles as Record<string, unknown>)[match[1]] = cfg.bundles[bundleName];
          delete cfg.bundles[bundleName];
          logger.info(`✓ config.json: renamed bundle "${bundleName}" → "${match[1]}"`);
        }
      }
    }
    fs.writeFileSync(configJsonPath, JSON.stringify(cfg, null, 4) + '\n');
    logger.info('✓ config.json: entrypoints rewritten');
  }

  // 3. SCSS pkg: rewrites
  let pkgImportsFixed = 0;
  for (const [rel, original] of Object.entries(scssOriginals)) {
    const full = path.join(projectRoot, rel);
    let content = original;
    content = content.replace(PKG_IMPORT_RE, (match, pkgName: string, pkgPath: string) => {
      const relPath = path
        .relative(path.dirname(full), path.join(projectRoot, 'node_modules', pkgName, pkgPath))
        .replace(/\\/g, '/');
      const specifier = relPath.startsWith('.') ? relPath : './' + relPath;
      return `@import '${specifier}'`;
    });
    if (content !== original) {
      fs.writeFileSync(full, content);
      pkgImportsFixed++;
    }
  }
  if (pkgImportsFixed > 0) logger.info(`✓ rewrote ${pkgImportsFixed} scss pkg: imports`);
  else logger.info('– no scss pkg: imports found');

  // 4. delete Heft-only files
  if (heftFilesToDelete.length > 0) {
    for (const file of heftFilesToDelete) {
      fs.unlinkSync(path.join(configDirAbs, file));
    }
    logger.info(`✓ removed Heft-only files: ${heftFilesToDelete.join(', ')}`);
  }

  // 5. bundler config + tsconfig
  const bundlerContent = buildBundlerConfigContent(bundler, projectName, framework, spfxVersion, styling);
  const bundlerPath = path.join(projectRoot, existingBundlerFile);
  if (!fs.existsSync(bundlerPath) || opts.force) {
    fs.writeFileSync(bundlerPath, bundlerContent);
    logger.info(`✓ wrote ${existingBundlerFile} with ${bundler} plugin (framework: ${framework}, styling: ${styling})`);
  } else if (existingConfigExists) {
    // Should not happen because we prompted, but if user said yes, overwrite
    fs.writeFileSync(bundlerPath, bundlerContent);
    logger.info(`✓ overwrote ${existingBundlerFile}`);
  }

  if (tsconfigWillReplace) {
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'es2020',
            module: 'esnext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            lib: ['dom', 'es2021'],
            strict: false,
            skipLibCheck: true,
            types: []
          },
          include: ['src']
        },
        null,
        2
      ) + '\n'
    );
    logger.info('✓ replaced rig-based tsconfig.json');
  }

  logger.success('Migration complete. Next steps: pnpm install, rspfx dev, rspfx package');
  logger.info(`Backup saved to ${path.relative(projectRoot, backupPath)} — run rspfx migrate --revert to restore`);

  return { migrated: true, reverted: false, dryRun: false, backupPath };
}
