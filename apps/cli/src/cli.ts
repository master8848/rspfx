#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { program } from 'commander';
import { AggregateRspfxError, createDiagnosticFormatter, createLogger, isAggregateRspfxError, isRspfxError, RspfxError, RspfxErrorCode } from '@mbsks/rspfx-diagnostics';
import { SPFX_TARGETS } from '@mbsks/rspfx-core';
import { version } from './version.js';
import { runNew, type NewOptions } from './commands/new.js';
import { runDev } from './commands/dev.js';
import { runBuild, type BuildOptions } from './commands/build.js';
import { runPackage } from './commands/package.js';
import { runDeploy } from './commands/deploy.js';
import { runAnalyze } from './commands/analyze.js';
import { runDoctor } from './commands/doctor.js';
import { runClean } from './commands/clean.js';
import { runMigrate } from './commands/migrate.js';

function getLogger() {
  const json = process.env.RSPFX_LOG_JSON === '1';
  return json ? createLogger('rspfx', { json: true }) : createLogger('rspfx');
}

const cwd = process.cwd();

async function guard(action: () => Promise<unknown>): Promise<void> {
  const logger = getLogger();
  const fmt = createDiagnosticFormatter(logger);
  try {
    await action();
  } catch (error) {
    if (isAggregateRspfxError(error)) {
      logger.error(fmt(error));
      // Also log each sub-error for exhaustive handling?
      for (const sub of error.errors) {
        // exhaustive per sub code could be handled, but we just ensure switch is exhaustive via type
        switch (sub.code) {
          case RspfxErrorCode.AGGREGATE:
          case RspfxErrorCode.ANALYZE_NO_DIST:
          case RspfxErrorCode.BUILD_FAILED:
          case RspfxErrorCode.CLEAN_NOT_A_PROJECT:
          case RspfxErrorCode.COMPILE_ENTRY_NO_COMPONENT_ID:
          case RspfxErrorCode.COMPILE_ENTRY_NO_VERSION:
          case RspfxErrorCode.COMPILE_FAILED:
          case RspfxErrorCode.COMPILE_NO_ENTRIES:
          case RspfxErrorCode.CONFIG_NOT_FOUND:
          case RspfxErrorCode.DEPLOY_FAILED:
          case RspfxErrorCode.DEPLOY_INVALID_URL:
          case RspfxErrorCode.DEPLOY_TIMEOUT:
          case RspfxErrorCode.DEST_EXISTS:
          case RspfxErrorCode.DEV_COMPILE_TIMEOUT:
          case RspfxErrorCode.DUPLICATE_MANIFEST_ID:
          case RspfxErrorCode.HOOK_FAILED:
          case RspfxErrorCode.INSTALL_FAILED:
          case RspfxErrorCode.INVALID_MANIFEST_ID:
          case RspfxErrorCode.INVALID_MANIFEST_JSON:
          case RspfxErrorCode.INVALID_OPTION:
          case RspfxErrorCode.INVALID_PACKAGE_CONFIG:
          case RspfxErrorCode.MISSING_ELEMENT_ASSET:
          case RspfxErrorCode.MULTIPLE_MANIFESTS:
          case RspfxErrorCode.NO_MANIFESTS_FOUND:
          case RspfxErrorCode.PACKAGE_VALIDATION:
          case RspfxErrorCode.PLUGIN_NOT_FOUND:
          case RspfxErrorCode.CONFIG_VALIDATION_FAILED:
          case RspfxErrorCode.MIGRATE_BACKUP_EXISTS:
          case RspfxErrorCode.RSBUILD_BUILD_FAILED:
          case RspfxErrorCode.RSBUILD_NOT_FOUND:
          case RspfxErrorCode.SPPKG_TRAVERSAL:
          case RspfxErrorCode.UNRESOLVED_EXTERNAL:
          case RspfxErrorCode.VITE_BUILD_FAILED:
          case RspfxErrorCode.VITE_NOT_FOUND:
          case RspfxErrorCode.VITE_NO_ENTRY:
            break;
          default: {
            const _exhaustive: never = sub.code as never;
            void _exhaustive;
          }
        }
      }
    } else if (isRspfxError(error) && error instanceof RspfxError) {
      logger.error(fmt(error as RspfxError));
      switch ((error as RspfxError).code) {
        case RspfxErrorCode.AGGREGATE:
        case RspfxErrorCode.ANALYZE_NO_DIST:
        case RspfxErrorCode.BUILD_FAILED:
        case RspfxErrorCode.CLEAN_NOT_A_PROJECT:
        case RspfxErrorCode.COMPILE_ENTRY_NO_COMPONENT_ID:
        case RspfxErrorCode.COMPILE_ENTRY_NO_VERSION:
        case RspfxErrorCode.COMPILE_FAILED:
        case RspfxErrorCode.COMPILE_NO_ENTRIES:
        case RspfxErrorCode.CONFIG_NOT_FOUND:
        case RspfxErrorCode.CONFIG_VALIDATION_FAILED:
        case RspfxErrorCode.MIGRATE_BACKUP_EXISTS:
        case RspfxErrorCode.DEPLOY_FAILED:
        case RspfxErrorCode.DEPLOY_INVALID_URL:
        case RspfxErrorCode.DEPLOY_TIMEOUT:
        case RspfxErrorCode.DEST_EXISTS:
        case RspfxErrorCode.DEV_COMPILE_TIMEOUT:
        case RspfxErrorCode.DUPLICATE_MANIFEST_ID:
        case RspfxErrorCode.HOOK_FAILED:
        case RspfxErrorCode.INSTALL_FAILED:
        case RspfxErrorCode.INVALID_MANIFEST_ID:
        case RspfxErrorCode.INVALID_MANIFEST_JSON:
        case RspfxErrorCode.INVALID_OPTION:
        case RspfxErrorCode.INVALID_PACKAGE_CONFIG:
        case RspfxErrorCode.MISSING_ELEMENT_ASSET:
        case RspfxErrorCode.MULTIPLE_MANIFESTS:
        case RspfxErrorCode.NO_MANIFESTS_FOUND:
        case RspfxErrorCode.PACKAGE_VALIDATION:
        case RspfxErrorCode.PLUGIN_NOT_FOUND:
        case RspfxErrorCode.RSBUILD_BUILD_FAILED:
        case RspfxErrorCode.RSBUILD_NOT_FOUND:
        case RspfxErrorCode.SPPKG_TRAVERSAL:
        case RspfxErrorCode.UNRESOLVED_EXTERNAL:
        case RspfxErrorCode.VITE_BUILD_FAILED:
        case RspfxErrorCode.VITE_NOT_FOUND:
        case RspfxErrorCode.VITE_NO_ENTRY:
          break;
        default: {
          const _exhaustive: never = (error as RspfxError).code as never;
          void _exhaustive;
        }
      }
    } else if (error instanceof AggregateRspfxError) {
      logger.error(fmt(error));
    } else if (error instanceof Error && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
      const code = (error as { code: string }).code;
      logger.error(`[${code}] ${error.message}`);
      if (process.env.RSPFX_LOG_LEVEL === 'debug' && error.cause !== undefined) {
        const causeMsg = error.cause instanceof Error ? error.cause.stack ?? error.cause.message : String(error.cause);
        logger.error(`cause: ${causeMsg}`);
      }
    } else {
      logger.error(error instanceof Error ? error.message : String(error));
      if (process.env.RSPFX_LOG_LEVEL === 'debug' && error instanceof Error && error.cause !== undefined) {
        const causeMsg = error.cause instanceof Error ? error.cause.stack ?? error.cause.message : String(error.cause);
        logger.error(`cause: ${causeMsg}`);
      }
    }
    process.exitCode = 1;
  }
}

