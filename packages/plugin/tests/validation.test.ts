import { describe, expect, it } from 'vitest';
import { RspfxPluginOptionsSchema, validatePluginOptions, tryValidatePluginOptions } from '../src/validation.js';
import * as v from 'valibot';

describe('RspfxPluginOptionsSchema / validatePluginOptions', () => {
  it('valid minimal ok', () => {
    const res = validatePluginOptions({ name: 'my-app' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.name).toBe('my-app');
    // also via schema safeParse
    const parsed = v.safeParse(RspfxPluginOptionsSchema, { name: 'my-app' });
    expect(parsed.success).toBe(true);
  });

  it('valid full ok', () => {
    const res = validatePluginOptions({
      name: 'my-app',
      projectRoot: '/tmp/proj',
      framework: 'react',
      version: '1.2.3',
      spfxVersion: '1.23',
      dev: {
        port: 4321,
        https: true,
        hostname: 'localhost',
        tenantUrl: 'https://contoso.sharepoint.com',
        initialPage: 'https://contoso.sharepoint.com/_layouts/workbench.aspx',
        workbench: true,
        fastRefresh: false,
        openBrowser: false,
      },
      build: { outDir: 'dist', sourcemap: false, minify: true },
      paths: {
        srcDir: 'src',
        webpartsDir: 'src/webparts',
        extensionsDir: 'src/extensions',
        librariesDir: 'src/libraries',
        configDir: 'config',
      },
      deploy: { tenantUrl: 'https://contoso.sharepoint.com' },
    });
    expect(res.ok).toBe(true);
  });

  it('name invalid type fails', () => {
    const res = validatePluginOptions({ name: 123 } as unknown as Record<string, unknown>);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error[0]!.code).toBe('CONFIG_VALIDATION_FAILED');
      expect(res.error[0]!.message).toContain('(got 123)');
      expect(res.error[0]!.path).toEqual(['name']);
    }
  });

  it('name empty fails', () => {
    const res = validatePluginOptions({ name: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error[0]!.message).toContain('(got ""');
  });

  it('name trim empty fails', () => {
    const res = validatePluginOptions({ name: '   ' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error[0]!.code).toBe('CONFIG_VALIDATION_FAILED');
      expect(res.error[0]!.message).toContain('(got "   ")');
    }
  });

  it('version semver regex fails for 1.2', () => {
    const res = validatePluginOptions({ name: 'my-app', version: '1.2' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error[0]!.path).toEqual(['version']);
      expect(res.error[0]!.message).toContain('(got');
      expect(res.error[0]!.code).toBe('CONFIG_VALIDATION_FAILED');
    }
  });

  it('version valid semver passes', () => {
    expect(validatePluginOptions({ name: 'my-app', version: '1.2.3' }).ok).toBe(true);
    expect(validatePluginOptions({ name: 'my-app', version: '1.2.3-beta' }).ok).toBe(true);
  });

  it('version invalid type fails', () => {
    const res = validatePluginOptions({ name: 'my-app', version: 123 } as unknown as Record<string, unknown>);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error[0]!.message).toContain('(got 123)');
  });

  it('spfxVersion invalid type fails', () => {
    const res = validatePluginOptions({ name: 'my-app', spfxVersion: 1.23 } as unknown as Record<string, unknown>);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error[0]!.path).toEqual(['spfxVersion']);
      expect(res.error[0]!.message).toContain('(got 1.23)');
    }
  });

  it('spfxVersion string passes', () => {
    expect(validatePluginOptions({ name: 'my-app', spfxVersion: '1.23' }).ok).toBe(true);
  });

  it('projectRoot invalid type and empty', () => {
    expect(validatePluginOptions({ name: 'my-app', projectRoot: 123 } as unknown as Record<string, unknown>).ok).toBe(false);
    const empty = validatePluginOptions({ name: 'my-app', projectRoot: '' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error[0]!.message).toContain('(got ""');
  });

  it('framework invalid type and empty', () => {
    expect(validatePluginOptions({ name: 'my-app', framework: 123 } as unknown as Record<string, unknown>).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', framework: '' }).ok).toBe(false);
  });

  it('dev.port boundaries 1023 fails 1024 passes 65535 passes 65536 fails', () => {
    expect(validatePluginOptions({ name: 'my-app', dev: { port: 1023 } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', dev: { port: 1024 } }).ok).toBe(true);
    expect(validatePluginOptions({ name: 'my-app', dev: { port: 65535 } }).ok).toBe(true);
    const over = validatePluginOptions({ name: 'my-app', dev: { port: 65536 } });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error[0]!.message).toContain('(got 65536)');
    expect(validatePluginOptions({ name: 'my-app', dev: { port: 1023.5 } } as unknown as Record<string, unknown>).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', dev: { port: '4321' as unknown as number } }).ok).toBe(false);
  });

  it('dev.https invalid type', () => {
    const res = validatePluginOptions({ name: 'my-app', dev: { https: 'true' as unknown as boolean } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error[0]!.message).toContain('(got "true")');
  });

  it('hostname non-empty fails', () => {
    expect(validatePluginOptions({ name: 'my-app', dev: { hostname: '' } }).ok).toBe(false);
    const ws = validatePluginOptions({ name: 'my-app', dev: { hostname: 123 as unknown as string } });
    expect(ws.ok).toBe(false);
    if (!ws.ok) expect(ws.error[0]!.message).toContain('(got 123)');
    expect(validatePluginOptions({ name: 'my-app', dev: { hostname: 'localhost' } }).ok).toBe(true);
  });

  it('tenantUrl url invalid', () => {
    const res = validatePluginOptions({ name: 'my-app', dev: { tenantUrl: 'not-a-url' } });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error[0]!.path).toEqual(['dev', 'tenantUrl']);
      expect(res.error[0]!.message).toContain('(got "not-a-url")');
    }
    expect(validatePluginOptions({ name: 'my-app', dev: { tenantUrl: 'https://contoso.sharepoint.com' } }).ok).toBe(true);
    expect(validatePluginOptions({ name: 'my-app', dev: { tenantUrl: 123 as unknown as string } }).ok).toBe(false);
  });

  it('dev.initialPage non-empty and type', () => {
    expect(validatePluginOptions({ name: 'my-app', dev: { initialPage: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', dev: { initialPage: 123 as unknown as string } }).ok).toBe(false);
  });

  it('dev booleans invalid', () => {
    expect(validatePluginOptions({ name: 'my-app', dev: { workbench: 'yes' as unknown as boolean } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', dev: { fastRefresh: 1 as unknown as boolean } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', dev: { openBrowser: 'no' as unknown as boolean } }).ok).toBe(false);
  });

  it('build fields invalid', () => {
    expect(validatePluginOptions({ name: 'my-app', build: { outDir: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', build: { outDir: 123 as unknown as string } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', build: { sourcemap: 'true' as unknown as boolean } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', build: { minify: 1 as unknown as boolean } }).ok).toBe(false);
  });

  it('paths fields invalid', () => {
    expect(validatePluginOptions({ name: 'my-app', paths: { srcDir: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', paths: { webpartsDir: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', paths: { extensionsDir: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', paths: { librariesDir: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', paths: { configDir: '' } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', paths: { srcDir: 123 as unknown as string } }).ok).toBe(false);
  });

  it('deploy tenantUrl invalid', () => {
    const res = validatePluginOptions({ name: 'my-app', deploy: { tenantUrl: 'not-a-url' } });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error[0]!.path).toEqual(['deploy', 'tenantUrl']);
      expect(res.error[0]!.message).toContain('(got "not-a-url")');
    }
    expect(validatePluginOptions({ name: 'my-app', deploy: { tenantUrl: 123 as unknown as string } }).ok).toBe(false);
    expect(validatePluginOptions({ name: 'my-app', deploy: { tenantUrl: 'https://contoso.sharepoint.com' } }).ok).toBe(true);
  });

  it('mapPluginIssues includes (got ...) and code CONFIG_VALIDATION_FAILED', () => {
    const res = validatePluginOptions({ name: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      for (const issue of res.error) {
        expect(issue.code).toBe('CONFIG_VALIDATION_FAILED');
        expect(issue.message).toContain('(got');
        expect(issue.message).toContain('fix:');
      }
    }
    const numRes = validatePluginOptions({ name: 42 as unknown as string });
    expect(numRes.ok).toBe(false);
    if (!numRes.ok) {
      expect(numRes.error[0]!.message).toContain('(got 42)');
      expect(numRes.error[0]!.message).toContain('fix:');
    }
  });

  it('tryValidatePluginOptions alias works', () => {
    const a = validatePluginOptions({ name: 'my-app' });
    const b = tryValidatePluginOptions({ name: 'my-app' });
    expect(a).toEqual(b);
    const aFail = validatePluginOptions({ name: '' });
    const bFail = tryValidatePluginOptions({ name: '' });
    expect(aFail).toEqual(bFail);
    expect(tryValidatePluginOptions({ name: 'x', version: '1.2' }).ok).toBe(false);
  });
});
