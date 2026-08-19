#!/usr/bin/env node
/**
 * Publish pipeline: builds, tests, bumps, and publishes every publishable
 * rspfx package (packages/* + apps/cli) to npm — NEVER examples.
 *
 * Safety rails:
 *   - hard abort if anything under examples/ or apps/playground is publishable
 *   - gates: clean git tree, `pnpm build`, `pnpm test` (unless --skip-checks)
 *   - consistent version bump across the whole set (default: patch)
 *   - publishes in dependency order, one package at a time
 *   - verifies each version lands on the registry (retried)
 *   - already-published versions are skipped, so re-runs resume naturally
 *
 * Usage:
 *   node scripts/publish.mjs [--dry-run] [--version 0.2.0] [--patch|--minor|--major]
 *                            [--skip-checks] [--otp <code>] [--no-commit]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const DRY_RUN = args.includes('--dry-run');
const SKIP_CHECKS = args.includes('--skip-checks');
const NO_COMMIT = args.includes('--no-commit');
const versionFlag = flagValue('--version');
const bumpKind = args.includes('--major') ? 'major' : args.includes('--minor') ? 'minor' : 'patch';
const otp = flagValue('--otp');

function flagValue(flag) {
  const eq = args.find((a) => a.startsWith(flag + '='));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--')) return args[i + 1];
  return undefined;
}

function fatal(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function run(cmd, argsList, opts = {}) {
  const result = spawnSync(cmd, argsList, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    fatal(`command failed: ${cmd} ${argsList.join(' ')} (exit ${result.status ?? 'signal'})`);
  }
}

/** Packages under examples/ or apps/playground are NEVER publishable. */
function assertNoExamplePackages() {
  const forbiddenRoots = ['examples', path.join('apps', 'playground')];
  const offenders = [];
  for (const root of forbiddenRoots) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgJson = path.join(dir, entry.name, 'package.json');
      if (!fs.existsSync(pkgJson)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
      if (pkg.private !== true) {
        offenders.push(`${pkg.name} (${path.join(root, entry.name)})`);
      }
    }
  }
  if (offenders.length > 0) {
    fatal(
      `Refusing to publish: example/playground packages are not marked private:\n  ${offenders.join('\n  ')}\n` +
        'Set "private": true in those package.json files.'
    );
  }
}

function collectPublishSet() {
  const set = new Map();
  for (const root of ['packages', 'apps']) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgJsonPath = path.join(dir, entry.name, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.private === true) continue;
      if (typeof pkg.name !== 'string' || !pkg.name.startsWith('@mbsks/rspfx-')) {
        fatal(`Unexpected publishable package ${pkg.name} in ${dir}/${entry.name}`);
      }
      set.set(pkg.name, { name: pkg.name, dir: path.join(dir, entry.name), version: pkg.version });
    }
  }
  if (set.size === 0) {
    fatal('No publishable packages found.');
  }
  return set;
}

function dependencyOrder(set) {
  const names = [...set.keys()];
  const depsOf = (name) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(set.get(name).dir, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
    return Object.keys(deps).filter((dep) => set.has(dep));
  };
  const order = [];
  const visited = new Set();
  const visiting = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    if (visiting.has(name)) fatal(`Circular dependency detected involving ${name}`);
    visiting.add(name);
    for (const dep of depsOf(name)) visit(dep);
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  };
  for (const name of names) visit(name);
  return order;
}

