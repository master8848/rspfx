import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scaffoldProject, type ComponentType, type TemplateVars } from '@mbsks/rspfx-templates';
import type { FrameworkId, SpfxTarget } from '@mbsks/rspfx-core';
import { SPFX_DEFAULT_TARGET, SPFX_TARGETS, isSpfxTarget } from '@mbsks/rspfx-core';
import { createLogger, RspfxError } from '@mbsks/rspfx-diagnostics';
import {
  BUNDLER_CHOICES,
  COMPONENT_CHOICES,
  DEFAULT_BUNDLER,
  DEFAULT_COMPONENT,
  DEFAULT_FRAMEWORK,
  FRAMEWORK_CHOICES,
  promptChoice
} from '../prompts.js';

const logger = createLogger('rspfx');

const LANGUAGES = ['ts', 'js'] as const;
const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'] as const;

export interface NewOptions {
  name: string;
  cwd?: string;
  component?: string;
  framework?: string;
  language?: string;
  spfxVersion?: string;
  pm?: string;
  bundler?: string;
  install?: boolean;
  tenant?: string;
  yes?: boolean;
}

export async function runNew(opts: NewOptions): Promise<string> {
  const cwd = opts.cwd ?? process.cwd();
  if (opts.name.includes('/') || opts.name.includes('\\') || opts.name.includes('..')) {
    throw new RspfxError('INVALID_OPTION', `Invalid project name '${opts.name}': must not contain path traversal characters (/, \\, ..)`);
  }
  if (!/^[a-z0-9._-]+$/i.test(opts.name)) {
    throw new RspfxError('INVALID_OPTION', `Invalid project name '${opts.name}': must match /^[a-z0-9._-]+$/i (alphanumeric, dot, underscore, hyphen)`);
  }
  const skipPrompts = opts.yes === true;

  let component = (opts.component as ComponentType) ?? DEFAULT_COMPONENT;
  let framework = (opts.framework as FrameworkId) ?? DEFAULT_FRAMEWORK;
  let language = opts.language ?? 'ts';
  let spfxVersion = (opts.spfxVersion as SpfxTarget) ?? SPFX_DEFAULT_TARGET;
  let pm = opts.pm ?? 'pnpm';
  let bundler = (opts.bundler as (typeof BUNDLER_CHOICES)[number]) ?? DEFAULT_BUNDLER;

  if (!skipPrompts) {
    if (opts.component === undefined) {
      component = (await promptChoice('Component type', COMPONENT_CHOICES, component)) as ComponentType;
    }
    const isExtension = component !== 'webpart';
    if (!isExtension) {
      if (opts.framework === undefined) {
        framework = (await promptChoice('Framework', FRAMEWORK_CHOICES, framework)) as FrameworkId;
      }
      if (opts.language === undefined) {
        language = await promptChoice('Language', LANGUAGES, language);
      }
    }
    if (opts.bundler === undefined) {
      bundler = (await promptChoice('Bundler', BUNDLER_CHOICES, bundler)) as (typeof BUNDLER_CHOICES)[number];
    }
    if (opts.spfxVersion === undefined) {
      spfxVersion = (await promptChoice('SPFx version', SPFX_TARGETS, spfxVersion)) as SpfxTarget;
    }
    if (opts.pm === undefined) {
      pm = await promptChoice('Package manager', PACKAGE_MANAGERS, pm);
    }
  }

  if (!(COMPONENT_CHOICES as readonly string[]).includes(component)) {
    throw new RspfxError('INVALID_OPTION', `Unknown component '${component}'. Expected one of: ${COMPONENT_CHOICES.join(', ')}`);
  }
  if (component !== 'webpart') {
    if (opts.framework !== undefined) {
      throw new RspfxError('INVALID_OPTION', `--framework is not supported for ${component} components; extensions scaffold as vanilla`);
    }
    if (opts.language !== undefined) {
      throw new RspfxError('INVALID_OPTION', `--language is not supported for ${component} components; extensions scaffold as TypeScript`);
    }
    framework = 'vanilla';
    language = 'ts';
  }
  if (!FRAMEWORK_CHOICES.includes(framework as FrameworkId)) {
    throw new RspfxError('INVALID_OPTION', `Unknown framework '${framework}'. Expected one of: ${FRAMEWORK_CHOICES.join(', ')}`);
  }
  if (!(LANGUAGES as readonly string[]).includes(language)) {
    throw new RspfxError('INVALID_OPTION', `Unknown language '${language}'. Expected one of: ${LANGUAGES.join(', ')}`);
  }
  if (!isSpfxTarget(spfxVersion)) {
    throw new RspfxError('INVALID_OPTION', `Unknown spfx version '${spfxVersion}'. Expected one of: ${SPFX_TARGETS.join(', ')}`);
  }
  if (!(PACKAGE_MANAGERS as readonly string[]).includes(pm)) {
    throw new RspfxError('INVALID_OPTION', `Unknown package manager '${pm}'. Expected one of: ${PACKAGE_MANAGERS.join(', ')}`);
  }
  if (!(BUNDLER_CHOICES as readonly string[]).includes(bundler)) {
    throw new RspfxError('INVALID_OPTION', `Unknown bundler '${bundler}'. Expected one of: ${BUNDLER_CHOICES.join(', ')}`);
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
    componentType: component,
    framework: framework as FrameworkId,
    spfxVersion: spfxVersion as SpfxTarget,
    language: language === 'js' ? 'javascript' : 'typescript',
    bundler: bundler as TemplateVars['bundler'],
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
