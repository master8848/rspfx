#!/usr/bin/env node
/**
 * Prepare publish: bumps all publishable packages to a new version (no publish).
 * Publish itself (`node scripts/publish.mjs`) does NOT bump — it publishes the
 * current version as-is. Run this script first when you need a bump.
 *
 * Usage:
 *   node scripts/prepare-publish.mjs [--patch|--minor|--major] [--version X.Y.Z] [--tag <dist-tag>] [--no-commit] [--dry-run]
 *   default: patch bump
 *
 * Examples:
 *   node scripts/prepare-publish.mjs --patch        # 0.0.14 → 0.0.15
 *   node scripts/prepare-publish.mjs --minor        # 0.0.14 → 0.1.0
 *   node scripts/prepare-publish.mjs --version 0.2.0 --tag next
 *   node scripts/prepare-publish.mjs --dry-run      # preview only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagValue, fatal, run, bumpVersion, writeJson } from './publish/utils.mjs';
import { assertNoExamplePackages, collectPublishSet } from './publish/graph.mjs';
import { dirtyRaw } from './publish/git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const DRY_RUN = args.includes('--dry-run');
const NO_COMMIT = args.includes('--no-commit');
const versionFlag = flagValue(args, '--version');
const bumpKind = args.includes('--major') ? 'major' : args.includes('--minor') ? 'minor' : 'patch';
const explicitTag = flagValue(args, '--tag');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/prepare-publish.mjs [--patch|--minor|--major] [--version X.Y.Z] [--tag <dist-tag>] [--no-commit] [--dry-run]`);
  process.exit(0);
}

// 1. collect + validate
assertNoExamplePackages(ROOT);
const set = collectPublishSet(ROOT);
const versions = new Set([...set.values()].map((p) => p.version));
if (versions.size > 1) {
  fatal(`Publishable packages have inconsistent versions: ${[...versions].join(', ')} — bump them all to one version first.`);
}
const currentVersion = [...versions][0];
const targetVersion = versionFlag ?? bumpVersion(currentVersion, bumpKind);
const npmTag = explicitTag ?? (targetVersion.includes('-') ? 'next' : 'latest');

if (targetVersion === currentVersion) {
  console.log(`Already at ${currentVersion} — nothing to bump.`);
  process.exit(0);
}

console.log(`Prepare publish ${DRY_RUN ? '(DRY RUN)' : ''}`);
console.log(`  current: ${currentVersion} → target: ${targetVersion} (npm tag: ${npmTag})`);
console.log('');

if (DRY_RUN) {
  console.log([...set.values()].map((p) => `  • ${p.name}: ${currentVersion} → ${targetVersion}`).sort().join('\n'));
  console.log(`  • rspfx (root): ${currentVersion} → ${targetVersion}`);
  console.log(`\nDry run — no files changed. Run without --dry-run to bump.`);
  process.exit(0);
}

// 2. git dirty check (must be clean before bump, unless only version files are dirty and already at target)
const dirty = dirtyRaw(ROOT);
if (dirty) {
  fatal(`Working tree is not clean. Commit or stash first:\n${dirty}`);
}

// 3. bump files
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

// 4. commit + tag (unless --no-commit)
if (!NO_COMMIT) {
  const { execSync, spawnSync } = await import('node:child_process');
  run('git', ['add', ...changedFiles], { cwd: ROOT });
  const staged = execSync('git diff --cached --name-only', { cwd: ROOT }).toString().trim();
  if (staged) {
    run('git', ['commit', '-m', `chore: bump all publishable packages to v${targetVersion}`], { cwd: ROOT });
    console.log(`\nCommitted version bump (v${targetVersion}).`);
  } else {
    console.log('\nVersion bump already committed — skipping commit.');
  }
  const tagName = `v${targetVersion}`;
  let tagExists = false;
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tagName}`, { cwd: ROOT, stdio: 'ignore' });
    tagExists = true;
  } catch {}
  if (!tagExists) {
    const tagMessage = `${tagName}\n\nSee CHANGELOG.md ## [${targetVersion}] — npm dist-tag: ${npmTag}`;
    const tagResult = spawnSync('git', ['tag', '-a', tagName, '-m', tagMessage], { cwd: ROOT, stdio: 'inherit' });
    if (tagResult.status === 0) {
      console.log(`Created annotated git tag ${tagName} (npm tag: ${npmTag}). Push with: git push --follow-tags`);
    } else {
      console.error(`Failed to create git tag ${tagName} (exit ${tagResult.status})`);
    }
  } else {
    console.log(`Git tag ${tagName} already exists — skipping tag creation.`);
  }
} else {
  console.log('\n--no-commit: skipped git commit/tag. Changed files remain dirty.');
}

console.log(`\n✓ Prepared v${targetVersion} (tag: ${npmTag}). Next: node scripts/publish.mjs${versionFlag ? ` --version ${targetVersion}` : ''} (publishes current version as-is, no bump).`);
