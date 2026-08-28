import { execSync, spawnSync } from 'node:child_process';

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

export function isPublished(name, version) {
  try {
    const out = execSync(`npm view ${JSON.stringify(name + '@' + version)} version`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return out === version;
  } catch {
    return false;
  }
}

export function verifyPublished(name, version) {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (isPublished(name, version)) return true;
    sleepSync(2000);
  }
  return false;
}

export function countPublished(set, version) {
  let count = 0;
  for (const pkg of set.values()) {
    if (isPublished(pkg.name, version)) count++;
  }
  return count;
}

export function publishPackage(pkgDir, npmTag, otp) {
  const publishArgs = ['publish', '--access', 'public', '--tag', npmTag];
  const publishEnv = otp
    ? { ...process.env, npm_config_otp: otp, NPM_OTP: otp, RSPFX_NPM_OTP: otp }
    : process.env;

  const publishOnce = () =>
    spawnSync('bun', publishArgs, {
      cwd: pkgDir,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: publishEnv,
    }).status ?? 1;

  let status = publishOnce();
  for (let attempt = 1; status !== 0 && attempt < 4; attempt++) {
    console.log(`    (attempt ${attempt + 1}/4 after exit ${status})`);
    sleepSync(4000);
    status = publishOnce();
  }
  return status;
}
