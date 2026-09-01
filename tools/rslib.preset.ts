import type { LibConfig } from '@rslib/core';

export const HEAVY_EXTERNALS: Array<string | RegExp> = [
  /\.s?css$/,
  /\.scss$/,
  'react',
  'react-dom',
  'vue',
  'preact',
  'solid-js',
  'svelte',
  '@fluentui/react',
  'vite',
  '@rspack/core',
  '@rspack/dev-server',
  '@rsbuild/core',
  'sass',
  'sass-loader',
  'css-loader',
  'style-loader',
  'postcss',
  'postcss-loader',
  '@vitejs/plugin-react',
  '@rspack/plugin-react-refresh',
  'react-refresh',
  '@babel/core',
  'babel-loader',
  '@babel/preset-react',
  '@babel/preset-typescript',
  /^@microsoft\/sp-.*/,
  /^@msinternal\/.*/,
  /^@ms\/.*/,
];

export function createRspfxLib(
  overrides?: Partial<LibConfig> & { extraExternals?: Array<string | RegExp> },
): LibConfig {
  // CI guard: disable sourcemaps and declaration maps to keep dist clean and prevent leaking source content in published packages.
  // rslib output.sourceMap and dts.build are intentionally false; tsconfig declarationMap/sourceMap are also false.
  // If sourcemaps are ever needed for debugging, enable them locally via override but do not commit to CI.
  const base: LibConfig = {
    format: 'esm',
    syntax: 'es2022',
    bundle: true,
    dts: { build: false },
    autoExternal: {
      dependencies: true,
      peerDependencies: true,
      optionalDependencies: true,
      devDependencies: false,
    },
  };
  const extra = overrides?.extraExternals ?? [];
  const extraArray: Array<string | RegExp> = Array.isArray(extra) ? extra : extra ? [extra as unknown as string | RegExp] : [];
  const { extraExternals: _omit, output: overrideOutput, ...rest } = (overrides ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...(rest as Partial<LibConfig>),
    output: {
      // CI guard: keep output.sourceMap false and cleanDistPath true to avoid stale .map and declarationMap artifacts
      sourceMap: false,
      cleanDistPath: true,
      externals: [...HEAVY_EXTERNALS, ...extraArray],
      ...(overrideOutput as Record<string, unknown> | undefined),
    },
  } as LibConfig;
}
