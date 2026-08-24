import type {
  FrameworkPreset,
  RspackContribs,
  FrameworkRsbuildContributions,
  FrameworkViteContributions
} from '@mbsks/rspfx-plugin-api';
import path from 'node:path';
import { createRequire } from 'node:module';
import solidPlugin from 'vite-plugin-solid';

const require = createRequire(import.meta.url);

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
    return {
      plugins: [solidPlugin()],
      resolveExtensions: ['.tsx', '.jsx']
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
