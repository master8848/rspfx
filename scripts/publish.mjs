#!/usr/bin/env node
/**
 * Publish pipeline: builds, tests, and publishes every publishable
 * rspfx package (packages/* + apps/cli) to npm — NEVER examples.
 * Does NOT bump versions — version is taken as-is from package.json
 * (use `node scripts/prepare-publish.mjs` to bump versions before publishing).
 *
 * Split implementation (optimized):
 *   - publish/graph.mjs   — collect set, dependency graph, levels + cycle hint
 *   - publish/cache.mjs   — build cache (no code changes / no new packages)
 *   - publish/registry.mjs — npm view / publish / verify
 *   - publish/git.mjs     — git dirty resume helpers
 *   - publish/utils.mjs   — run / fatal / bumpVersion (bump used only in prepare script)
 *
 * Safety rails:
 *   - hard abort if anything under examples/ or apps/playground is publishable
 *   - validates dependency graph is acyclic BEFORE any build/publish work;
 *     if cycle exists, prints simple hint (cycle path) and aborts
 *   - publish order guarantees dependencies before dependents via levels
 *   - gates: clean git tree (resume-tolerant), `bun run build`, `bun run test` (unless --skip-checks)
 *     build step is cached — skipped when fingerprint (HEAD + lockfiles + dist) unchanged
 *   - publishes in dependency order, one package at a time, skipping already-published versions
 *   - verifies each version lands on the registry (retried); re-runs resume naturally
 *
 * Usage:
 *   node scripts/publish.mjs [--dry-run] [--version 0.2.0]
 *                            [--tag <dist-tag>] [--skip-checks] [--otp <code>] [--no-build-cache]
 *   Version is not bumped here — run `node scripts/prepare-publish.mjs [--patch|--minor|--major|--version X]` first if you need a bump.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { flagValue, fatal, run } from './publish/utils.mjs';
import { assertNoExamplePackages, collectPublishSet, getPublishOrder, formatLevels } from './publish/graph.mjs';
import { cachePath, readBuildCache, writeBuildCache, checkDistExists, getFingerprint } from './publish/cache.mjs';
import { isPublished, verifyPublished, countPublished, publishPackage } from './publish/registry.mjs';
import { dirtyRaw, isResumeDirtyAllowed } from './publish/git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const DRY_RUN = args.includes('--dry-run');
const SKIP_CHECKS = args.includes('--skip-checks');
const NO_BUILD_CACHE = args.includes('--no-build-cache');
const versionFlag = flagValue(args, '--version');
const explicitNpmTag = flagValue(args, '--tag');
const otp = flagValue(args, '--otp') ?? process.env.RSPFX_NPM_OTP ?? process.env.npm_config_otp ?? process.env.NPM_OTP;
if (flagValue(args, '--otp')) {
  console.warn('Warning: --otp exposes the token in `ps` output; prefer RSPFX_NPM_OTP env var.');
}
if (SKIP_CHECKS && process.env.CI) {
  fatal('--skip-checks is not allowed when CI is set (process.env.CI). Remove the flag or unset CI.');
}

// ─── 1. safety: collect + validate graph BEFORE any heavy work ───────────────
assertNoExamplePackages(ROOT);
const set = collectPublishSet(ROOT);
const versions = new Set([...set.values()].map((p) => p.version));
if (versions.size > 1) {
  fatal(`Publishable packages have inconsistent versions: ${[...versions].join(', ')} — bump them all to one version first.`);
}
const currentVersion = [...versions][0];

// Data structure: which to publish first (levels) + cycle validation upfront.
const { order, levels } = getPublishOrder(set);
console.log(`\nPublish graph: ${set.size} packages, ${levels.length} level(s) (dependencies → dependents)\n`);
console.log(formatLevels(levels));
console.log(`\nPublish order (dependencies always before dependents):\n  ${order.join(' → ')}\n`);

// Target version is current version as-is (no auto bump). Use --version to override.
// Keep live check only for logging / resume hint, but do NOT auto bump.
const _liveAtCurrent = (() => { try { return countPublished(set, currentVersion); } catch { return 0; } })();
const _resumed = _liveAtCurrent > 0 && _liveAtCurrent < set.size;
const targetVersion = versionFlag ?? currentVersion;
const npmTag = explicitNpmTag ?? (targetVersion.includes('-') ? 'next' : 'latest');
const resumed = _resumed;

console.log(`Publishing ${set.size} packages (${DRY_RUN ? 'DRY RUN — nothing will be published' : 'LIVE'})`);
console.log(`  current: ${currentVersion} → target: ${targetVersion} (npm tag: ${npmTag})${resumed ? ' (resume — version already on the registry)' : ''}\n`);
console.log([...set.values()].map((p) => `  • ${p.name}@${targetVersion} --tag ${npmTag}`).sort().join('\n'));
console.log('');
console.log('  Excluded (private/example): examples/*, apps/playground\n');
console.log(`  Changelog: CHANGELOG.md ## [${targetVersion}] + git tag v${targetVersion}\n`);

if (DRY_RUN) {
  console.log('Dry run complete. Nothing was changed or published.\n');
  console.log('┌─ AI AGENT REMINDER ──────────────────────────────────────────────');
  console.log(`│ This was a dry run for v${targetVersion} (npm tag: ${npmTag}).`);
  console.log('│ Before the next real publish, AI agents (and humans) must:');
  console.log(`│   1. Add/update CHANGELOG.md ## [${targetVersion}] - YYYY-MM-DD`);
  console.log('│      with Added/Changed/Fixed sections for this version.');
  console.log(`│   2. Ensure the entry links to git tag v${targetVersion} and npm dist-tag ${npmTag}.`);
  console.log('│   3. Commit the changelog alongside the version bump (scripts/publish.mjs does the bump+commit).');
  console.log('│ See CONTRIBUTING.md#publishing-and-tagging and CHANGELOG.md.');
  console.log('└────────────────────────────────────────────────────────────────');
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    if (!changelog.includes(`## [${targetVersion}]`) && !changelog.includes(`## [Unreleased]`)) {
      console.log(`\n⚠ CHANGELOG.md has no entry for ## [${targetVersion}] (nor Unreleased to promote) — add it before publishing.`);
    } else if (!changelog.includes(`## [${targetVersion}]`)) {
      console.log(`\n⚠ CHANGELOG.md has no ## [${targetVersion}] section yet — promote Unreleased or add the new section before publishing.`);
    } else {
      console.log(`\n✓ CHANGELOG.md already contains ## [${targetVersion}].`);
    }
  } else {
    console.log('\n⚠ CHANGELOG.md not found — create it per CONTRIBUTING.md#changelog-rule.');
  }
  process.exit(0);
}

if (!SKIP_CHECKS) {
  console.log('─ gates ───────────────────────────────────────────────────────────');
  const dirty = dirtyRaw(ROOT);
  if (dirty) {
    if (resumed && isResumeDirtyAllowed(ROOT, set, targetVersion, dirty)) {
      console.log('  ! working tree dirty with version bump (resume) — continuing');
    } else {
      fatal(`Working tree is not clean. Commit or stash first:\n${dirty}`);
    }
  } else {
    console.log('  ✓ git tree clean');
  }

  if (NO_BUILD_CACHE) {
    console.log('  ↻ build cache disabled (--no-build-cache)');
    run('bun', ['run', 'build'], { cwd: ROOT });
    run('bun', ['run', '--filter', '@mbsks/rspfx-cli', 'build'], { cwd: ROOT });
    run('bun', ['run', 'test'], { cwd: ROOT });
  } else {
    const fingerprint = getFingerprint(ROOT, set);
    const cache = readBuildCache(ROOT);
    const distReady = checkDistExists(set);
    if (cache && cache.fingerprint === fingerprint && distReady) {
      console.log(`  ↻ build cache hit (${fingerprint}) — skipping build & test (no code changes, no new packages)`);
      console.log(`    cache: ${path.relative(ROOT, cachePath(ROOT))}`);
    } else {
      if (cache) {
        if (cache.fingerprint !== fingerprint) {
          console.log(`  ↻ build cache miss (cached ${cache.fingerprint ?? 'none'} vs ${fingerprint})`);
        } else if (!distReady) {
          console.log(`  ↻ build cache miss (dist missing)`);
        }
      } else {
        console.log(`  ↻ build cache miss (no cache)`);
      }
      run('bun', ['run', 'build'], { cwd: ROOT });
      run('bun', ['run', '--filter', '@mbsks/rspfx-cli', 'build'], { cwd: ROOT });
      run('bun', ['run', 'test'], { cwd: ROOT });
      writeBuildCache(ROOT, fingerprint);
      console.log(`  ✓ build cache updated (${fingerprint})`);
    }
  }
  console.log('');
}

// Changelog gate (live run, advisory)
{
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    if (!changelog.includes(`## [${targetVersion}]`)) {
      console.log(`\n⚠ CHANGELOG.md has no ## [${targetVersion}] — add it before publishing (see CONTRIBUTING.md#changelog-rule). Continuing anyway.\n`);
    } else {
      console.log(`\n✓ CHANGELOG.md contains ## [${targetVersion}]\n`);
    }
  } else {
    console.log('\n⚠ CHANGELOG.md not found — create it per CONTRIBUTING.md#changelog-rule. Continuing anyway.\n');
  }
}

// ─── 2. publish in dependency order (dependencies guaranteed before dependents) ─
// Version is NOT bumped here — run `node scripts/prepare-publish.mjs` to bump before publishing.
console.log(`─ version ──────────────────────────────────────────────────────────`);
console.log(`  Using version from package.json: ${targetVersion} (no auto bump)`);
console.log('');

// ─── 3. publish (dependencies guaranteed before dependents) ─
console.log('\n─ publish ──────────────────────────────────────────────────────────');
console.log(`  Order: ${order.join(' → ')}\n`);
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
  console.log(`  → ${name}@${targetVersion} (tag: ${npmTag})`);
  const status = publishPackage(pkg.dir, npmTag, otp);
  if (status !== 0) {
    failed.push(name);
    console.error(`  ✗ ${name} failed (exit ${status})`);
    break;
  }
  published.push(name);
  if (verifyPublished(name, targetVersion)) {
    console.log(`  ✓ ${name}@${targetVersion} verified on npm`);
  } else {
    unverified.push(name);
    console.log(`  ~ ${name}@${targetVersion} published (registry visibility lagging — will re-check)`);
  }
}

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

console.log(`\n✓ Published ${published.length}/${set.size} packages at v${targetVersion} (tag: ${npmTag}).`);
console.log('  Note: version was NOT bumped — use prepare-publish to bump next time.');
