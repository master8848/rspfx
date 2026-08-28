import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

export function dirtyRaw(ROOT) {
  try {
    return execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
  } catch {
    return '';
  }
}

export function isResumeDirtyAllowed(ROOT, set, targetVersion, dirty) {
  if (!dirty) return false;
  const dirtyFiles = dirty.split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
  const allowed = new Set([
    'package.json',
    ...[...set.values()].map((p) => path.relative(ROOT, path.join(p.dir, 'package.json')).replaceAll('\\', '/')),
  ]);
  const allAllowed = dirtyFiles.every((f) => allowed.has(f.replaceAll('\\', '/')));
  if (!allAllowed) return false;
  for (const f of dirtyFiles) {
    try {
      const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const json = JSON.parse(content);
      if (json.version !== targetVersion) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function commitAndTag(ROOT, changedFiles, targetVersion, npmTag, run) {
  run('git', ['add', ...changedFiles], { cwd: ROOT });
  const staged = execSync('git diff --cached --name-only', { cwd: ROOT }).toString().trim();
  if (staged) {
    run('git', ['commit', '-m', `chore: bump all publishable packages to v${targetVersion}`], { cwd: ROOT });
    console.log(`\nCommitted version bump (v${targetVersion}). Run "git push" to share it.`);
  } else {
    console.log('\nVersion bump already committed — skipping commit.');
  }
  const tagName = `v${targetVersion}`;
  let tagExists = false;
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tagName}`, { cwd: ROOT, stdio: 'ignore' });
    tagExists = true;
  } catch {
    tagExists = false;
  }
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
}
