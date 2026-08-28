import type { FrameworkPreset, RspackContribs, FrameworkRsbuildContributions, FrameworkViteContributions } from '@mbsks/rspfx-plugin-api';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadReactPlugin(): ((opts?: unknown) => unknown) | undefined {
  // Lazy-load so the preset works with both Vite 7 (plugin-react@^4) and
  // Vite 8 (plugin-react@^6 / oxc path). Vite 8 docs: plugin-react v6 uses
  // Oxc and drops Vite 7 support; v4–v5 still work on Vite 8 via the
  // compatibility layer, so either may be installed.
  try {
    const mod = require('@vitejs/plugin-react') as { default?: unknown } & Record<string, unknown>;
    const fn = (mod as { default?: (o?: unknown) => unknown }).default ?? (mod as unknown as (o?: unknown) => unknown);
    return typeof fn === 'function' ? (fn as (o?: unknown) => unknown) : undefined;
  } catch {
    return undefined;
  }
}

export const preset = {
  name: 'react' as const,
  rspack(opts: { fastRefresh: boolean }): RspackContribs {
    return {
      swc: {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: {
            react: {
              runtime: 'automatic',
              development: opts.fastRefresh
            }
          }
        }
      },
      plugins: opts.fastRefresh ? [new ReactRefreshRspackPlugin()] : []
    };
  },
  vite(opts: { fastRefresh: boolean }): FrameworkViteContributions {
    const reactPlugin = loadReactPlugin();
    return {
      plugins: opts.fastRefresh && reactPlugin ? [reactPlugin({ jsxRuntime: 'automatic' })] : [],
      esbuild: { jsx: 'automatic' }
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
    return {
      rules: [
        {
          test: /\.(t|j)sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-react', { runtime: 'automatic', development: opts.fastRefresh }],
                '@babel/preset-typescript'
              ],
              plugins: opts.fastRefresh ? ['react-refresh/babel'] : []
            }
          }
        }
      ],
      plugins: opts.fastRefresh ? [new ReactRefreshRspackPlugin()] : []
    };
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'react'>;
