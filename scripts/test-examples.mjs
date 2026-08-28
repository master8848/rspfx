#!/usr/bin/env node
/**
 * Build all examples via the workspace CLI and verify CSS inlining + sppkg.
 * Usage:
 *   node scripts/test-examples.mjs              # build DEFAULT examples (5, fast)
 *   node scripts/test-examples.mjs --all        # build all examples
 *   node scripts/test-examples.mjs --filter vite-react19,shadcn
 *   node scripts/test-examples.mjs --no-package # skip sppkg step
 *
 * No `bun i` inside examples is needed - they are workspaces, `bun install`
 * at the repo root already links them (bun workspaces + workspace:*).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'apps/cli/dist/cli.js');
const EXAMPLES_DIR = path.join(ROOT, 'examples');

const DEFAULT = ['vite-react19', 'vite-react', 'rsbuild-react', 'shadcn', 'react'];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { all: false, filter: null, package: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--all') out.all = true;
    else if (a === '--no-package') out.package = false;
    else if (a === '--package') out.package = true;
    else if (a.startsWith('--filter')) {
      const v = a.includes('=') ? a.split('=')[1] : args[++i];
      out.filter = v ? v.split(',').map((s) => s.trim()) : null;
    } else if (a.startsWith('--')) {
      console.warn(`unknown arg ${a}`);
    }
  }
  return out;
}

function collectCssFiles(dir) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d)) {
      if (e.startsWith('.')) continue;
      const full = path.join(d, e);
      const s = fs.statSync(full);
      if (s.isDirectory()) walk(full);
      else if (e.endsWith('.css')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function run(dir, args) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return r;
}

function findSppkg(dir) {
  const bases = [path.join(dir, 'sharepoint/solution'), path.join(dir, 'sharepoint')];
  for (const b of bases) {
    if (!fs.existsSync(b)) continue;
    const files = fs.readdirSync(b).filter((f) => f.endsWith('.sppkg'));
    if (files.length) return files.map((f) => path.join(b, f));
  }
  return [];
}

async function main() {
  const opts = parseArgs();
  if (!fs.existsSync(CLI)) {
    console.error(`CLI not built at ${CLI}. Run "bun run --filter @mbsks/rspfx-cli build" first.`);
    process.exit(1);
  }
  const allDirs = fs
    .readdirSync(EXAMPLES_DIR)
    .filter((e) => {
      const full = path.join(EXAMPLES_DIR, e);
      try {
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'package.json'));
      } catch {
        return false;
      }
    })
    .sort();

  let targets = opts.all ? allDirs : DEFAULT;
  if (opts.filter) targets = targets.filter((t) => opts.filter.includes(t));
  if (targets.length === 0) {
    console.error(`No examples matched filter. Available: ${allDirs.join(', ')}`);
    process.exit(1);
  }
  console.log(`Building ${targets.length} examples: ${targets.join(', ')}`);
  console.log(`CLI: ${CLI}`);
  console.log(`Root: ${ROOT}\n`);

  let failed = 0;
  for (const name of targets) {
    const dir = path.join(EXAMPLES_DIR, name);
    console.log(`\n=== ${name} ===`);
    const dist = path.join(dir, 'dist');
    const release = path.join(dir, 'release');
    const start = Date.now();
    const build = run(dir, ['build']);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (build.status !== 0) {
      console.error(`✗ ${name} build failed (${elapsed}s)`);
      console.error(build.stdout?.slice(-5000));
      console.error(build.stderr?.slice(-5000));
      failed++;
      continue;
    }
    const jsFiles = fs.existsSync(dist) ? fs.readdirSync(dist).filter((f) => f.endsWith('.js')) : [];
    const cssFiles = collectCssFiles(dist);
    if (cssFiles.length > 0) {
      console.error(`✗ ${name} has separate CSS files (must be inlined): ${cssFiles.join(', ')}`);
      failed++;
      continue;
    }
    if (jsFiles.length === 0) {
      console.error(`✗ ${name} dist has no .js`);
      failed++;
      continue;
    }
    // Check JS content
    let hasDefine = false;
    let hasStyle = false;
    for (const f of jsFiles) {
      const c = fs.readFileSync(path.join(dist, f), 'utf8');
      if (c.includes('define(')) hasDefine = true;
      if (c.includes('createElement("style")')) hasStyle = true;
    }
    if (!hasDefine) {
      console.error(`✗ ${name} JS missing AMD define`);
      failed++;
      continue;
    }
    // For tailwind examples we expect style injection, but warn for others
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const isTailwind = JSON.stringify(pkg).includes('tailwindcss') || fs.existsSync(path.join(dir, 'postcss.config.mjs')) || fs.existsSync(path.join(dir, 'postcss.config.js'));
    if (isTailwind && !hasStyle) {
      console.error(`✗ ${name} tailwind example missing style injection`);
      failed++;
      continue;
    }
    const manifestsDir = path.join(release, 'manifests');
    if (!fs.existsSync(manifestsDir) || fs.readdirSync(manifestsDir).filter((f) => f.endsWith('.manifest.json')).length === 0) {
      console.error(`✗ ${name} release/manifests missing`);
      failed++;
      continue;
    }
    console.log(`✓ ${name} build ok (${elapsed}s) - ${jsFiles.join(', ')} - ${hasStyle ? 'CSS inlined' : 'no style'}`);

    if (opts.package) {
      const pkgStart = Date.now();
      const pkgBuild = run(dir, ['package', '--no-build']);
      let sppkg = findSppkg(dir);
      if (pkgBuild.status !== 0 && sppkg.length === 0) {
        // fallback to full package
        const pkg2 = run(dir, ['package']);
        sppkg = findSppkg(dir);
        if (pkg2.status !== 0) {
          console.error(`✗ ${name} package failed`);
          console.error(pkg2.stdout?.slice(-5000));
          failed++;
          continue;
        }
      } else if (pkgBuild.status !== 0) {
        console.error(`✗ ${name} package --no-build failed`);
        console.error(pkgBuild.stdout?.slice(-5000));
        failed++;
        continue;
      }
      if (sppkg.length === 0) {
        console.error(`✗ ${name} no .sppkg found`);
        failed++;
        continue;
      }
      for (const p of sppkg) {
        const size = fs.statSync(p).size;
        const header = fs.readFileSync(p).subarray(0, 2).toString('utf8');
        if (header !== 'PK') {
          console.error(`✗ ${name} sppkg not a zip: ${p}`);
          failed++;
          continue;
        }
        console.log(`  ✓ package ${path.relative(dir, p)} (${(size / 1024).toFixed(1)} KiB, ${((Date.now() - pkgStart) / 1000).toFixed(1)}s)`);
      }
    }
  }
  console.log(`\n${failed === 0 ? 'All examples built successfully ✓' : `${failed} example(s) failed ✗`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
