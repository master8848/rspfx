#!/usr/bin/env node
/**
 * RSPFx vs official SPFx toolchain benchmark — no dependencies beyond Node (ESM).
 *
 * Benchmarks the OFFICIAL SharePoint toolchain on minimal vanilla projects:
 *   --tool gulp        SPFx 1.22 skeleton (gulp + webpack):  gulp bundle --production + gulp serve --nobrowser
 *   --tool heft        SPFx 1.23 skeleton (gulp + Heft):     gulp bundle --production + gulp serve --nobrowser
 *   --tool fast-serve  SPFx 1.22 skeleton + spfx-fast-serve: gulp fast-serve (dev only — no build metric)
 * Default: all three tools, sequentially.
 *
 * The rspfx side is measured by spawning `bench/bench.mjs` on examples/shadcn
 * (skip with BENCH_OFFICIAL_ONLY=1).
 *
 * Usage:
 *   node bench/compare-official.mjs                 # all tools + rspfx comparison
 *   node bench/compare-official.mjs --tool fast-serve
 *   node bench/compare-official.mjs --build-only    # skip serve legs
 *
 * Env knobs:
 *   BENCH_RUNS=3                    recompile iterations (default 3)
 *   BENCH_OFFICIAL_FRESH=1          re-copy skeletons + reinstall node_modules
 *   BENCH_OFFICIAL_SKIP_INSTALL=1   never install (fail if node_modules missing)
 *   BENCH_OFFICIAL_PKG_MGR=pnpm|npm package manager for official projects (default pnpm)
 *   BENCH_OFFICIAL_ONLY=1           skip the rspfx bench.mjs comparison leg
 *
 * First run installs the official toolchain into bench/.official-work/ (minutes).
 * Port 4321 must be free for the serve legs.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKELETONS = path.join(ROOT, 'bench', 'skeletons');
const WORK_ROOT = path.join(ROOT, 'bench', '.official-work');
const RSPFX_BENCH = path.join(ROOT, 'bench', 'bench.mjs');
const RSPFX_PROJECT = path.join(ROOT, 'examples', 'shadcn');
const BUNDLE_NAME = 'hello-web-part.js';
const SRC_FILE = path.join('src', 'webparts', 'hello', 'HelloWebPart.ts');
const SETTLE_MS = 300;
const SLEEP_MS = 20;
const INSTALL_TIMEOUT_MS = 30 * 60 * 1000;
const COLD_TIMEOUT_MS = 600_000;
const RECOMPILE_TIMEOUT_MS = 180_000;
const BUILD_TIMEOUT_MS = 600_000;

const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const FRESH = process.env.BENCH_OFFICIAL_FRESH === '1';
const SKIP_INSTALL = process.env.BENCH_OFFICIAL_SKIP_INSTALL === '1';
const PKG_MGR = process.env.BENCH_OFFICIAL_PKG_MGR ?? 'pnpm';
const OFFICIAL_ONLY = process.env.BENCH_OFFICIAL_ONLY === '1';

const TOOLS = {
  gulp: { skeleton: 'gulp', spfx: '1.22', build: true, serve: ['gulp', 'serve', '--nobrowser'] },
  heft: { skeleton: 'heft', spfx: '1.23', build: true, serve: ['gulp', 'serve', '--nobrowser'] },
  'fast-serve': { skeleton: 'gulp', spfx: '1.22', build: false, serve: ['gulp', 'fast-serve'] }
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node bench/compare-official.mjs [--tool gulp|heft|fast-serve] [--build-only|--serve-only]`);
  console.log(`Env: BENCH_RUNS, BENCH_OFFICIAL_FRESH, BENCH_OFFICIAL_SKIP_INSTALL, BENCH_OFFICIAL_PKG_MGR, BENCH_OFFICIAL_ONLY`);
  process.exit(0);
}
const toolArg = args.find((a) => a.startsWith('--tool='))?.slice(7) ?? args.find((a) => a === '--tool') ? args[args.indexOf('--tool') + 1] : undefined;
const buildOnly = args.includes('--build-only');
const serveOnly = args.includes('--serve-only');
const tools = toolArg ? [toolArg] : Object.keys(TOOLS);
for (const t of tools) {
  if (!TOOLS[t]) {
    console.error(`Unknown tool: ${t}. Valid: ${Object.keys(TOOLS).join(', ')}`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function spawnCapture(cmd, cwd, env = {}) {
  const child = spawn(cmd[0], cmd.slice(1), { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const out = { text: '', err: '' };
  child.stdout.on('data', (d) => (out.text = (out.text + d).slice(-65536)));
  child.stderr.on('data', (d) => (out.err = (out.err + d).slice(-65536)));
  child.on('error', (e) => (out.err += `[spawn error] ${e.message}\n`));
  return { child, out };
}

function tail(out, n = 800) {
  return out.text.slice(-n) + '\n--- stderr ---\n' + out.err.slice(-n);
}

async function waitExit(child, out, timeoutMs, what) {
  if (child.exitCode !== null) {
    return child.exitCode;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(-1);
    }, timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code ?? -1);
    });
  }).then((code) => {
    if (code === -1) {
      throw new Error(`${what}: timed out after ${timeoutMs}ms\n${tail(out)}`);
    }
    return code;
  });
}

async function killChild(child) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    if (child.exitCode !== null || child.signalCode) {
      finish();
      return;
    }
    child.once('exit', finish);
    try {
      child.kill('SIGTERM');
    } catch {
      finish();
      return;
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      finish();
    }, 8000).unref();
  });
}

function bundlePath(work) {
  return path.join(work, 'dist', BUNDLE_NAME);
}

async function waitForStableHash(work, timeoutMs, what) {
  const start = performance.now();
  let stableSince = -1;
  while (performance.now() - start < timeoutMs) {
    const file = bundlePath(work);
    if (fs.existsSync(file)) {
      const h = sha256(file);
      if (h && h === stableSince) {
        if (performance.now() - start - (stableSince ? 0 : 0) >= SETTLE_MS) {
          return performance.now();
        }
        await sleep(SLEEP_MS);
        continue;
      }
      stableSince = h;
    } else {
      stableSince = -1;
    }
    await sleep(SLEEP_MS);
  }
  throw new Error(`${what}: dist/${BUNDLE_NAME} never became stable (${timeoutMs}ms timeout)`);
}

async function waitForHashChange(work, baseline, timeoutMs, what) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const file = bundlePath(work);
    if (fs.existsSync(file) && sha256(file) !== baseline) {
      return performance.now();
    }
    await sleep(SLEEP_MS);
  }
  throw new Error(`${what}: bundle hash never changed (${timeoutMs}ms timeout)`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
}

function rmProjectOutputs(work) {
  for (const dir of ['dist', 'release', 'lib', 'temp', 'sharepoint', 'node_modules/.cache']) {
    fs.rmSync(path.join(work, dir), { recursive: true, force: true });
  }
}

function ensureProject(skeleton) {
  const work = path.join(WORK_ROOT, skeleton);
  const needsCopy = FRESH || !fs.existsSync(work) || !fs.existsSync(path.join(work, 'package.json'));
  if (needsCopy) {
    fs.rmSync(work, { recursive: true, force: true });
    copyDir(path.join(SKELETONS, skeleton), work);
    copyDir(path.join(SKELETONS, 'shared'), work);
    rmProjectOutputs(work);
  }
  const hasModules = fs.existsSync(path.join(work, 'node_modules'));
  if (!hasModules || (FRESH && !SKIP_INSTALL)) {
    if (SKIP_INSTALL) {
      throw new Error(`node_modules missing in ${work} and BENCH_OFFICIAL_SKIP_INSTALL=1 — run without it to install the official toolchain (first run: minutes).`);
    }
    console.log(`\nInstalling official toolchain for ${skeleton} skeleton (${PKG_MGR}) — first run takes minutes...`);
    const { child, out } = spawnCapture([PKG_MGR, 'install'], work);
    const code = await waitExit(child, out, INSTALL_TIMEOUT_MS, `install (${PKG_MGR} install)`);
    if (code !== 0) {
      throw new Error(`install failed (exit ${code}).\n${tail(out)}`);
    }
  }
  return work;
}

function measureBuild(work, label) {
  const start = performance.now();
  const gulp = path.join(work, 'node_modules', '.bin', 'gulp');
  const { child, out } = spawnCapture([gulp, 'bundle', '--production'], work, { NODE_ENV: 'production' });
  return waitExit(child, out, BUILD_TIMEOUT_MS, `${label} gulp bundle --production`)
    .then((code) => {
      if (code !== 0) {
        throw new Error(`${label}: gulp bundle --production failed (exit ${code}).\n${tail(out)}`);
      }
      return Math.round(performance.now() - start);
    });
}

async function measureServe(work, serveCmd, label) {
  const srcFile = path.join(work, SRC_FILE);
  const originalBytes = fs.readFileSync(srcFile);
  let restored = false;
  let server = null;
  try {
    rmProjectOutputs(work);
    const start = performance.now();
    const { child, out } = spawnCapture(serveCmd, work);
    server = child;
    await waitForStableHash(work, COLD_TIMEOUT_MS, `${label} cold start`);
    const coldStartMs = Math.round(performance.now() - start);

    const recompileMs = [];
    for (let run = 1; run <= RUNS; run++) {
      await sleep(SETTLE_MS);
      const h0 = sha256(bundlePath(work));
      const marker = `\n// rspfx-official-bench run ${run} ${Date.now()} ${Math.random()}\n`;
      fs.appendFileSync(srcFile, marker);
      const touchAt = performance.now();
      const changedAt = await waitForHashChange(work, h0, RECOMPILE_TIMEOUT_MS, `${label} recompile run ${run}`);
      recompileMs.push(Math.round(changedAt - touchAt));
      fs.writeFileSync(srcFile, originalBytes);
    }
    restored = true;
    if (!fs.readFileSync(srcFile).equals(originalBytes)) {
      throw new Error(`${label}: source file not restored byte-for-byte`);
    }
    const eaddrinuse = out.err.includes('EADDRINUSE') || out.text.includes('EADDRINUSE');
    return { coldStartMs, recompileMs, portConflict: eaddrinuse, log: tail(out) };
  } finally {
    if (!restored) {
      try {
        fs.writeFileSync(srcFile, originalBytes);
      } catch {
        /* nothing else to do */
      }
    }
    if (server) {
      await killChild(server);
    }
  }
}

