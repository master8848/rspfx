import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { RuleSetRule } from '@rspack/core';

const require = createRequire(import.meta.url);

const POSTCSS_CONFIG_FILES = [
  'postcss.config.js',
  'postcss.config.cjs',
  'postcss.config.mjs',
  'postcss.config.ts',
  'postcss.config.cts',
  'postcss.config.mts',
  'postcss.config.json'
];

function tryResolve(name: string, projectRoot: string): string | undefined {
  try {
    const req = createRequire(path.join(projectRoot, 'package.json'));
    return req.resolve(name);
  } catch {}
  try {
    return require.resolve(name);
  } catch {}
  return undefined;
}

function hasPostcssConfigFile(projectRoot: string): boolean {
  for (const f of POSTCSS_CONFIG_FILES) {
    try {
      if (fs.existsSync(path.join(projectRoot, f))) return true;
    } catch {}
  }
  return false;
}

export function rspfxCssInlineRule(projectRoot?: string): RuleSetRule {
  const root = projectRoot ?? process.cwd();
  let styleLoaderPath: string | undefined = tryResolve('style-loader', root);
  let cssLoaderPath: string | undefined = tryResolve('css-loader', root);
  if (!styleLoaderPath) styleLoaderPath = tryResolve('style-loader', root) ?? 'style-loader';
  if (!cssLoaderPath) cssLoaderPath = tryResolve('css-loader', root) ?? 'css-loader';
  // fallback to package's own if still undefined: tryResolve already tried require.resolve
  // but ensure string fallback
  const sPath = styleLoaderPath ?? 'style-loader';
  const cPath = cssLoaderPath ?? 'css-loader';
  const hasPostcss = hasPostcssConfigFile(root);
  const postcssLoaderPath = tryResolve('postcss-loader', root);
  const postcssPath = tryResolve('postcss', root);
  const postcssAvailable = hasPostcss && !!postcssLoaderPath && !!postcssPath;

  // css-loader implicit mode: 'local' via auto (vite.ts:330 explicit scopeBehaviour: 'local'); :global{} leaks
  const use: unknown[] = [
    sPath,
    {
      loader: cPath,
      options: {
        modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' },
        importLoaders: postcssAvailable && postcssLoaderPath ? 1 : 0
      }
    }
  ];
  if (postcssAvailable && postcssLoaderPath) {
    use.push({ loader: postcssLoaderPath });
  }
  return { test: /\.css$/, use: use as RuleSetRule['use'] };
}

export function rspfxSassRule(projectRoot?: string): RuleSetRule {
  const root = projectRoot ?? process.cwd();
  let styleLoaderPath: string | undefined = tryResolve('style-loader', root);
  let cssLoaderPath: string | undefined = tryResolve('css-loader', root);
  const sPath = styleLoaderPath ?? 'style-loader';
  const cPath = cssLoaderPath ?? 'css-loader';
  const hasPostcss = hasPostcssConfigFile(root);
  const postcssLoaderPath = tryResolve('postcss-loader', root);
  const postcssPath = tryResolve('postcss', root);
  const postcssAvailable = hasPostcss && !!postcssLoaderPath && !!postcssPath;

  let sassLoaderPath: string | undefined = tryResolve('sass-loader', root);
  const sassPath = tryResolve('sass', root);
  const hasSass = !!sassPath && !!sassLoaderPath;
  // Even if sass not found, still return a rule pointing at sass-loader (will error at compile time if missing)
  const sassLoaderResolved = sassLoaderPath ?? 'sass-loader';

  const importLoaders = (postcssAvailable ? 1 : 0) + 1;
  // same implicit local mode; exportLocalsConvention: 'asIs' (see config.ts:218 and vite.ts:330)
  const use: unknown[] = [
    sPath,
    { loader: cPath, options: { modules: { auto: /\.module\.\w+$/i, namedExport: false, exportLocalsConvention: 'asIs' }, importLoaders } }
  ];
  if (postcssAvailable && postcssLoaderPath) {
    use.push({ loader: postcssLoaderPath });
  }
  // If hasSass is false we still push sass-loader so user gets a meaningful error; caller can decide to ignore
  use.push({ loader: sassLoaderResolved, options: { api: 'modern' } });

  // Suppress unused variable warning when not needed
  void hasSass;

  return { test: /\.s[ac]ss$/i, use: use as RuleSetRule['use'] };
}
