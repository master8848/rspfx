import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const packages = {
  core: { deps: {}, peer: {} },
  diagnostics: { deps: { '@mbsks/rspfx-core': 'workspace:*' }, peer: {} },
  'plugin-api': { deps: { '@mbsks/rspfx-core': 'workspace:*' }, peer: {} },
  'compiler-rspack': {
    deps: {
      '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*', '@mbsks/rspfx-diagnostics': 'workspace:*',
      '@rspack/core': '^1.2.0', '@rspack/dev-server': '^1.0.0',
      'sass': '^1.83.0', 'sass-loader': '^16.0.4',
      'css-loader': '^7.1.2', 'style-loader': '^4.0.0',
      'postcss': '^8.4.49', 'postcss-loader': '^8.1.1', '@tailwindcss/postcss': '^4.0.0'
    },
    peer: {}
  },
  'manifest-generator': { deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-diagnostics': 'workspace:*' }, peer: {} },
  'sppkg-builder': { deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-diagnostics': 'workspace:*', 'yazl': '^3.1.0' }, peer: {} },
  'manifest-server': { deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-diagnostics': 'workspace:*', 'selfsigned': '^2.4.1' }, peer: {} },
  'dev-runtime': {
    deps: {
      '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-compiler-rspack': 'workspace:*',
      '@mbsks/rspfx-manifest-server': 'workspace:*', '@mbsks/rspfx-manifest-generator': 'workspace:*',
      '@mbsks/rspfx-diagnostics': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*',
      '@mbsks/rspfx-sharepoint-runtime': 'workspace:*',
      '@mbsks/rspfx-framework-vanilla': 'workspace:*', '@mbsks/rspfx-framework-react': 'workspace:*',
      '@mbsks/rspfx-framework-solid': 'workspace:*', '@mbsks/rspfx-framework-preact': 'workspace:*',
      '@mbsks/rspfx-framework-vue': 'workspace:*', '@mbsks/rspfx-framework-svelte': 'workspace:*'
    },
    peer: {}
  },
  'framework-vanilla': { deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*' }, peer: {} },
  'framework-react': {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*', '@rspack/plugin-react-refresh': '^1.0.0' },
    peer: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    dev: { react: '^18.3.1', 'react-dom': '^18.3.1', '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0' }
  },
  'framework-solid': {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*', 'babel-loader': '^9.2.1', '@babel/core': '^7.26.0', 'babel-preset-solid': '^1.9.4' },
    peer: { 'solid-js': '^1.9.0' },
    dev: { 'solid-js': '^1.9.4' }
  },
  'framework-preact': {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*', '@rspack/plugin-preact-refresh': '^1.0.0' },
    peer: { preact: '^10.24.0' },
    dev: { preact: '^10.24.0' }
  },
  'framework-vue': {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*', 'vue-loader': '^17.4.2', '@vue/compiler-sfc': '^3.5.13' },
    peer: { vue: '^3.5.0' },
    dev: { vue: '^3.5.13' }
  },
  'framework-svelte': {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*', 'svelte-loader': '^3.2.4', 'svelte-hmr': '^0.16.0' },
    peer: { svelte: '^4.2.0' },
    dev: { svelte: '^4.2.19' }
  },
  'sharepoint-runtime': {
    deps: { '@mbsks/rspfx-core': 'workspace:*' },
    peer: { '@microsoft/sp-webpart-base': '*', '@microsoft/sp-core-library': '*' },
    dev: { '@microsoft/sp-webpart-base': '1.23.2', '@microsoft/sp-core-library': '1.23.2' }
  },
  'fluent-adapter': {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-framework-react': 'workspace:*' },
    peer: { '@fluentui/react': '^8.0.0' },
    dev: { '@fluentui/react': '8.122.7' }
  },
  templates: { deps: { '@mbsks/rspfx-core': 'workspace:*' }, peer: {} }
};

const apps = {
  cli: {
    deps: {
      '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-diagnostics': 'workspace:*', '@mbsks/rspfx-plugin-api': 'workspace:*',
      '@mbsks/rspfx-compiler-rspack': 'workspace:*', '@mbsks/rspfx-manifest-generator': 'workspace:*',
      '@mbsks/rspfx-sppkg-builder': 'workspace:*', '@mbsks/rspfx-manifest-server': 'workspace:*',
      '@mbsks/rspfx-dev-runtime': 'workspace:*', '@mbsks/rspfx-templates': 'workspace:*',
      '@mbsks/rspfx-sharepoint-runtime': 'workspace:*',
      'commander': '^12.1.0', 'jiti': '^2.4.0'
    },
    bin: { rspfx: './dist/cli.js' },
    dev: { '@types/commander': undefined }
  },
  playground: {
    deps: { '@mbsks/rspfx-core': 'workspace:*', '@mbsks/rspfx-framework-vanilla': 'workspace:*', '@mbsks/rspfx-sharepoint-runtime': 'workspace:*' },
    dev: {}
  }
};

function writePkg(dir, name, extra) {
  mkdirSync(join(ROOT, dir), { recursive: true });
  const pkg = {
    name,
    version: '0.1.0',
    private: dir.startsWith('apps/'),
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    files: ['dist'],
    license: 'MIT',
    scripts: { build: 'tsc -p tsconfig.build.json', typecheck: 'tsc --noEmit -p tsconfig.json', test: 'vitest run' }
  };
  if (extra.bin) pkg.bin = extra.bin;
  if (extra.deps && Object.keys(extra.deps).length) pkg.dependencies = extra.deps;
  if (extra.peer && Object.keys(extra.peer).length) pkg.peerDependencies = extra.peer;
  const dev = {};
  for (const [k, v] of Object.entries(extra.dev || {})) if (v !== undefined) dev[k] = v;
  if (Object.keys(dev).length) pkg.devDependencies = dev;
  writeFileSync(join(ROOT, dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  const depth = dir.split('/').length;
  const rel = '../'.repeat(depth) + 'tsconfig.base.json';
  writeFileSync(join(ROOT, dir, 'tsconfig.json'), JSON.stringify({
    extends: rel,
    compilerOptions: { noEmit: true },
    include: ['src', 'tests']
  }, null, 2) + '\n');
  writeFileSync(join(ROOT, dir, 'tsconfig.build.json'), JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: { noEmit: false, outDir: 'dist', rootDir: 'src' },
    include: ['src'],
    exclude: ['tests']
  }, null, 2) + '\n');
  mkdirSync(join(ROOT, dir, 'src'), { recursive: true });
  writeFileSync(join(ROOT, dir, 'src', 'index.ts'), "export {};\n");
}

for (const [name, spec] of Object.entries(packages)) writePkg(`packages/${name}`, `@mbsks/rspfx-${name}`, spec);
for (const [name, spec] of Object.entries(apps)) writePkg(`apps/${name}`, `@mbsks/rspfx-${name}`, spec);
console.log('skeletons written');
