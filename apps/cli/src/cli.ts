#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { program } from 'commander';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import { version } from './version.js';
import { runNew, type NewOptions } from './commands/new.js';
import { runDev } from './commands/dev.js';
import { runPlayground } from './commands/playground.js';
import { runBuild, type BuildOptions } from './commands/build.js';
import { runPackage } from './commands/package.js';
import { runDeploy } from './commands/deploy.js';
import { runAnalyze } from './commands/analyze.js';
import { runDoctor } from './commands/doctor.js';
import { runClean } from './commands/clean.js';

const logger = createLogger('rspfx');
const cwd = process.cwd();

async function guard(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
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
    .description('SPFx-compatible build toolchain powered by Rspack')
    .version(version, '-v, --version')
    .showHelpAfterError();

  program
    .command('new')
    .description('scaffold a new SPFx web part project')
    .argument('<name>', 'project name')
    .option('--framework <id>', 'framework (vanilla|react|solid|preact|vue|svelte)')
    .option('--language <ts|js>', 'language')
    .option('--styling <css|scss|tailwind>', 'styling')
    .option('--fluent', 'enable Fluent UI')
    .option('--spfx-version <1.20|1.21|1.22>', 'SPFx target version')
    .option('--pm <pnpm|npm|yarn>', 'package manager')
    .option('--no-install', 'skip dependency installation')
    .option('--tenant <url>', 'tenant URL for the dev workbench')
    .option('--yes', 'skip all prompts and use defaults')
    .action((name: string, options: Record<string, unknown>) => {
      const opts: NewOptions = {
        name,
        cwd,
        framework: options.framework as string | undefined,
        language: options.language as string | undefined,
        styling: options.styling as string | undefined,
        fluent: options.fluent as boolean | undefined,
        spfxVersion: options.spfxVersion as string | undefined,
        pm: options.pm as string | undefined,
        install: options.install as boolean | undefined,
        tenant: options.tenant as string | undefined,
        yes: options.yes as boolean | undefined
      };
      return guard(() => runNew(opts));
    });

  program
    .command('dev')
    .description('start the dev server and open the SharePoint workbench')
    .option('--refresh', 'enable fast refresh')
    .option('--no-browser', 'do not open the workbench in a browser')
    .option('--port <n>', 'dev server port')
    .option('--tenant <url>', 'tenant URL or domain (e.g. https://contoso.sharepoint.com)')
    .action((options: Record<string, unknown>) => {
      return guard(() =>
        runDev(cwd, {
          refresh: options.refresh as boolean | undefined,
          browser: options.browser as boolean | undefined,
          port: toPort(options.port),
          tenant: options.tenant as string | undefined
        })
      );
    });

  program
    .command('playground')
    .description('start the standalone playground dev server')
    .option('--port <n>', 'playground server port')
    .action((options: Record<string, unknown>) => {
      return guard(() => runPlayground(cwd, { port: toPort(options.port) }));
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
        logger.success('Build complete');
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
    .action(() => {
      return guard(async () => {
        const result = await runDoctor(cwd);
        process.exitCode = result.ok ? 0 : 1;
      });
    });

  program
    .command('clean')
    .description('remove build output (dist, release, temp, .rspfx, caches, solution package)')
    .action(() => {
      return guard(() => runClean(cwd));
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
