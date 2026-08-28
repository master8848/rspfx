import type {
  FrameworkPreset,
  RspackContribs,
  FrameworkRsbuildContributions,
  FrameworkViteContributions
} from '@mbsks/rspfx-plugin-api';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadSolidPlugin(): ((opts?: unknown) => unknown) | undefined {
  try {
    const mod = require('vite-plugin-solid') as { default?: unknown } & Record<string, unknown>;
    const fn = (mod as { default?: (o?: unknown) => unknown }).default ?? (mod as unknown as (o?: unknown) => unknown);
    return typeof fn === 'function' ? (fn as (o?: unknown) => unknown) : undefined;
  } catch {
    return undefined;
  }
}

function tryResolveFromProject(name: string, projectRoot: string): string | undefined {
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req.resolve(name);
  } catch {}
  try {
    return require.resolve(name);
  } catch {}
  return undefined;
}

function solidBabelRule(fastRefresh: boolean, projectRoot: string): RspackContribs['rules'] {
  const swcPlugin = tryResolveFromProject('@swc/plugin-solid', projectRoot);
  if (swcPlugin) {
    return [
      {
        test: /\.(t|j)sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
            rspackExperiments: { swcPlugins: [[swcPlugin, { generate: 'dom' }]] }
          }
        }
      }
    ];
  }
  return [
    {
      test: /\.(t|j)sx?$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          cacheDirectory: true,
          presets: [
            [require.resolve('babel-preset-solid'), { generate: 'dom', ...(fastRefresh ? { development: true } : {}) }],
            require.resolve('@babel/preset-typescript')
          ],
          plugins: fastRefresh ? [[require.resolve('solid-refresh/babel'), { bundler: 'rspack-esm' }]] : []
        }
      }
    }
  ];
}

export const preset = {
  name: 'solid' as const,
  rspack(opts: { fastRefresh: boolean }): RspackContribs {
    return { rules: solidBabelRule(opts.fastRefresh, process.cwd()) };
  },
  vite(_opts: { fastRefresh: boolean }): FrameworkViteContributions {
    const solidPlugin = loadSolidPlugin();
    return {
      plugins: solidPlugin ? [solidPlugin()] : [],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.json']
    };
  },
  rsbuild(opts: { fastRefresh: boolean }): FrameworkRsbuildContributions {
    return { rules: solidBabelRule(opts.fastRefresh, process.cwd()) };
  },
  /** @deprecated use rspack() */
  contributions(opts: { fastRefresh: boolean }): RspackContribs {
    return this.rspack(opts);
  }
} satisfies FrameworkPreset<'solid'>;
