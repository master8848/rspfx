#!/usr/bin/env node
/**
 * Sync all publishable package READMEs to use:
 *   - triple-bundler tagline: Vite · Rsbuild · Rspack (or Rspack-only for compiler-rspack)
 *   - canonical docs: https://rspfx.mbsks.me (not github/tree/main/docs)
 *
 * Run: node scripts/update-readmes.mjs [--check]
 *  --check exits 1 if any README would change (CI gate)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const DOCS = 'https://rspfx.mbsks.me';
const GITHUB = 'https://github.com/master8848/rspfx';

function patchReadme(file, content) {
  let next = content;

  // 1. Fix stale github docs link → rspfx.mbsks.me
  //    Handles `[RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)`
  if (next.includes('github.com/master8848/rspfx/tree/main/docs')) {
    next = next.replace(
      /\[RSPFX documentation\]\(https:\/\/github\.com\/master8848\/rspfx\/tree\/main\/docs\)/g,
      `[Documentation](${DOCS})`
    );
  }
  // If Links section still lacks DOCS but has github docs, inject.
  if (!next.includes(DOCS) && next.includes('github.com/master8848/rspfx')) {
    // Add docs link in Links section
    next = next.replace(
      /## Links\s*\n/,
      `## Links\n\n- [Documentation](${DOCS}) — [Getting Started](${DOCS}/docs/getting-started) · [Commands](${DOCS}/docs/commands)\n`
    );
  }

  // 2. Ensure manifest-server body mentions Vite/Rsbuild/Rspack, not just compiler-rspack
  if (file.endsWith('manifest-server/README.md')) {
    next = next.replace(
      'the compiler-rspack dev server; serving itself is handled there, not here',
      'Vite · Rsbuild · Rspack dev servers'
    );
  }

  // 3. Ensure framework READMEs mention all three bundlers for refresh (idempotent)
  // Only patch if line still rspack-only (no Vite ref yet)
  if (file.endsWith('framework-react/README.md') && next.includes('via `@rspack/plugin-react-refresh`') && !next.includes('@vitejs/plugin-react')) {
    next = next.replace(
      'via `@rspack/plugin-react-refresh`',
      'via `@rspack/plugin-react-refresh`, Vite via `@vitejs/plugin-react`, Rsbuild via its React plugin'
    );
  }
  if (file.endsWith('framework-preact/README.md') && next.includes('via `@rspack/plugin-preact-refresh`') && !next.includes('Vite and Rsbuild')) {
    next = next.replace(
      'via `@rspack/plugin-preact-refresh`',
      'via `@rspack/plugin-preact-refresh`, Vite and Rsbuild via their Preact refresh plugins'
    );
  }
  if (file.endsWith('framework-vue/README.md') && next.includes('with `vue-loader` SFC compilation') && !next.includes('@vitejs/plugin-vue')) {
    next = next.replace(
      'with `vue-loader` SFC compilation',
      'with SFC compilation: Rspack via `vue-loader`, Vite via `@vitejs/plugin-vue`, Rsbuild via its Vue plugin'
    );
  }
  if (file.endsWith('framework-svelte/README.md') && next.includes('with `svelte-loader` + `svelte-hmr` support') && !next.includes('@sveltejs/vite-plugin-svelte')) {
    next = next.replace(
      'with `svelte-loader` + `svelte-hmr` support',
      'with compilation: Rspack via `svelte-loader` + `svelte-hmr`, Vite via `@sveltejs/vite-plugin-svelte`, Rsbuild via its Svelte plugin'
    );
  }

  // 4. compiler-rspack header: ensure it says Rspack backend, not triple
  if (file.endsWith('compiler-rspack/README.md') && next.includes('Works with Vite, Rsbuild, and Rspack') && next.includes('A thin, owned configuration factory around **Rspack**')) {
    // Keep header but clarify — we already handle via manual edit, but ensure docs link present
    if (!next.includes('Vite and Rsbuild are supported via')) {
      next = next.replace(
        'Works with Vite, Rsbuild, and Rspack.',
        'Rspack backend of the triple-bundler toolchain (Vite and Rsbuild via `@mbsks/rspfx-plugin`). This package is **Rspack-only**; the toolchain is Vite (default) · Rsbuild · Rspack.'
      );
    }
  }

  // 5. Ensure apps/cli docs links use DOCS not github blob
  if (file.endsWith('apps/cli/README.md')) {
    next = next.replaceAll(
      'https://github.com/master8848/rspfx/blob/main/docs/getting-started.md',
      `${DOCS}/docs/getting-started`
    );
    next = next.replaceAll(
      'https://github.com/master8848/rspfx/blob/main/docs/commands.md',
      `${DOCS}/docs/commands`
    );
    next = next.replaceAll(
      'https://github.com/master8848/rspfx/blob/main/docs/architecture.md',
      `${DOCS}/docs/architecture`
    );
    next = next.replaceAll(
      'https://github.com/master8848/rspfx/blob/main/docs/migration-from-spfx.md',
      `${DOCS}/docs/migration-from-spfx`
    );
  }

  // 6. Ensure every Links section has DOCS + GitHub + License
  if (next.includes('## Links') && !next.includes(DOCS)) {
    next = next.replace('## Links', `## Links\n\n- [Documentation](${DOCS})`);
  }

  return next;
}

let changed = 0;
let checked = 0;

const publishableRoots = ['packages', 'apps'];
for (const root of publishableRoots) {
  const dir = path.join(ROOT, root);
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = path.join(dir, entry.name, 'README.md');
    if (!fs.existsSync(readme)) {
      // plugin missing case handled elsewhere; skip
      continue;
    }
    checked++;
    const content = fs.readFileSync(readme, 'utf8');
    const next = patchReadme(readme, content);
    if (next !== content) {
      changed++;
      if (CHECK) {
        console.error(`✗ ${path.relative(ROOT, readme)} needs update`);
      } else {
        fs.writeFileSync(readme, next);
        console.log(`✓ updated ${path.relative(ROOT, readme)}`);
      }
    }
  }
}

// Ensure plugin README exists
const pluginReadme = path.join(ROOT, 'packages/plugin/README.md');
if (!fs.existsSync(pluginReadme)) {
  console.error(`✗ missing ${path.relative(ROOT, pluginReadme)}`);
  if (CHECK) changed++;
}

console.log(`\nChecked ${checked} READMEs, ${changed} would change${CHECK ? ' (check mode)' : ''}.`);
if (CHECK && changed > 0) process.exit(1);
