import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

export function flagValue(args, flag) {
  const eq = args.find((a) => a.startsWith(flag + '='));
  if (eq) return eq.slice(flag.length + 1);
  const i = args.indexOf(flag);
  if (i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--')) return args[i + 1];
  return undefined;
}

export function fatal(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

export function run(cmd, argsList, opts = {}) {
  const result = spawnSync(cmd, argsList, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    const redacted = argsList.map((a, i) => (argsList[i - 1] === '--otp' ? '***' : a)).join(' ');
    fatal(`command failed: ${cmd} ${redacted} (exit ${result.status ?? 'signal'})`);
  }
}

export function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

export function bumpVersion(current, kind) {
  const base = current.split('-')[0].split('+')[0];
  const [major, minor, patch] = base.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
