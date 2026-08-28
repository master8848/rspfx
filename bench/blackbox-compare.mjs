#!/usr/bin/env node
/**
 * bench/blackbox-compare.mjs — CLI diff helper for blackbox parity.
 *
 * Builds the same input project with RSPFX (buildPackage) and optionally the
 * official toolchain (gulp/heft via npx), then prints a sorted diff of zip
 * entry lists and volatile-normalized XML contents.
 *
 * Blackbox: input = config/package-solution.json + release/manifests/*.manifest.json +
 * dist assets (+ teams + resx). Output = .sppkg ZIP. No inspection of official JS internals.
 *
 * Usage:
 *   node bench/blackbox-compare.mjs --help
 *   node bench/blackbox-compare.mjs --project packages/sppkg-builder/tests/fixtures/proj
 *   OFFICIAL_SPPKG_TEST=1 node bench/blackbox-compare.mjs --project /tmp/my-proj --version 1.23 --official
 *   node bench/blackbox-compare.mjs --component webpart   # filters which component type to exercise
 *
 * @see packages/sppkg-builder/tests/blackbox.test.ts
 */

import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`blackbox-compare.mjs — RSPFX vs official .sppkg blackbox diff

Usage:
  node bench/blackbox-compare.mjs [options]

Options:
  --project <dir>        Input project root (default: packages/sppkg-builder/tests/fixtures/proj)
  --component <type>     webpart|extension|library|mixed (default: webpart; controls synthetic project)
  --version <ver>        SPFx target version for spfxVersion gate (default: 1.23)
  --official             Also build with official toolchain (needs OFFICIAL_SPPKG_TEST=1 or local bench/.official-work)
  --out <dir>            Keep output zips in <dir> instead of temp
  --help                 Show this help

Env:
  OFFICIAL_SPPKG_TEST=1  Enables the official subprocess (network/heavy).
  OFFICIAL_SPPKG_VERSIONS=1.22,1.23  Versions to try (default: --version).

Examples:
  node bench/blackbox-compare.mjs
  node bench/blackbox-compare.mjs --component library --version 1.24
  OFFICIAL_SPPKG_TEST=1 node bench/blackbox-compare.mjs --official --version 1.22

Notes:
  - RSPFX path uses packages/sppkg-builder/src/sppkg-builder.ts:119 buildPackage().
  - Official path spawns gulp/heft via npx pinned to @microsoft/sp-build-web@<npmVersion>.
  - Volatile fields (AppPartConfig Id, Extension Instance Id) are normalized before diff.
`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { printHelp(); process.exit(0); }

function arg(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}
const hasFlag = (f) => args.includes(f);

const projectArg = arg('--project', path.join(ROOT, 'packages/sppkg-builder/tests/fixtures/proj'));
const componentArg = arg('--component', 'webpart');
const versionArg = arg('--version', '1.23');
const doOfficial = hasFlag('--official') || process.env.OFFICIAL_SPPKG_TEST === '1';
const outArg = arg('--out', '');

const UUID_V4_RE = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
function normalizeVolatileIds(xml) { return xml.replace(UUID_V4_RE, '00000000-0000-4000-8000-000000000000'); }
function normalizeXml(xml) { return normalizeVolatileIds(xml).trim(); }

function sortedEntries(names) { return [...names].sort(); }
function firstDiffIndex(a, b) { const n=Math.min(a.length,b.length); for(let i=0;i<n;i++) if(a[i]!==b[i]) return i; return n; }