function toPort(value: unknown): number | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function configureProgram(): void {
  program
    .name('rspfx')
    .description('SPFx-compatible build toolchain. Works with Vite, Rsbuild, and Rspack')
    .version(version, '-v, --version')
    .showHelpAfterError();

  program
    .command('new')
    .description('scaffold a new SPFx project (web part, extension, or library)')
    .argument('<name>', 'project name')
    .option('--component <webpart|applicationcustomizer|fieldcustomizer|listviewcommandset|formcustomizer|library>', 'component type (default: webpart); extensions/libraries scaffold as vanilla TypeScript and reject --framework/--language')
    .option('--framework <id>', 'framework (vanilla|react|solid|preact|vue|svelte)')
    .option('--language <ts|js>', 'language')
    .option(`--spfx-version <${SPFX_TARGETS.join('|')}>`, 'SPFx target version')
    .option('--pm <pnpm|npm|yarn|bun>', 'package manager (pnpm, npm, yarn, bun)')
    .option('--bundler <vite|rsbuild|rspack>', 'bundler (default: vite)')
    .option('--no-install', 'skip dependency installation (default: no auto-install; kept for compatibility)')
    .option('--tenant <url>', 'tenant URL for the dev workbench')
    .option('--yes', 'skip all prompts and use defaults')
    .action((name: string, options: Record<string, unknown>) => {
      const opts: NewOptions = {
        name,
        cwd,
        component: options.component as string | undefined,
        framework: options.framework as string | undefined,
        language: options.language as string | undefined,
        spfxVersion: options.spfxVersion as string | undefined,
        pm: options.pm as string | undefined,
        bundler: options.bundler as string | undefined,
        install: options.install as boolean | undefined,
        tenant: options.tenant as string | undefined,
        yes: options.yes as boolean | undefined
      };
      return guard(() => runNew(opts));
    });

  program
    .command('dev')
    .description('start the dev server — local preview at / or workbench with --tenant')
    .option('--refresh', 'enable fast refresh')
    .option('--browser', 'open the local preview or workbench in a browser')
    .option('--port <n>', 'dev server port')
    .option('--mode <local|sharepoint>', 'serve mode (default: local, or sharepoint when a tenant is configured)')
    .option('--tenant <url>', 'tenant URL or domain (e.g. https://contoso.sharepoint.com)')
    .action((options: Record<string, unknown>) => {
      return guard(() =>
        runDev(cwd, {
          refresh: options.refresh as boolean | undefined,
          browser: options.browser as boolean | undefined,
          port: toPort(options.port),
          mode: options.mode as 'local' | 'sharepoint' | undefined,
          tenant: options.tenant as string | undefined
        })
      );
    });

  program
    .command('build')
    .description('production build to dist/ and release/')
    .option('--no-minify', 'disable minification')
    .option('--sourcemap', 'emit hidden source maps')
    .action((options: Record<string, unknown>) => {
      const opts: BuildOptions = {
        minify: options.minify as boolean | undefined,
        sourcemap: options.sourcemap as boolean | undefined
      };
      return guard(async () => {
        await runBuild(cwd, opts);
        getLogger().success('Build complete');
      });
    });

  program
    .command('package')
    .description('build and package the solution into a .sppkg file')
    .option('--no-build', 'reuse the existing release/ output')
    .action((options: Record<string, unknown>) => {
      return guard(() => runPackage(cwd, { build: options.build as boolean | undefined }));
    });

  program
    .command('deploy')
    .description('package and upload the solution to the SharePoint app catalog')
    .action(() => {
      return guard(() => runDeploy(cwd, {}));
    });

  program
    .command('analyze')
    .description('build and write a bundle analysis report to .rspfx/analyze.html')
    .option('--no-build', 'analyze the existing dist/ output')
    .action((options: Record<string, unknown>) => {
      return guard(() => runAnalyze(cwd, { build: options.build as boolean | undefined }));
    });

  program
    .command('doctor')
    .description('run environment and project checks')
    .option('--fix', 'fix issues when possible')
    .action((options: Record<string, unknown>) => {
      return guard(async () => {
        const result = await runDoctor(cwd, { fix: options.fix as boolean | undefined });
        process.exitCode = result.ok ? 0 : 1;
      });
    });

  program
    .command('clean')
    .description('remove build output (dist, release, temp, .rspfx, caches, solution package)')
    .action(() => {
      return guard(() => runClean(cwd));
    });

  program
    .command('migrate')
    .description('migrate an existing SPFx project (gulp/heft) to rspfx')
    .option('--to <version>', 'target version (default: 0.1)')
    .option('--from <auto|heft|gulp>', 'source toolchain (default: auto)')
    .option('--bundler <vite|rsbuild|rspack>', 'bundler to scaffold (default: vite)')
    .option('--spfx-version <version>', 'SPFx target version')
    .option('--dry-run', 'print plan without touching files')
    .option('--revert', 'restore backup from .rspfx/migrate-backup.json')
    .option('--force', 'overwrite existing bundler config without prompt')
    .option('--yes', 'skip confirmation prompts')
    .action((options: Record<string, unknown>) => {
      return guard(() =>
        runMigrate(cwd, {
          to: options.to as string | undefined,
          from: options.from as 'auto' | 'heft' | 'gulp' | undefined,
          bundler: options.bundler as 'vite' | 'rsbuild' | 'rspack' | undefined,
          spfxVersion: options.spfxVersion as string | undefined,
          dryRun: options.dryRun as boolean | undefined,
          revert: options.revert as boolean | undefined,
          force: options.force as boolean | undefined,
          yes: options.yes as boolean | undefined
        })
      );
    });
}

async function main(): Promise<void> {
  configureProgram();
  await program.parseAsync(process.argv);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(fs.realpathSync(entry)).href) {
  void main();
}
