import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runNew } from '../src/commands/new.js';
import { makeTmpDir, rmRf } from './helpers.js';

describe('new', () => {
  it('scaffolds a project without installing dependencies', async () => {
    const tmp = makeTmpDir('new');
    const dest = await runNew({
      name: 'my-app',
      cwd: tmp,
      component: 'webpart',
      framework: 'vanilla',
      language: 'ts',
      spfxVersion: '1.23',
      pm: 'pnpm',
      bundler: 'vite',
      install: false,
      tenant: 'https://contoso.sharepoint.com'
    });

    expect(dest).toBe(path.join(tmp, 'my-app'));
    for (const file of [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
'.npmrc',
      '.gitignore',
      'README.md',
      'config/package-solution.json',
      'config/serve.json',
      'config/write-manifests.json',
      'src/index.ts',
      'src/webparts/my-app/my-app.manifest.json',
      'src/webparts/my-app/my-appWebPart.ts',
      'src/webparts/my-app/components/MyApp.ts',
      'src/webparts/my-app/styles/MyApp.module.scss'
    ]) {
      expect(fs.existsSync(path.join(dest, file)), file).toBe(true);
    }

    const packageJson = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
      dependencies?: Record<string, string>;
    };
    expect(packageJson.name).toBe('my-app');
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.dependencies?.['@microsoft/sp-property-pane']).toBe('1.23.0');

    const solutionConfig = JSON.parse(
      fs.readFileSync(path.join(dest, 'config', 'package-solution.json'), 'utf8')
    ) as {
      solution: { id: string; features: { id: string }[] };
      paths: { zippedPackage: string };
    };
    expect(solutionConfig.solution.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(solutionConfig.solution.features[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(solutionConfig.paths.zippedPackage).toBe('sharepoint/solution/my-app.sppkg');

    const config = fs.readFileSync(path.join(dest, 'vite.config.ts'), 'utf8');
    expect(config).toContain("framework: 'vanilla'");
    expect(config).toContain('tenantUrl: "https://contoso.sharepoint.com"');
  });

  it('rejects unknown framework values', async () => {
    const tmp = makeTmpDir('new-invalid');
    await expect(
      runNew({ name: 'bad', cwd: tmp, framework: 'ember', install: false, yes: true })
    ).rejects.toThrow(/Unknown framework/);
    rmRf(tmp);
  });

  it('defaults to a react + scss scaffold when using yes', async () => {
    const tmp = makeTmpDir('new-defaults');
    const dest = await runNew({ name: 'def-app', cwd: tmp, yes: true, install: false });

    const config = fs.readFileSync(path.join(dest, 'vite.config.ts'), 'utf8');
    expect(config).toContain("framework: 'react'");
    expect(config).not.toContain('fluent');

    const componentsDir = path.join(dest, 'src/webparts/def-app/components');
    expect(fs.existsSync(path.join(componentsDir, 'ui/button.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(componentsDir, 'globals.css'))).toBe(false);

    const packageJson = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.['@microsoft/sp-webpart-base']).toBeDefined();
    expect(packageJson.dependencies?.['tailwindcss']).toBeUndefined();
    rmRf(tmp);
  });

  it('scaffolds an application customizer extension', async () => {
    const tmp = makeTmpDir('new-ext');
    const dest = await runNew({
      name: 'my-ext',
      cwd: tmp,
      component: 'applicationcustomizer',
      spfxVersion: '1.23',
      pm: 'pnpm',
      install: false,
      yes: true
    });

    expect(fs.existsSync(path.join(dest, 'src/extensions/my-ext/my-ext.manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/extensions/my-ext/MyExtApplicationCustomizer.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'src/webparts'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'teams'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'config/config.json'))).toBe(false);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dest, 'src/extensions/my-ext/my-ext.manifest.json'), 'utf8')
    ) as { componentType: string; extensionType: string };
    expect(manifest.componentType).toBe('Extension');
    expect(manifest.extensionType).toBe('ApplicationCustomizer');

    const packageJson = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.['@microsoft/sp-application-base']).toBe('1.23.0');
    expect(packageJson.dependencies?.['@microsoft/decorators']).toBe('1.23.0');
    expect(packageJson.dependencies?.['@microsoft/sp-webpart-base']).toBeUndefined();

    const config = fs.readFileSync(path.join(dest, 'vite.config.ts'), 'utf8');
    expect(config).toContain("framework: 'vanilla'");
    expect(config).not.toContain("language:");
    rmRf(tmp);
  });

  it('scaffolds a list view command set extension with command items', async () => {
    const tmp = makeTmpDir('new-lvcs');
    const dest = await runNew({
      name: 'cmds',
      cwd: tmp,
      component: 'listviewcommandset',
      spfxVersion: '1.23',
      pm: 'pnpm',
      install: false,
      yes: true
    });

    const manifest = JSON.parse(
      fs.readFileSync(path.join(dest, 'src/extensions/cmds/cmds.manifest.json'), 'utf8')
    ) as { extensionType: string; items: Record<string, { title: { default: string } }> };
    expect(manifest.extensionType).toBe('ListViewCommandSet');
    expect(manifest.items['CMDS_1']?.title.default).toBe('Command One');
    expect(manifest.items['CMDS_2']?.title.default).toBe('Command Two');
    expect(fs.existsSync(path.join(dest, 'src/extensions/cmds/CmdsCommandSet.ts'))).toBe(true);
    rmRf(tmp);
  });

  it('rejects unknown component values', async () => {
    const tmp = makeTmpDir('new-bad-component');
    await expect(
      runNew({ name: 'bad', cwd: tmp, component: 'unknown', install: false, yes: true })
    ).rejects.toThrow(/Unknown component/);
    rmRf(tmp);
  });

  it('rejects framework/language flags for extensions', async () => {
    const tmp = makeTmpDir('new-ext-flags');
    await expect(
      runNew({ name: 'bad', cwd: tmp, component: 'fieldcustomizer', framework: 'react', install: false, yes: true })
    ).rejects.toThrow(/--framework is not supported/);
    await expect(
      runNew({ name: 'bad2', cwd: tmp, component: 'applicationcustomizer', language: 'js', install: false, yes: true })
    ).rejects.toThrow(/--language is not supported/);
    rmRf(tmp);
  });
});