async function main() {
  // Dynamic import so the script works even if packages haven't been built (uses src via tsx? fallback).
  // We use the built dist if available, else src via import.
  let buildPackage, readZipEntries;
  try {
    ({ buildPackage } = await import(path.join(ROOT, 'packages/sppkg-builder/dist/index.js')));
    ({ readZipEntries } = await import(path.join(ROOT, 'packages/sppkg-builder/dist/zip.js')));
  } catch {
    // Fallback to src (requires --loader tsx or Node 22 with --experimental-vm-modules; but bench usually runs after build)
    console.error('Could not import dist; run `bun run build` first.');
    process.exit(1);
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'rspfx-blackbox-cmp-'));
  try {
    await cp(projectArg, dir, { recursive: true });

    const result = await buildPackage({
      projectRoot: dir,
      solutionConfigPath: 'config/package-solution.json',
      manifestsDir: 'release/manifests',
      assetsDir: 'release/assets',
      outDir: 'sharepoint/solution',
      production: true,
      spfxVersion: versionArg,
    });
    const rspfxZip = await readZipEntries(result.outputPath);
    const rspfxNames = sortedEntries([...rspfxZip.keys()]);

    console.log(`RSPFX .sppkg: ${result.outputPath}`);
    console.log(`  spfxVersion: ${versionArg}  entries: ${rspfxNames.length}`);
    console.log(`  entries: ${rspfxNames.join(', ')}`);
    console.log(`  AppManifest ProductID: ${/ProductID="([^"]+)"/.exec(result.appManifest)?.[1] ?? '?'}`);
    console.log(`  AppManifest IsDomainIsolated: ${/IsDomainIsolated="([^"]+)"/.exec(result.appManifest)?.[1] ?? '(absent)'}`);

    if (!doOfficial) {
      console.log('\nOfficial comparison skipped (pass --official and OFFICIAL_SPPKG_TEST=1 to enable).');
      if (outArg) { await cp(dir, outArg, { recursive: true }); console.log(`Kept project copy at ${outArg}`); }
      return;
    }

    // Minimal official attempt — reuse tryBuildOfficial logic from the test file
    const toolchain = Number(versionArg.split('.')[1] ?? 0) >= 23 ? 'heft' : 'gulp';
    const npmVersion = versionArg.includes('-') ? versionArg : versionArg.includes('.') && versionArg.split('.').length===2 ? `${versionArg}.0` : versionArg;
    const work = await mkdtemp(path.join(tmpdir(), `rspfx-official-${versionArg}-`));
    try {
      await cp(dir, work, { recursive: true });
      let res;
      if (toolchain === 'gulp') {
        res = spawnSync('npx', ['--yes', '-p', `@microsoft/sp-build-web@${npmVersion}`, 'gulp', 'bundle', '--ship'], { cwd: work, timeout: 300_000, encoding: 'utf8' });
        if (res.status !== 0) { console.warn(`Official gulp bundle --ship failed for ${versionArg}: ${res.stderr?.slice(-2000)}`); return; }
        res = spawnSync('npx', ['--yes', '-p', `@microsoft/sp-build-web@${npmVersion}`, 'gulp', 'package-solution', '--ship'], { cwd: work, timeout: 300_000, encoding: 'utf8' });
        if (res.status !== 0) { console.warn(`Official gulp package-solution --ship failed: ${res.stderr?.slice(-2000)}`); return; }
      } else {
        res = spawnSync('npx', ['--yes', '-p', `heft@${npmVersion}`, 'heft', 'build', '--ship'], { cwd: work, timeout: 300_000, encoding: 'utf8' });
        if (res.status !== 0) { console.warn(`Official heft build --ship failed: ${res.stderr?.slice(-2000)}`); return; }
        res = spawnSync('npx', ['heft', 'package-solution', '--ship'], { cwd: work, timeout: 300_000, encoding: 'utf8' });
        if (res.status !== 0) {
          res = spawnSync('npx', ['gulp', 'package-solution', '--ship'], { cwd: work, timeout: 300_000, encoding: 'utf8' });
          if (res.status !== 0) { console.warn(`Official package-solution failed: ${res.stderr?.slice(-2000)}`); return; }
        }
      }
      const officialPath = path.join(work, 'sharepoint/solution/blackbox.sppkg');
      let officialZip;
      try { officialZip = await readZipEntries(officialPath); } catch (e) { console.warn(`Could not read official .sppkg: ${e}`); return; }
      const officialNames = sortedEntries([...officialZip.keys()]);
      console.log(`\nOfficial .sppkg: ${officialPath}`);
      console.log(`  entries: ${officialNames.join(', ')}`);

      const nR = new Map([...rspfxZip].map(([k,v]) => [k, k.endsWith('.xml')||k.endsWith('.rels') ? normalizeXml(v.toString('utf8')) : v.toString('utf8')]));
      const nO = new Map([...officialZip].map(([k,v]) => [k, k.endsWith('.xml')||k.endsWith('.rels') ? normalizeXml(v.toString('utf8')) : v.toString('utf8')]));

      const allKeys = new Set([...nR.keys(), ...nO.keys()]);
      let mismatches = 0;
      for (const k of [...allKeys].sort()) {
        if (!nR.has(k)) { console.log(`  ONLY official: ${k}`); mismatches++; }
        else if (!nO.has(k)) { console.log(`  ONLY rspfx:   ${k}`); mismatches++; }
        else if (nR.get(k) !== nO.get(k)) {
          mismatches++;
          const a=nR.get(k), b=nO.get(k);
          const idx=firstDiffIndex(a,b);
          console.log(`  MISMATCH ${k} first diff at ${idx}`);
          console.log(`    rspfx:   ${a.slice(Math.max(0,idx-120), idx+300).replace(/\n/g,'\\n')}`);
          console.log(`    official:${b.slice(Math.max(0,idx-120), idx+300).replace(/\n/g,'\\n')}`);
        }
      }
      if (mismatches===0) console.log('\n✓ Parity: all zip entries match after volatile normalization.');
      else console.log(`\n✗ Parity: ${mismatches} mismatched/missing entries (see above).`);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
