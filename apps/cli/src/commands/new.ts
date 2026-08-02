import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scaffoldProject, type TemplateVars } from '@mbsks/rspfx-templates';
import type { FrameworkId, SpfxTarget } from '@mbsks/rspfx-core';
import { SPFX_DEFAULT_TARGET, SPFX_TARGETS, isSpfxTarget } from '@mbsks/rspfx-core';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import {
  DEFAULT_FRAMEWORK,
  DEFAULT_STYLING,
  FRAMEWORK_CHOICES,
  STYLING_CHOICES,
  promptChoice,
  promptConfirm
} from '../prompts.js';

const logger = createLogger('rspfx');

const LANGUAGES = ['ts', 'js'] as const;
const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'] as const;

export interface NewOptions {
  name: string;
  cwd?: string;
  framework?: string;
  language?: string;
  styling?: string;
  fluent?: boolean;
  spfxVersion?: string;
  pm?: string;
  install?: boolean;
  tenant?: string;
  yes?: boolean;
}

export async function runNew(opts: NewOptions): Promise<string> {
  const cwd = opts.cwd ?? process.cwd();
  const skipPrompts = opts.yes === true;

  let framework = (opts.framework as FrameworkId) ?? DEFAULT_FRAMEWORK;
  let language = opts.language ?? 'ts';
  let styling = (opts.styling as string) ?? DEFAULT_STYLING;
  let fluent = opts.fluent ?? false;
  let spfxVersion = (opts.spfxVersion as SpfxTarget) ?? SPFX_DEFAULT_TARGET;
  let pm = opts.pm ?? 'pnpm';

  if (!skipPrompts) {
    if (opts.framework === undefined) {
      framework = (await promptChoice('Framework', FRAMEWORK_CHOICES, framework)) as FrameworkId;
    }
    if (opts.language === undefined) {
      language = await promptChoice('Language', LANGUAGES, language);
    }
    if (opts.styling === undefined) {
      styling = await promptChoice('Styling', STYLING_CHOICES, styling);
    }
    if (opts.fluent === undefined) {
      fluent = await promptConfirm('Enable Fluent UI?', false);
    }
    if (opts.spfxVersion === undefined) {
      spfxVersion = (await promptChoice('SPFx version', SPFX_TARGETS, spfxVersion)) as SpfxTarget;
    }
    if (opts.pm === undefined) {
      pm = await promptChoice('Package manager', PACKAGE_MANAGERS, pm);
    }
  }

  if (!FRAMEWORK_CHOICES.includes(framework as FrameworkId)) {
    throw new RspfxError('INVALID_OPTION', `Unknown framework '${framework}'. Expected one of: ${FRAMEWORK_CHOICES.join(', ')}`);
  }
  if (!(LANGUAGES as readonly string[]).includes(language)) {
    throw new RspfxError('INVALID_OPTION', `Unknown language '${language}'. Expected one of: ${LANGUAGES.join(', ')}`);
  }
  if (!(STYLING_CHOICES as readonly string[]).includes(styling)) {
    throw new RspfxError('INVALID_OPTION', `Unknown styling '${styling}'. Expected one of: ${STYLING_CHOICES.join(', ')}`);
  }
  if (!isSpfxTarget(spfxVersion)) {
    throw new RspfxError('INVALID_OPTION', `Unknown spfx version '${spfxVersion}'. Expected one of: ${SPFX_TARGETS.join(', ')}`);
  }
  if (!(PACKAGE_MANAGERS as readonly string[]).includes(pm)) {
    throw new RspfxError('INVALID_OPTION', `Unknown package manager '${pm}'. Expected one of: ${PACKAGE_MANAGERS.join(', ')}`);
  }

  const destDir = path.join(cwd, opts.name);
  if (fs.existsSync(destDir) && fs.readdirSync(destDir).length > 0) {
    throw new RspfxError(
      'DEST_EXISTS',
      `Target directory already exists and is not empty: ${destDir}`
    );
  }
  const namePascal = toPascalCase(opts.name);
  const vars: TemplateVars = {
    name: opts.name,
    namePascal,
    nameCamel: toCamelCase(namePascal),
    framework: framework as FrameworkId,
    spfxVersion: spfxVersion as SpfxTarget,
    fluent,
    language: language === 'js' ? 'javascript' : 'typescript',
    styling: styling as TemplateVars['styling'],
    ...(opts.tenant !== undefined ? { tenantUrl: opts.tenant } : {}),
    componentId: randomUUID(),
    solutionId: randomUUID(),
    featureId: randomUUID(),
    packageName: opts.name,
    packageVersion: '1.0.0'
  };

  const files = await scaffoldProject(vars, destDir);
  logger.success(`Scaffolded ${files.length} files into ${destDir}`);

  if (opts.install !== false) {
    await installWith(pm, destDir);
  }

  logger.info('Next steps:');
  logger.info(`  cd ${opts.name}`);
  logger.info('  rspfx dev');
  return destDir;
}

function toPascalCase(name: string): string {
  return name
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('');
}

function toCamelCase(namePascal: string): string {
  return `${namePascal.charAt(0).toLowerCase()}${namePascal.slice(1)}`;
}

async function installWith(pm: string, cwd: string): Promise<void> {
  logger.info(`Installing dependencies with ${pm}...`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pm, ['install'], { cwd, stdio: 'inherit' });
    child.once('error', (error) => reject(error));
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new RspfxError('INSTALL_FAILED', `${pm} install exited with code ${code}`));
      }
    });
  });
}
