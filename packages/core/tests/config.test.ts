import { describe, it, expect } from 'vitest';
import { defineConfig, resolveConfig } from '../src/index.js';

describe('resolveConfig', () => {
  it('fills all defaults for a minimal config', () => {
    const config = resolveConfig({ name: 'test-webpart' });
    expect(config).toEqual({
      name: 'test-webpart',
      framework: 'vanilla',
      spfxVersion: '1.22',
      fluent: false,
      language: 'typescript',
      styling: 'scss',
      dev: {
        port: 4321,
        https: true,
        hostname: 'localhost',
        workbench: true,
        fastRefresh: false,
        openBrowser: true
      },
      build: {
        sourcemap: false,
        minify: true,
        splitChunks: false,
        outDir: 'dist',
        releaseDir: 'release'
      }
    });
  });

  it('merges partial overrides on top of defaults', () => {
    const config = resolveConfig({
      name: 'my-app',
      framework: 'react',
      language: 'javascript',
      styling: 'tailwind',
      fluent: true,
      spfxVersion: '1.21',
      dev: { port: 9000, https: false, fastRefresh: true },
      build: { sourcemap: true, minify: false }
    });
    expect(config.name).toBe('my-app');
    expect(config.framework).toBe('react');
    expect(config.language).toBe('javascript');
    expect(config.styling).toBe('tailwind');
    expect(config.fluent).toBe(true);
    expect(config.spfxVersion).toBe('1.21');
    expect(config.dev).toEqual({
      port: 9000,
      https: false,
      hostname: 'localhost',
      workbench: true,
      fastRefresh: true,
      openBrowser: true
    });
    expect(config.build).toEqual({
      sourcemap: true,
      minify: false,
      splitChunks: false,
      outDir: 'dist',
      releaseDir: 'release'
    });
  });

  it('passes through optional sections', () => {
    const config = resolveConfig({
      name: 'x',
      dev: { tenantUrl: 'https://contoso.sharepoint.com', initialPage: 'https://{tenantdomain}/site' },
      playground: { port: 3000, enabled: true },
      deploy: { tenantUrl: 'https://t', username: 'u', password: 'p', appCatalogSiteUrl: 'https://t/sites/appcatalog' }
    });
    expect(config.dev.tenantUrl).toBe('https://contoso.sharepoint.com');
    expect(config.dev.initialPage).toBe('https://{tenantdomain}/site');
    expect(config.playground).toEqual({ port: 3000, enabled: true });
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
    expect(config.playground).toBeUndefined();
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
      spfxVersion: '1.22',
      fluent: false,
      language: 'typescript',
      styling: 'scss',
      dev: { port: 4321 },
      build: { minify: true }
    } as const;
    expect(defineConfig(config)).toBe(config);
  });
});
