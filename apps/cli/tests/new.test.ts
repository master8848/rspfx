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
      framework: 'vanilla',
      language: 'ts',
      styling: 'scss',
      fluent: false,
      spfxVersion: '1.22',
      pm: 'pnpm',
      install: false,
      tenant: 'https://contoso.sharepoint.com'
    });

    expect(dest).toBe(path.join(tmp, 'my-app'));
    for (const file of [
      'package.json',
      'tsconfig.json',
      'rspack.config.ts',
      '.gitignore',
      'README.md',
      'config/package-solution.json',
      'config/serve.json',
      'config/write-manifests.json',
      'src/index.ts',
      'src/webparts/my-app/my-app.manifest.json',
      'src/webparts/my-app/my-appWebPart.ts',
      'src/webparts/my-app/components/MyApp.ts',
      'src/webparts/my-app/styles/MyApp.module.scss',
      'playground/index.html',
      'playground/main.ts'
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
    expect(packageJson.dependencies?.['@microsoft/sp-property-pane']).toBe('1.22.0');

    const solutionConfig = JSON.parse(
      fs.readFileSync(path.join(dest, 'config', 'package-solution.json'), 'utf8')
    ) as {
      solution: { id: string; features: { id: string }[] };
      paths: { zippedPackage: string };
    };
    expect(solutionConfig.solution.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(solutionConfig.solution.features[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(solutionConfig.paths.zippedPackage).toBe('sharepoint/solution/my-app.sppkg');

    const config = fs.readFileSync(path.join(dest, 'rspack.config.ts'), 'utf8');
    expect(config).toContain("framework: 'vanilla'");
    expect(config).toContain("tenantUrl: 'https://contoso.sharepoint.com'");
    rmRf(tmp);
  });

  it('rejects unknown framework values', async () => {
    const tmp = makeTmpDir('new-invalid');
    await expect(
      runNew({ name: 'bad', cwd: tmp, framework: 'ember', install: false, yes: true })
    ).rejects.toThrow(/Unknown framework/);
    rmRf(tmp);
  });

  it('defaults to a react + tailwind scaffold when using yes', async () => {
    const tmp = makeTmpDir('new-defaults');
    const dest = await runNew({ name: 'def-app', cwd: tmp, yes: true, install: false });

    const config = fs.readFileSync(path.join(dest, 'rspack.config.ts'), 'utf8');
    expect(config).toContain("framework: 'react'");
    expect(config).toContain("styling: 'tailwind'");

    const componentsDir = path.join(dest, 'src/webparts/def-app/components');
    expect(fs.existsSync(path.join(componentsDir, 'ui/button.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(componentsDir, 'globals.css'))).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.['clsx']).toBeDefined();
    expect(packageJson.dependencies?.['react']).toBeDefined();
    rmRf(tmp);
  });
});
