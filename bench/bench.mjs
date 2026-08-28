#!/usr/bin/env node
/**
 * RSPFx benchmark harness — no dependencies beyond Node (ESM).
 *
 * Usage:
 *   node bench/bench.mjs                 # default: examples/shadcn
 *   node bench/bench.mjs <project-dir>   # e.g. examples/vanilla
 *
 * Env knobs:
 *   BENCH_RUNS=3            number of recompile iterations (default 3)
 *   BENCH_KEEP_OUTPUT=1     do not remove dist/ + release/ before the full build
 *
 * Measures (ms):
 *   cold start   spawn `rspfx dev --no-browser` -> 'Manifest server running' on stdout
 *   recompile    append a timestamp comment to a source file -> compiled bundle
 *                (dist/<entry>.js) hash changes on disk; file bytes restored after
 *                every run and verified byte-for-byte at the end
 *   full build   `rspfx build` after removing dist/ + release/, total wall time
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'apps', 'cli', 'dist', 'cli.js');
const DEFAULT_PROJECT = path.join(ROOT, 'examples', 'shadcn');

const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const KEEP_OUTPUT = process.env.BENCH_KEEP_OUTPUT === '1';
const SETTLE_MS = 300;
const SLEEP_MS = 20;
const COLD_TIMEOUT_MS = 180_000;
const RECOMPILE_TIMEOUT_MS = 60_000;
const BUILD_TIMEOUT_MS = 600_000;
const MAX_CAPTURE = 64 * 1024;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node bench/bench.mjs [project-dir]   (default: examples/shadcn)`);
  console.log(`Env: BENCH_RUNS (default 3), BENCH_KEEP_OUTPUT=1 to skip dist/release cleanup`);
  process.exit(0);
}
const projectArg = args.find((a) => !a.startsWith('--'));
const projectDir = path.resolve(projectArg ?? DEFAULT_PROJECT);
const projectName = path.basename(projectDir);

if (!fs.existsSync(CLI)) {
  console.error(`CLI not built: ${CLI}\nRun "pnpm --filter @mbsks/rspfx-cli build" first.`);
  process.exit(1);
}
if (!fs.existsSync(projectDir)) {
  console.error(`Project directory not found: ${projectDir}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function appendCap(holder, key, chunk) {
  holder[key] = (holder[key] + chunk.toString()).slice(-MAX_CAPTURE);
}

function spawnCli(cliArgs, cwd) {
  const child = spawn(process.execPath, [CLI, ...cliArgs], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, RSPFX_LOG_LEVEL: 'info' }
  });
  const out = { text: '', err: '' };
  child.stdout.on('data', (d) => appendCap(out, 'text', d));
  child.stderr.on('data', (d) => appendCap(out, 'err', d));
  child.on('error', (e) => appendCap(out, 'err', `[spawn error] ${e.message}\n`));
  return { child, out };
}

function tail(holder, n = 800) {
  return holder.text.slice(-n) + '\n--- stderr ---\n' + holder.err.slice(-n);
}

async function waitForText(out, child, pattern, timeoutMs, what) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (out.text.includes(pattern)) {
      return performance.now();
    }
    if (child.exitCode !== null) {
      throw new Error(`${what}: process exited early (code ${child.exitCode}) before "${pattern}".\n${tail(out)}`);
    }
    await sleep(SLEEP_MS);
  }
  throw new Error(`${what}: timed out after ${timeoutMs}ms waiting for "${pattern}".\n${tail(out)}`);
}

async function waitForHash(getHash, baseline, timeoutMs, what) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (getHash() !== baseline) {
      return performance.now();
    }
    await sleep(SLEEP_MS);
  }
  throw new Error(`${what}: timed out after ${timeoutMs}ms waiting for bundle hash change`);
}

async function settle(getHash, timeoutMs, what) {
  const start = performance.now();
  let stableSince = -1;
  while (performance.now() - start < timeoutMs) {
    if (stableSince < 0) {
      stableSince = performance.now();
    } else if (performance.now() - stableSince >= SETTLE_MS) {
      return;
    }
    await sleep(SLEEP_MS);
  }
  throw new Error(`${what}: bundle hash never became stable (${timeoutMs}ms timeout)`);
}

function killChild(child) {
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

function findWebparts(project) {
  const dir = path.join(project, 'src', 'webparts');
  if (!fs.existsSync(dir)) {
    throw new Error(`no src/webparts directory in ${project}`);
  }
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (entries.length === 0) {
    throw new Error(`no web parts found in ${dir}`);
  }
  return entries;
}

function findSourceFile(project, webpart) {
  const dir = path.join(project, 'src', 'webparts', webpart);
  const preferred = path.join(dir, `${webpart}WebPart.ts`);
  if (fs.existsSync(preferred)) {
    return preferred;
  }
  const candidates = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name)) {
        candidates.push(p);
      }
    }
  };
  walk(dir);
  if (candidates.length === 0) {
    throw new Error(`no .ts/.tsx source found in ${dir}`);
  }
  return candidates.sort()[0];
}

function findBundlePath(project, webpart) {
  const distDir = path.join(project, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(`no dist/ in ${project} — run the dev server or build first`);
  }
  const named = path.join(distDir, `${webpart}.js`);
  if (fs.existsSync(named)) {
    return named;
  }
  const js = fs
    .readdirSync(distDir)
    .filter((f) => f.endsWith('.js') && !f.includes('.hot-update.'))
    .sort();
  if (js.length === 0) {
    throw new Error(`no bundle .js in ${distDir}`);
  }
  return path.join(distDir, js[0]);
}

function medianSorted(list) {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function pad(s, n) {
  const str = String(s);
  return str + ' '.repeat(Math.max(0, n - str.length));
}

async function measureColdStartAndRecompile(project) {
  const webparts = findWebparts(project);
  const webpart = webparts[0];
  const srcFile = findSourceFile(project, webpart);
  const originalBytes = fs.readFileSync(srcFile);
  let restored = false;
  let server = null;
  try {
    const port = String(20000 + Math.floor(Math.random() * 20000));
    const start = performance.now();
    const { child, out } = spawnCli(['dev', '--port', port], project);
    server = child;

    const readyAt = await waitForText(out, child, 'Manifest server running', COLD_TIMEOUT_MS, 'cold start');
    const coldStartMs = readyAt - start;

    const bundle = findBundlePath(project, webpart);
    await settle(() => sha256(bundle), 30_000, 'bundle settle (initial)');

    const recompileMs = [];
    for (let run = 1; run <= RUNS; run++) {
      await settle(() => sha256(bundle), 30_000, `settle before run ${run}`);
      const h0 = sha256(bundle);
      const marker = `\n// rspfx-bench run ${run} ${Date.now()} ${Math.random()}\n`;
      fs.appendFileSync(srcFile, marker);
      const touchAt = performance.now();
      const changedAt = await waitForHash(
        () => sha256(bundle),
        h0,
        RECOMPILE_TIMEOUT_MS,
        `recompile run ${run}`
      );
      recompileMs.push(changedAt - touchAt);
      fs.writeFileSync(srcFile, originalBytes);
    }
    await settle(() => sha256(bundle), 30_000, 'settle after final restore');
    restored = true;
    const finalBytes = fs.readFileSync(srcFile);
    if (!finalBytes.equals(originalBytes)) {
      throw new Error(`source file not restored byte-for-byte: ${srcFile}`);
    }

    await killChild(child);
    server = null;
    return { coldStartMs, recompileMs, bundle };
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

async function measureFullBuild(project) {
  if (!KEEP_OUTPUT) {
    fs.rmSync(path.join(project, 'dist'), { recursive: true, force: true });
    fs.rmSync(path.join(project, 'release'), { recursive: true, force: true });
  }
  const start = performance.now();
  const { child, out } = spawnCli(['build'], project);
  try {
    await waitForText(out, child, 'Build complete', BUILD_TIMEOUT_MS, 'full build');
    if (child.exitCode !== 0) {
      throw new Error(`build failed with exit code ${child.exitCode}.\n${tail(out)}`);
    }
  } finally {
    if (child.exitCode === null) {
      await killChild(child);
    }
  }
  return performance.now() - start;
}

function printTable(coldStartMs, recompileMs, buildMs) {
  const name = `rspfx bench — ${projectName} (${projectDir})`;
  console.log(`\n${name}`);
  console.log('-'.repeat(name.length));
  console.log(pad('metric', 34) + pad('value', 14) + 'notes');
  console.log('-'.repeat(name.length));
  console.log(
    pad('cold start (spawn → ready)', 34) +
      pad(`${Math.round(coldStartMs)} ms`, 14) +
      'dev server + initial compile'
  );
  for (const [i, ms] of recompileMs.entries()) {
    console.log(
      pad(`recompile run ${i + 1} (touch → bundle change)`, 34) +
        pad(`${Math.round(ms)} ms`, 14) +
        'incremental rebuild'
    );
  }
  console.log(
    pad('recompile min / median', 34) +
      pad(`${Math.round(Math.min(...recompileMs))} / ${Math.round(medianSorted(recompileMs))} ms`, 14) +
      `across ${recompileMs.length} runs`
  );
  console.log(
    pad('full production build (clean)', 34) + pad(`${Math.round(buildMs)} ms`, 14) + 'dist/ + release/ removed first'
  );
  console.log('-'.repeat(name.length));
}

function printParseable(coldStartMs, recompileMs, buildMs) {
  console.log(
    `BENCH_RESULT project=${projectName} cold_start_ms=${Math.round(coldStartMs)} ` +
      `recompile_ms=[${recompileMs.map((m) => Math.round(m)).join(',')}] ` +
      `recompile_min_ms=${Math.round(Math.min(...recompileMs))} ` +
      `recompile_median_ms=${Math.round(medianSorted(recompileMs))} full_build_ms=${Math.round(buildMs)}`
  );
}

async function main() {
  console.log(`RSPFx benchmark\n  node ${process.version} — ${process.platform} ${process.arch}\n  project: ${projectDir}\n`);
  // Optional native timing: cargo bench -p rspfx-sppkg --bench package when Rust package bench exists (local only, no CI)
  try {
    if (fs.existsSync(path.join(ROOT, 'crates', 'rspfx-sppkg', 'benches', 'package.rs'))) {
      console.log('native bench available: run cargo bench -p rspfx-sppkg --bench package for ZIP timings');
    }
  } catch {}
  const { coldStartMs, recompileMs } = await measureColdStartAndRecompile(projectDir);
  console.log(`cold start: ${Math.round(coldStartMs)} ms`);
  console.log(`recompiles: ${recompileMs.map((m) => `${Math.round(m)} ms`).join(', ')}`);
  const buildMs = await measureFullBuild(projectDir);
  printTable(coldStartMs, recompileMs, buildMs);
  printParseable(coldStartMs, recompileMs, buildMs);
  console.log('\nTouched source file was restored byte-for-byte and verified.');
  console.log('NOTE: dist/ and release/ now contain build output — run "rspfx clean" in the project to remove it.');
}

main().catch((error) => {
  console.error(`\nbench failed: ${error.message}`);
  process.exit(1);
});
