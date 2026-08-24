import type {
  FrameworkPreset,
  RspackContribs,
  FrameworkRsbuildContributions,
  FrameworkViteContributions
} from '@mbsks/rspfx-plugin-api';
import { createRequire } from 'node:module';
import { svelte as sveltePlugin } from '@sveltejs/vite-plugin-svelte';

const require = createRequire(import.meta.url);

function resolveSvelteConfig(projectRoot: string): {
  preprocess?: unknown;
  compilerOptions?: Record<string, unknown>;
} {
  const candidates = ['svelte.config.js', 'svelte.config.cjs', 'svelte.config.mjs', 'svelte.config.ts'];
  for (const file of candidates) {
    try {
      const resolved = require.resolve(file, { paths: [projectRoot] });
      const mod = require(resolved);
      const cfg = (mod as { default?: unknown }).default ?? mod;
      return (cfg ?? {}) as { preprocess?: unknown; compilerOptions?: Record<string, unknown> };
    } catch {}
  }
  return {};
}

function svelteMajor(): number {
  try {
    const pkg = require('svelte/package.json') as { version: string };
    return Number(String(pkg.version).split('.')[0] ?? 0);
  } catch {
    return 4;
  }
}

export const preset = {
  name: 'svelte' as const,
  rspack(opts: { fastRefresh: boolean }): RspackContribs {
    const cfg = resolveSvelteConfig(process.cwd());
    const major = svelteMajor();
    const compilerOptions: Record<string, unknown> = {
      dev: opts.fastRefresh,
      css: 'injected' as const,
      ...(cfg.compilerOptions ?? {})
    };
    if (major >= 5) compilerOptions.runes = undefined;
    return {
      rules: [
        {
          test: /\.svelte$/,
          use: {
            loader: 'svelte-loader',
            options: {
              hotReload: opts.fastRefresh,
              emitCss: false,
              compilerOptions,
              preprocess: cfg.preprocess
            }
          }
        }
      ],
      resolve: { extensions: ['.svelte'] }
    };
  },
  vite(opts: { fastRefresh: boolean }): FrameworkViteContributions {
    const major = svelteMajor();
    const compilerOptions: Record<string, unknown> = { css: 'injected' as const };
    if (major >= 5) compilerOptions.runes = undefined;
    return {
      plugins: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sveltePlugin({
          hot: opts.fastRefresh,
          emitCss: false,
          compilerOptions: compilerOptions as any
        } as any)
      ],
      resolveExtensions: ['.svelte']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
    return this.rspack(opts) as unknown as FrameworkRsbuildContributions;
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'svelte'>;
