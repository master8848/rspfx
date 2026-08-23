import { describe, it, expect } from 'vitest';
import { configDefaults, defineConfig, resolveConfig, resolvePathDefaults } from '../src/index.js';

describe('configDefaults', () => {
  it('holds the canonical default values', () => {
    expect(configDefaults).toEqual({
      dev: {
        port: 4321,
        https: true,
        hostname: 'localhost',
        workbench: true,
        fastRefresh: false,
        openBrowser: false
      },
      build: {
        sourcemap: false,
        minify: true,
        splitChunks: false,
        outDir: 'dist',
        releaseDir: 'release'
      },
      paths: {
        srcDir: 'src',
        webpartsDir: 'src/webparts',
        extensionsDir: 'src/extensions',
        librariesDir: 'src/libraries',
        configDir: 'config'
      }
    });
  });

  it('is what a minimal config resolves to', () => {
    const config = resolveConfig({ name: 'x' });
    expect({
      dev: config.dev,
      build: config.build,
      paths: config.paths
    }).toEqual(configDefaults);
  });
});

describe('resolveConfig', () => {
  it('fills all defaults for a minimal config', () => {
    const config = resolveConfig({ name: 'test-webpart' });
    expect(config).toEqual({
      name: 'test-webpart',
      framework: 'vanilla',
      spfxVersion: '1.23',
      dev: {
        port: 4321,
        https: true,
        hostname: 'localhost',
        workbench: true,
        fastRefresh: false,
        openBrowser: false
      },
      build: {
        sourcemap: false,
        minify: true,
        splitChunks: false,
        outDir: 'dist',
        releaseDir: 'release'
      },
      paths: {
        srcDir: 'src',
        webpartsDir: 'src/webparts',
        extensionsDir: 'src/extensions',
        librariesDir: 'src/libraries',
        configDir: 'config'
      }
    });
  });

  it('merges partial overrides on top of defaults', () => {
    const config = resolveConfig({
      name: 'my-app',
      framework: 'react',
      spfxVersion: '1.21',
      dev: { port: 9000, https: false, fastRefresh: true },
      build: { sourcemap: true, minify: false }
    });
    expect(config.name).toBe('my-app');
    expect(config.framework).toBe('react');
    expect(config.spfxVersion).toBe('1.21');
    expect(config.dev).toEqual({
      port: 9000,
      https: false,
      hostname: 'localhost',
      workbench: true,
      fastRefresh: true,
      openBrowser: false
    });
    expect(config.build).toEqual({
      sourcemap: true,
      minify: false,
      splitChunks: false,
      outDir: 'dist',
      releaseDir: 'release'
    });
  });

  it('resolves paths defaults and partial overrides', () => {
    const config = resolveConfig({
      name: 'x',
      paths: { srcDir: 'components', webpartsDir: 'components/widgets' }
    });
    expect(config.paths).toEqual({
      srcDir: 'components',
      webpartsDir: 'components/widgets',
      extensionsDir: 'src/extensions',
      librariesDir: 'src/libraries',
      configDir: 'config'
    });
    expect(resolvePathDefaults()).toEqual({
      srcDir: 'src',
      webpartsDir: 'src/webparts',
      extensionsDir: 'src/extensions',
      librariesDir: 'src/libraries',
      configDir: 'config'
    });
  });

  it('passes through optional sections', () => {
    const config = resolveConfig({
      name: 'x',
      dev: { tenantUrl: 'https://contoso.sharepoint.com', initialPage: 'https://{tenantdomain}/site' },
      deploy: { tenantUrl: 'https://t', username: 'u', password: 'p', appCatalogSiteUrl: 'https://t/sites/appcatalog' }
    });
    expect(config.dev.tenantUrl).toBe('https://contoso.sharepoint.com');
    expect(config.dev.initialPage).toBe('https://{tenantdomain}/site');
    expect(config.deploy).toEqual({
      tenantUrl: 'https://t',
      username: 'u',
      password: 'p',
      appCatalogSiteUrl: 'https://t/sites/appcatalog'
    });
  });

  it('does not invent optional dev fields', () => {
    const config = resolveConfig({ name: 'x' });
    expect('tenantUrl' in config.dev).toBe(false);
    expect('initialPage' in config.dev).toBe(false);
    expect(config.deploy).toBeUndefined();
  });

  it('throws when name is missing', () => {
    expect(() => resolveConfig({})).toThrow();
  });
});

describe('defineConfig', () => {
  it('returns the config as-is', () => {
    const config = {
      name: 'identity',
      framework: 'svelte',
      spfxVersion: '1.23',
      dev: { port: 4321 },
      build: { minify: true }
    } as const;
    expect(defineConfig(config)).toBe(config);
  });
});
