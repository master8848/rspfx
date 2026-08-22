#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const roots = ['packages', 'apps'];
const found = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // skip build output, caches, external fixtures, and ignored trees
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.rspack-cache' || entry.name === '.rspfx' || entry.name === '__fixtures__' || entry.name === 'fixtures' || entry.name === 'generated' || entry.name === '.turbo') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // only enforce under src/
      // but walk entire roots and check if path contains /src/ and ends .js
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // first-party .js under src/ is forbidden
      const segments = full.split(path.sep);
      if (segments.includes('src')) {
        found.push(full);
      }
    }
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) walk(root);
}

if (found.length > 0) {
  console.error('[rspfx] TS-only violation: first-party .js files found under src/:');
  for (const f of found) console.error(`  - ${f}`);
  console.error('Move these to .ts or exclude from src/ (dist/ is allowed).');
  process.exit(1);
} else {
  console.log('[rspfx] TS-only check passed: no .js under src/.');
}