function medianSorted(list) {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function pad(s, n) {
  const str = String(s);
  return str + ' '.repeat(Math.max(0, n - str.length));
}

async function runRspfxLeg() {
  const start = performance.now();
  const { child, out } = spawnCapture([process.execPath, RSPFX_BENCH, RSPFX_PROJECT], ROOT, { BENCH_RUNS: String(RUNS) });
  const code = await waitExit(child, out, 900_000, 'rspfx bench.mjs');
  const match = out.text.match(/BENCH_RESULT project=(\S+) cold_start_ms=(\d+) recompile_ms=\[([^\]]+)\] .*? full_build_ms=(\d+)/);
  if (code !== 0 || !match) {
    throw new Error(`rspfx bench.mjs failed (exit ${code})\n${tail(out)}`);
  }
  const recompiles = match[3].split(',').map((n) => Number(n.trim()));
  return {
    name: `rspfx (${match[1]})`,
    cold: Number(match[2]),
    recompileMin: Math.min(...recompiles),
    recompileMedian: medianSorted(recompiles),
    build: Number(match[4]),
    note: `bench.mjs took ${Math.round((performance.now() - start) / 1000)}s`
  };
}

async function main() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeMinor = Number(process.versions.node.split('.')[1]);
  if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 19)) {
    console.warn(`WARNING: SPFx 1.23 (heft) needs Node 20.19+/22+ — running on ${process.version}; serve legs may fail.`);
  }

  const results = [];
  for (const tool of tools) {
    const spec = TOOLS[tool];
    console.log(`\n=== ${tool} (official SPFx ${spec.spfx}, ${spec.skeleton} skeleton) ===`);
    const work = ensureProject(spec.skeleton);
    const row = { name: `official ${tool} (SPFx ${spec.spfx})`, cold: null, recompileMin: null, recompileMedian: null, build: null, note: '' };
    if (spec.build && !serveOnly) {
      row.build = await measureBuild(work, tool);
      console.log(`full build (gulp bundle --production): ${row.build} ms`);
    }
    if (spec.serve && !buildOnly) {
      const gulp = path.join(work, 'node_modules', '.bin', 'gulp');
      const serve = await measureServe(work, [gulp, ...spec.serve], tool);
      row.cold = serve.coldStartMs;
      row.recompileMin = Math.min(...serve.recompileMs);
      row.recompileMedian = medianSorted(serve.recompileMs);
      console.log(`cold start: ${row.cold} ms | recompile min/median: ${row.recompileMin} / ${row.recompileMedian} ms`);
      if (serve.portConflict) {
        row.note = 'PORT 4321 CONFLICT — another dev server was running';
      }
    }
    results.push(row);
  }

  if (!OFFICIAL_ONLY) {
    console.log(`\n=== rspfx comparison (${RSPFX_PROJECT}) ===`);
    const rspfx = await runRspfxLeg();
    results.unshift(rspfx);
  }

  console.log(`\n${'='.repeat(88)}\nRSPFX vs official SPFx toolchain — ${new Date().toISOString()}\n${'='.repeat(88)}`);
  console.log(pad('toolchain', 34) + pad('cold start (ms)', 18) + pad('recompile min (ms)', 20) + pad('recompile median (ms)', 22) + pad('full build (ms)', 18) + 'notes');
  console.log('-'.repeat(88));
  for (const r of results) {
    console.log(
      pad(r.name, 34) +
        pad(r.cold === null ? '—' : String(r.cold), 18) +
        pad(r.recompileMin === null ? '—' : String(r.recompileMin), 20) +
        pad(r.recompileMedian === null ? '—' : String(r.recompileMedian), 22) +
        pad(r.build === null ? '—' : String(r.build), 18) +
        (r.note || '')
    );
  }
  console.log('-'.repeat(88));
  console.log(`Recompile runs: ${RUNS} | official workdir: ${WORK_ROOT} (keep node_modules; remove to force reinstall)`);
  console.log('NOTE: dist/, release/, lib/ and temp/ exist in the official workdirs after a run — delete bench/.official-work to reset.');
  process.exit(0);
}

main().catch((error) => {
  console.error(`\nbench failed: ${error.message}`);
  process.exit(1);
});