function bumpVersion(current, kind) {
  const base = current.split('-')[0].split('+')[0];
  const [major, minor, patch] = base.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

function isPublished(name, version) {
  try {
    const out = execSync(`npm view ${JSON.stringify(name + '@' + version)} version`, {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    return out === version;
  } catch {
    return false;
  }
}

function verifyPublished(name, version) {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (isPublished(name, version)) return true;
    sleepSync(2000);
  }
  return false;
}

// ─── 1. safety + gates ───────────────────────────────────────────────────────
assertNoExamplePackages();
const set = collectPublishSet();
const versions = new Set([...set.values()].map((p) => p.version));
if (versions.size > 1) {
  fatal(`Publishable packages have inconsistent versions: ${[...versions].join(', ')} — bump them all to one version first.`);
}
const currentVersion = [...versions][0];
// Resume detection: a partially published release (previous run failed
// halfway) stays on the same version; a fully published one gets bumped.
const liveAtCurrent = [...set.values()].filter((pkg) => isPublished(pkg.name, currentVersion)).length;
const resumed = liveAtCurrent > 0 && liveAtCurrent < set.size;
const targetVersion = versionFlag ?? (resumed ? currentVersion : bumpVersion(currentVersion, bumpKind));

console.log(`Publishing ${set.size} packages (${DRY_RUN ? 'DRY RUN — nothing will be published' : 'LIVE'})`);
console.log(`  current: ${currentVersion} → target: ${targetVersion}${resumed ? ' (resume — version already on the registry)' : ''}\n`);
console.log([...set.values()].map((p) => `  • ${p.name}@${targetVersion}`).sort().join('\n'));
console.log('');
console.log('  Excluded (private/example): examples/*, apps/playground\n');

if (DRY_RUN) {
  console.log('Dry run complete. Nothing was changed or published.');
  process.exit(0);
}

if (!SKIP_CHECKS) {
  console.log('─ gates ───────────────────────────────────────────────────────────');
  const dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
  if (dirty) {
    fatal(`Working tree is not clean. Commit or stash first:\n${dirty}`);
  }
  console.log('  ✓ git tree clean');
  run('pnpm', ['build'], { cwd: ROOT });
  run('pnpm', ['--filter', '@mbsks/rspfx-cli', 'build'], { cwd: ROOT });
  run('pnpm', ['test'], { cwd: ROOT });
  console.log('');
}

// ─── 2. version bump (all publishable packages + root) ───────────────────────
console.log('─ version bump ─────────────────────────────────────────────────────');
const changedFiles = [];
for (const pkg of set.values()) {
  const pkgJsonPath = path.join(pkg.dir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  pkgJson.version = targetVersion;
  writeJson(pkgJsonPath, pkgJson);
  changedFiles.push(pkgJsonPath);
  console.log(`  ${pkg.name}: ${currentVersion} → ${targetVersion}`);
}
const rootPkgPath = path.join(ROOT, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
rootPkg.version = targetVersion;
writeJson(rootPkgPath, rootPkg);
changedFiles.push(rootPkgPath);
console.log(`  rspfx (root): ${currentVersion} → ${targetVersion}`);

// ─── 3. publish in dependency order ──────────────────────────────────────────
console.log('\n─ publish ──────────────────────────────────────────────────────────');
const order = dependencyOrder(set);
const published = [];
const unverified = [];
const failed = [];
for (const name of order) {
  const pkg = set.get(name);
  if (isPublished(name, targetVersion)) {
    console.log(`  = ${name}@${targetVersion} already published — skipped`);
    published.push(name);
    continue;
  }
  console.log(`  → ${name}@${targetVersion}`);
  const publishArgs = ['publish', '--no-git-checks', '--access', 'public'];
  if (otp) publishArgs.push('--otp', otp);
  // Pipe stdin so pnpm never shows interactive prompts (branch check, OTP) —
  // a missing OTP surfaces as a hard error instead of a hung prompt.
  const publishOnce = () =>
    spawnSync('pnpm', publishArgs, { cwd: pkg.dir, stdio: ['pipe', 'inherit', 'inherit'] }).status ?? 1;
  let status = publishOnce();
  for (let attempt = 1; status !== 0 && attempt < 4; attempt++) {
    // npm registry races (E409 packument) are transient — back off and retry.
    console.log(`    (attempt ${attempt + 1}/4 after exit ${status})`);
    sleepSync(4000);
    status = publishOnce();
  }
  if (status !== 0) {
    failed.push(name);
    console.error(`  ✗ ${name} failed (exit ${status})`);
    break;
  }
  published.push(name);
  if (verifyPublished(name, targetVersion)) {
    console.log(`  ✓ ${name}@${targetVersion} verified on npm`);
  } else {
    // npm's read-after-write can lag well past a successful publish —
    // defer the verdict to the final sweep instead of aborting the run.
    unverified.push(name);
    console.log(`  ~ ${name}@${targetVersion} published (registry visibility lagging — will re-check)`);
  }
}

// Final sweep: give lagging packuments time to settle before declaring failure.
for (const name of unverified) {
  if (verifyPublished(name, targetVersion)) {
    console.log(`  ✓ ${name}@${targetVersion} verified on npm (final sweep)`);
  } else {
    failed.push(name);
    console.error(`  ✗ ${name}@${targetVersion} still not visible on the registry`);
  }
}

if (failed.length > 0) {
  console.error(
    `\n✗ ${failed.length} package(s) failed to publish: ${failed.join(', ')}.\n` +
      `Already-published packages were skipped, so re-running the script resumes automatically.`
  );
  process.exit(1);
}

// ─── 4. commit the bump ──────────────────────────────────────────────────────
if (!NO_COMMIT) {
  run('git', ['add', ...changedFiles], { cwd: ROOT });
  const staged = execSync('git diff --cached --name-only', { cwd: ROOT }).toString().trim();
  if (staged) {
    run('git', ['commit', '-m', `chore: bump all publishable packages to v${targetVersion}`], { cwd: ROOT });
    console.log(`\nCommitted version bump (v${targetVersion}). Run "git push" to share it.`);
  } else {
    console.log('\nVersion bump already committed — skipping commit.');
  }
}

console.log(`\n✓ Published ${published.length}/${set.size} packages at v${targetVersion}.`);
