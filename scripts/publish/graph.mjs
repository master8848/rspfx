import fs from 'node:fs';
import path from 'node:path';
import { fatal } from './utils.mjs';

/**
 * Publishable set: packages/* + apps/* where package.json private !== true
 * and name starts with @mbsks/rspfx-. Guarded to never pick examples.
 */
export function assertNoExamplePackages(ROOT) {
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

export function collectPublishSet(ROOT) {
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
  if (set.size === 0) fatal('No publishable packages found.');
  return set;
}

function depsOf(set, name) {
  const pkg = JSON.parse(fs.readFileSync(path.join(set.get(name).dir, 'package.json'), 'utf8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
  return Object.keys(deps).filter((dep) => set.has(dep));
}

function buildGraph(set) {
  const depsMap = new Map();
  const dependentsMap = new Map();
  const indegree = new Map();
  for (const name of set.keys()) {
    depsMap.set(name, []);
    dependentsMap.set(name, []);
    indegree.set(name, 0);
  }
  for (const name of set.keys()) {
    const deps = depsOf(set, name);
    depsMap.set(name, deps);
    indegree.set(name, deps.length);
    for (const dep of deps) {
      if (!dependentsMap.has(dep)) dependentsMap.set(dep, []);
      dependentsMap.get(dep).push(name);
    }
  }
  return { depsMap, dependentsMap, indegree };
}

/**
 * Find first cycle via DFS. Returns array like [A, B, C, A] or null if acyclic.
 */
export function findCycle(set) {
  const visited = new Set();
  const stack = [];
  const onStack = new Set();
  let cycle = null;

  const visit = (name) => {
    if (cycle) return;
    visited.add(name);
    onStack.add(name);
    stack.push(name);
    for (const dep of depsOf(set, name)) {
      if (cycle) break;
      if (!visited.has(dep)) {
        visit(dep);
      } else if (onStack.has(dep)) {
        // found cycle: slice stack from dep to top + dep
        const idx = stack.indexOf(dep);
        cycle = [...stack.slice(idx), dep];
      }
    }
    stack.pop();
    onStack.delete(name);
  };

  // Use sorted keys for deterministic detection
  for (const name of [...set.keys()].sort()) {
    if (!visited.has(name) && !cycle) visit(name);
  }
  return cycle;
}

/**
 * Kahn's algorithm: levels[0] = leaves (no deps), levels[1] depends only on level 0, etc.
 * Also validates acyclicity. Returns { order, levels, levelOf }
 * If cycle exists, returns { cycle, levels, order: partial } and caller should fatal.
 */
export function getPublishLevels(set) {
  const { depsMap, dependentsMap, indegree } = buildGraph(set);
  const indeg = new Map(indegree);
  const levels = [];
  let current = [...set.keys()].filter((n) => indeg.get(n) === 0).sort();
  const order = [];
  const levelOf = new Map();

  let levelIdx = 0;
  while (current.length > 0) {
    levels.push([...current]);
    for (const name of current) {
      levelOf.set(name, levelIdx);
      order.push(name);
    }
    const nextSet = new Set();
    for (const name of current) {
      for (const dependent of dependentsMap.get(name) ?? []) {
        const remaining = indeg.get(dependent) - 1;
        indeg.set(dependent, remaining);
        if (remaining === 0) nextSet.add(dependent);
      }
    }
    current = [...nextSet].sort();
    levelIdx++;
  }

  if (order.length !== set.size) {
    // Cycle among remaining nodes
    const remaining = [...set.keys()].filter((n) => !order.includes(n));
    const cycle = findCycle(set);
    return { order, levels, levelOf, cycle, remaining, depsMap };
  }
  return { order, levels, levelOf, depsMap };
}

/**
 * Optimized dependencyOrder: guarantees dependencies published before dependents.
 * Uses levels; flat order is topologically sorted.
 * If cycle exists, fatal with simple hint listing cyclic packages.
 */
export function getPublishOrder(set) {
  const result = getPublishLevels(set);

  if (result.cycle || result.order.length !== set.size) {
    const cycle = result.cycle ?? result.remaining;
    const remaining = result.remaining ?? cycle;
    // Build simple hint: show cycle path if available, otherwise list remaining
    let hint;
    if (result.cycle) {
      hint = result.cycle.join(' → ');
    } else {
      // Fallback: show remaining nodes with their internal deps
      const details = remaining
        .map((name) => {
          const deps = (result.depsMap?.get(name) ?? []).filter((d) => remaining.includes(d));
          return deps.length ? `${name} → [${deps.join(', ')}]` : name;
        })
        .join(', ');
      hint = details;
    }
    const levelPreview = result.levels.length
      ? `\n  Resolved levels before cycle: ${result.levels.map((l) => `[${l.join(', ')}]`).join(' → ')}`
      : '';
    const remainingStr = remaining?.length ? `\n  Cyclic subset: ${remaining.join(', ')}` : '';
    fatal(
      `Circular dependency detected among publishable packages:\n  ${hint}${remainingStr}${levelPreview}\n` +
        `Hint: break the cycle by removing/restructuring workspace dependencies between these packages.\n` +
        `  Publish cannot proceed until the graph is acyclic (dependencies must be published before dependents).`
    );
  }

  // order already guarantees deps before dependents because levels do.
  return result;
}

/** For diagnostics: pretty-print levels */
export function formatLevels(levels) {
  return levels.map((lvl, i) => `  Level ${i}: ${lvl.join(', ')}`).join('\n');
}
