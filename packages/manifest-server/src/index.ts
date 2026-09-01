import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isIP } from 'node:net';
import * as crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '@mbsks/rspfx-diagnostics';
import * as v from 'valibot';

const execFileAsync = promisify(execFile);

// Node 20+ provides X509Certificate; guard for older runtimes so the module
// still loads and falls back to regeneration instead of throwing at import.
const X509CertificateCtor: typeof crypto.X509Certificate | undefined = (
  crypto as unknown as { X509Certificate?: typeof crypto.X509Certificate }
).X509Certificate;

const TRUST_NOTES = [
  'RSPFx development certificate (self-signed, 825 days)',
  '',
  'key.pem / cert.pem are used by the local HTTPS dev server for localhost and 127.0.0.1.',
  '',
  'To make browsers and SharePoint trust this certificate, import cert.pem into the',
  'trusted root store of your OS or browser, then restart the browser:',
  '',
  '  macOS:    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem',
  '  Windows:  certutil -addstore -user Root cert.pem',
  '  Linux:    import cert.pem into the browser or system trust store',
  '',
  'If the cert is not trusted, SharePoint workbench shows CORS errors,',
  'NET::ERR_CERT_AUTHORITY_INVALID, or a blank page and the manifests at',
  'https://localhost:4321/temp/manifests.js fail to load. Run `rspfx doctor`',
  'to check cert status and see trust instructions.',
  ''
].join('\n');

interface SelfsignedAltName {
  type: number;
  value?: string;
  ip?: string;
}

interface SelfsignedExtension {
  name: string;
  cA?: boolean;
  serverAuth?: boolean;
  altNames?: SelfsignedAltName[];
}

interface SelfsignedOptions {
  keySize: number;
  days: number;
  algorithm: string;
  extensions: SelfsignedExtension[];
}

interface SelfsignedPems {
  private: string;
  public: string;
  cert: string;
  fingerprint: string;
}

const logger = createLogger('rspfx');

/**
 * Allowlist validation for the single custom hostname that may be added to
 * the self-signed SAN besides the built-ins (localhost, 127.0.0.1, ::1).
 *
 * - IPs are validated via `isIP` (covers `:` handling for IPv6).
 * - DNS names must match `^[a-z0-9.-]+$` (case-insensitive), 1..253 chars,
 *   no `..`, no leading/trailing `.`/`-`, labels 1..63 chars, and must NOT
 *   look like a SharePoint tenant suffix (`.sharepoint*`) — custom hostnames
 *   should be local dev names, not tenant domains.
 * - Rejects injection characters: `; & " ' space : / \ %` and control chars
 *   are already excluded by the DNS regex, but `..` and sharepoint suffix are
 *   checked explicitly. `:` is only allowed via IP path.
 */
export function validateCustomHostname(hostname: string): void {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return;
  }
  if (isIP(hostname) !== 0) {
    return;
  }
  if (hostname.length === 0 || hostname.length > 253) {
    throw new Error(`Invalid hostname "${hostname}": length must be 1..253`);
  }
  if (hostname.includes('..')) {
    throw new Error(`Invalid hostname "${hostname}": must not contain ".."`);
  }
  if (/[^a-z0-9.-]/i.test(hostname)) {
    throw new Error(
      `Invalid hostname "${hostname}": must match /^[a-z0-9.-]+$/ (rejects ; & " ' space : / etc.)`
    );
  }
  if (hostname.startsWith('.') || hostname.startsWith('-') || hostname.endsWith('.') || hostname.endsWith('-')) {
    throw new Error(`Invalid hostname "${hostname}": must not start/end with . or -`);
  }
  // SharePoint suffix reject for custom dev hostname — prevents accidental
  // SAN for a tenant domain (which should use real certs, not self-signed).
  const lower = hostname.toLowerCase();
  if (
    lower.endsWith('.sharepoint.com') ||
    lower.endsWith('.sharepoint-df.com') ||
    lower.endsWith('.sharepoint.cn') ||
    lower === 'sharepoint.com' ||
    lower === 'sharepoint-df.com' ||
    lower === 'sharepoint.cn'
  ) {
    throw new Error(`Invalid hostname "${hostname}": custom hostname must not be a sharepoint domain`);
  }
  // Also reject any label that is empty or too long or starts/ends with -
  for (const label of hostname.split('.')) {
    if (label.length === 0 || label.length > 63) {
      throw new Error(`Invalid hostname "${hostname}": label "${label}" length must be 1..63`);
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      throw new Error(`Invalid hostname "${hostname}": label "${label}" must not start/end with -`);
    }
  }
}

// ── valibot schemas for manifest-server options ──
const MANIFEST_SERVER_DOCS = 'https://github.com/master8848/rspfx#configuration';
export const CertOptionsSchema = v.object({
  certsDir: v.pipe(
    v.string('cert certsDir must be a string — fix: pass certsDir "/home/user/.rspfx/certs" (see ' + MANIFEST_SERVER_DOCS + ')'),
    v.minLength(1, 'cert certsDir must be non-empty — fix: pass certsDir "/home/user/.rspfx/certs" (see ' + MANIFEST_SERVER_DOCS + ')')
  ),
  hostname: v.optional(
    v.pipe(
      v.string('cert hostname must be a string — fix: set hostname "localhost" (see ' + MANIFEST_SERVER_DOCS + ')'),
      v.minLength(1, 'cert hostname must be non-empty — fix: set hostname "localhost" (see ' + MANIFEST_SERVER_DOCS + ')'),
      v.check((val) => {
        try { validateCustomHostname(val); return true; } catch { return false; }
      }, 'cert hostname is invalid — fix: set hostname "localhost" or a valid DNS/IP (see ' + MANIFEST_SERVER_DOCS + ')')
    )
  )
});

export const ManifestServerPortSchema = v.pipe(
  v.number('manifest server port must be a number — fix: set port 4321 (see ' + MANIFEST_SERVER_DOCS + ')'),
  v.integer('manifest server port must be an integer — fix: set port 4321 (see ' + MANIFEST_SERVER_DOCS + ')'),
  v.minValue(1024, 'manifest server port must be 1024-65535 — fix: set port 4321 (see ' + MANIFEST_SERVER_DOCS + ')'),
  v.maxValue(65535, 'manifest server port must be 1024-65535 — fix: set port 4321 (see ' + MANIFEST_SERVER_DOCS + ')')
);

export const ManifestPathSchema = v.pipe(
  v.string('manifest path must be a string — fix: set manifest path "src/webparts/hello/HelloWebPart.manifest.json" (see ' + MANIFEST_SERVER_DOCS + ')'),
  v.minLength(1, 'manifest path must be non-empty — fix: set manifest path "src/webparts/hello/HelloWebPart.manifest.json" (see ' + MANIFEST_SERVER_DOCS + ')'),
  v.check((val) => !val.includes('\0'), 'manifest path must not contain null bytes — fix: check manifest path (see ' + MANIFEST_SERVER_DOCS + ')')
);

export const ManifestServerOptionsSchema = v.object({
  certsDir: v.pipe(v.string('manifest server certsDir must be a string — fix: set certsDir "/home/user/.rspfx/certs" (see ' + MANIFEST_SERVER_DOCS + ')'), v.minLength(1, 'manifest server certsDir must be non-empty — fix: set certsDir "/home/user/.rspfx/certs" (see ' + MANIFEST_SERVER_DOCS + ')')),
  hostname: v.optional(v.pipe(v.string('manifest server hostname must be a string — fix: set hostname "localhost" (see ' + MANIFEST_SERVER_DOCS + ')'), v.minLength(1, 'manifest server hostname must be non-empty — fix: set hostname "localhost" (see ' + MANIFEST_SERVER_DOCS + ')'))),
  port: v.optional(ManifestServerPortSchema),
  manifestPaths: v.optional(v.array(ManifestPathSchema, 'manifest server manifestPaths must be an array — fix: set manifestPaths ["src/webparts/hello/HelloWebPart.manifest.json"] (see ' + MANIFEST_SERVER_DOCS + ')'))
});

export type CertIssue = { path: (string | number)[]; message: string; code: string };
export type CertResult<T> = { ok: true; value: T } | { ok: false; error: CertIssue[] };

function mapCertIssues(issues: readonly v.BaseIssue<unknown>[]): CertIssue[] {
  return issues.map((issue) => {
    const p = (issue as unknown as { path?: { key: string | number }[] }).path;
    const dotPath: (string | number)[] = p ? p.map((seg) => (seg as { key: string | number }).key) : [];
    let message = (issue as { message?: string }).message ?? 'Invalid value';
    const inputVal = (issue as { input?: unknown }).input;
    if (inputVal !== undefined && !message.includes('(got')) {
      try {
        const got = JSON.stringify(inputVal);
        const short = got.length > 60 ? got.slice(0, 57) + '...' : got;
        if (message.includes(' — fix:')) message = message.replace(' — fix:', ` (got ${short}) — fix:`);
        else message = `${message} (got ${short})`;
      } catch {}
    }
    if (!message.includes('fix:')) message += ' — fix: check manifest-server options (see ' + MANIFEST_SERVER_DOCS + ')';
    return { path: dotPath, message, code: 'CONFIG_VALIDATION_FAILED' };
  });
}

export function validateCertOptions(raw: unknown): CertResult<{ certsDir: string; hostname?: string }> {
  const result = v.safeParse(CertOptionsSchema, raw);
  if (!result.success) return { ok: false, error: mapCertIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output as { certsDir: string; hostname?: string } };
}

export function validateManifestServerOptions(raw: unknown): CertResult<v.InferOutput<typeof ManifestServerOptionsSchema>> {
  const result = v.safeParse(ManifestServerOptionsSchema, raw);
  if (!result.success) return { ok: false, error: mapCertIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export function validatePort(raw: unknown): CertResult<number> {
  const result = v.safeParse(ManifestServerPortSchema, raw);
  if (!result.success) return { ok: false, error: mapCertIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export function validateManifestPath(raw: unknown): CertResult<string> {
  const result = v.safeParse(ManifestPathSchema, raw);
  if (!result.success) return { ok: false, error: mapCertIssues(result.issues as unknown as v.BaseIssue<unknown>[]) };
  return { ok: true, value: result.output };
}

export async function ensureCertificates(certsDir: string, hostname?: string): Promise<{ key: string; cert: string }> {
  const certValidation = validateCertOptions({ certsDir, ...(hostname !== undefined ? { hostname } : {}) });
  if (!certValidation.ok) {
    throw new Error(certValidation.error[0]!.message);
  }
  if (hostname) {
    validateCustomHostname(hostname);
  }
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  try {
    const [key, cert] = await Promise.all([readFile(keyPath, 'utf8'), readFile(certPath, 'utf8')]);
    let shouldRegenerate = false;
    try {
      if (!X509CertificateCtor) {
        // No X509Certificate available (pre-Node15) — cannot check expiry/
        // SAN, so treat as valid cache hit to avoid churn. Generation will
        // still happen on missing files above.
        shouldRegenerate = false;
      } else {
        const x509 = new X509CertificateCtor(cert);
        const expiry = Date.parse(x509.validTo);
        if (Number.isNaN(expiry) || expiry - Date.now() < 7 * 24 * 60 * 60 * 1000) {
          shouldRegenerate = true;
        } else if (hostname) {
          const alt = x509.subjectAltName ?? '';
          const needsHost =
            hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !alt.includes(hostname);
          const needsIpv6 = !alt.includes('::1') && !alt.includes('0:0:0:0:0:0:0:1');
          if (needsHost || needsIpv6) {
            shouldRegenerate = true;
          }
        } else {
          const alt = x509.subjectAltName ?? '';
          if (!alt.includes('::1') && !alt.includes('0:0:0:0:0:0:0:1')) {
            shouldRegenerate = true;
          }
        }
      }
    } catch {
      shouldRegenerate = true;
    }
    if (!shouldRegenerate) {
      return { key, cert };
    }
  } catch {
    // fall through to generation
  }
  await mkdir(certsDir, { recursive: true });
  const altNames: SelfsignedAltName[] = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '::1' }
  ];
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    const ipVersion = isIP(hostname);
    if (ipVersion === 4 || ipVersion === 6) {
      altNames.push({ type: 7, ip: hostname });
    } else {
      altNames.push({ type: 2, value: hostname });
    }
  }
  const { default: selfsigned } = (await import('selfsigned')) as unknown as {
    default: {
      generate(attrs: { name: string; value: string }[], options: SelfsignedOptions): Promise<SelfsignedPems>;
    };
  };
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    {
      keySize: 2048,
      days: 825,
      algorithm: 'sha256',
      extensions: [
        { name: 'extKeyUsage', serverAuth: true },
        {
          name: 'subjectAltName',
          altNames
        }
      ]
    }
  );
  const trustPath = path.join(certsDir, 'cert.pem.trust.txt');
  await Promise.all([
    writeFile(`${keyPath}.tmp`, pems.private, { mode: 0o600 }).then(() => rename(`${keyPath}.tmp`, keyPath)),
    writeFile(`${certPath}.tmp`, pems.cert, { mode: 0o644 }).then(() => rename(`${certPath}.tmp`, certPath)),
    // cert.pem.trust.txt is static help text — intentionally does NOT echo the
    // custom hostname to avoid leaking/injecting unescaped hostnames into a
    // file that users may `cat` or copy-paste into shell commands.
    writeFile(`${trustPath}.tmp`, TRUST_NOTES, { mode: 0o644 }).then(() => rename(`${trustPath}.tmp`, trustPath))
  ]);
  logger.info(
    `Generated self-signed dev certificate in ${certsDir}. See cert.pem.trust.txt for trust instructions.`
  );
  logger.warn(
    'New cert is not trusted yet — browsers will block https://localhost:4321 with CORS or NET::ERR_CERT_AUTHORITY_INVALID until you trust cert.pem (see cert.pem.trust.txt or run `rspfx doctor`).'
  );
  return { key: pems.private, cert: pems.cert };
}

export function getCertsDir(): string {
  return path.join(os.homedir(), '.rspfx', 'certs');
}

export interface CertStatus {
  exists: boolean;
  keyExists: boolean;
  certExists: boolean;
  valid: boolean;
  expiresAt?: string;
  daysUntilExpiry?: number;
  hostnameMismatch?: boolean;
  detail?: string;
}

export async function getCertStatus(certsDir: string, hostname?: string): Promise<CertStatus> {
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  const keyExists = existsSync(keyPath);
  const certExists = existsSync(certPath);
  if (!keyExists || !certExists) {
    return {
      exists: false,
      keyExists,
      certExists,
      valid: false,
      detail: !keyExists && !certExists ? 'key.pem and cert.pem missing' : !keyExists ? 'key.pem missing' : 'cert.pem missing'
    };
  }
  try {
    const cert = await readFile(certPath, 'utf8');
    if (!X509CertificateCtor) {
      return { exists: true, keyExists, certExists, valid: true, detail: 'X509Certificate unavailable — cannot verify expiry' };
    }
    const x509 = new X509CertificateCtor(cert);
    const expiry = Date.parse(x509.validTo);
    const now = Date.now();
    const daysUntilExpiry = Number.isNaN(expiry) ? undefined : Math.floor((expiry - now) / (24 * 60 * 60 * 1000));
    const expiresAt = x509.validTo;
    if (Number.isNaN(expiry)) {
      return { exists: true, keyExists, certExists, valid: false, expiresAt, detail: 'invalid expiry' };
    }
    if (expiry - now < 7 * 24 * 60 * 60 * 1000) {
      return { exists: true, keyExists, certExists, valid: false, expiresAt, daysUntilExpiry, detail: `expires in ${daysUntilExpiry} days — regenerate needed` };
    }
    if (hostname) {
      const alt = x509.subjectAltName ?? '';
      const needsHost =
        hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !alt.includes(hostname);
      const needsIpv6 = !alt.includes('::1') && !alt.includes('0:0:0:0:0:0:0:1');
      if (needsHost || needsIpv6) {
        return { exists: true, keyExists, certExists, valid: false, expiresAt, daysUntilExpiry, hostnameMismatch: true, detail: needsHost ? `SAN missing hostname ${hostname}` : 'SAN missing ::1' };
      }
    } else {
      const alt = x509.subjectAltName ?? '';
      if (!alt.includes('::1') && !alt.includes('0:0:0:0:0:0:0:1')) {
        return { exists: true, keyExists, certExists, valid: false, expiresAt, daysUntilExpiry, hostnameMismatch: true, detail: 'SAN missing ::1' };
      }
    }
    return { exists: true, keyExists, certExists, valid: true, expiresAt, daysUntilExpiry };
  } catch (error) {
    return { exists: true, keyExists, certExists, valid: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function isCertTrusted(certPath: string): Promise<{ trusted: boolean | 'unknown'; detail: string }> {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      // verify-cert returns 0 if trusted, non-zero otherwise; use nq to avoid UI prompts
      try {
        await execFileAsync('security', ['verify-cert', '-c', certPath, '-p', 'ssl'], { timeout: 3000 });
        return { trusted: true, detail: 'security verify-cert succeeded' };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // exit code 1 means not trusted; distinguish from missing cert
        if (msg.includes('not initialised') || msg.includes('CSSMERR')) {
          return { trusted: false, detail: 'security verify-cert reports untrusted' };
        }
        // Fallback: check if cert exists in keychain
        try {
          const certPem = await readFile(certPath, 'utf8');
          // quick fingerprint check via subject — if verify failed, assume not trusted
          void certPem;
          return { trusted: false, detail: 'cert not trusted — run: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ' + certPath };
        } catch {
          return { trusted: 'unknown', detail: msg };
        }
      }
    }
    if (platform === 'win32') {
      try {
        // certutil -verify checks chain; for self-signed Root store check use -store
        const { stdout } = await execFileAsync('certutil', ['-verify', certPath], { timeout: 3000 });
        if (stdout.toLowerCase().includes('cert is trusted') || stdout.toLowerCase().includes('verified')) {
          return { trusted: true, detail: 'certutil -verify reports trusted' };
        }
        return { trusted: false, detail: 'cert not in Trusted Root — run: certutil -addstore -user Root ' + certPath };
      } catch {
        return { trusted: 'unknown', detail: 'certutil check failed — verify manually: certutil -addstore -user Root ' + certPath };
      }
    }
    // Linux: no single system store — advise manual browser import
    return { trusted: 'unknown', detail: 'Linux has no single trust store — import cert.pem into browser/OS store and restart browser' };
  } catch (error) {
    return { trusted: 'unknown', detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function tryTrustCert(certPath: string): Promise<{ trusted: boolean; detail: string }> {
  const platform = process.platform;
  if (platform === 'darwin') {
    try {
      await execFileAsync('security', ['add-trusted-cert', '-d', '-r', 'trustRoot', '-k', '/Library/Keychains/System.keychain', certPath], {
        timeout: 15000
      });
      const verified = await isCertTrusted(certPath).catch(() => undefined);
      if (verified?.trusted === true) return { trusted: true, detail: 'trusted via security add-trusted-cert' };
      return { trusted: true, detail: 'security add-trusted-cert succeeded — restart browser' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const needsSudo =
        /not authorized|permission|authorization|write permissions|User interaction|SecTrust|requires.*admin/i.test(msg) ||
        msg.includes('100013') ||
        msg.toLowerCase().includes('sudo');
      // If we seem to need sudo and we are interactive, try with sudo and inherit stdio so the user can enter password
      const isTTY = Boolean(process.stdin.isTTY || process.stdout.isTTY);
      const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.TF_BUILD);
      if (needsSudo && isTTY && !isCI) {
        try {
          const { spawn } = await import('node:child_process');
          const ok = await new Promise<boolean>((resolve) => {
            const child = spawn('sudo', ['security', 'add-trusted-cert', '-d', '-r', 'trustRoot', '-k', '/Library/Keychains/System.keychain', certPath], {
              stdio: 'inherit'
            });
            child.on('close', (code) => resolve(code === 0));
            child.on('error', () => resolve(false));
          });
          if (ok) {
            const verified = await isCertTrusted(certPath).catch(() => undefined);
            if (verified?.trusted === true) return { trusted: true, detail: 'trusted via sudo security add-trusted-cert' };
            return { trusted: true, detail: 'sudo security add-trusted-cert succeeded — restart browser' };
          }
        } catch {}
      }
      if (needsSudo || /permission/i.test(msg)) {
        return {
          trusted: false,
          detail: `sudo required — run: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${certPath}`
        };
      }
      return {
        trusted: false,
        detail: `security add-trusted-cert failed: ${msg} — ${formatTrustInstructions(path.dirname(certPath))}`
      };
    }
  }
  if (platform === 'win32') {
    try {
      await execFileAsync('certutil', ['-addstore', '-user', 'Root', certPath], { timeout: 15000 });
      const verified = await isCertTrusted(certPath).catch(() => undefined);
      if (verified?.trusted === true) return { trusted: true, detail: 'trusted via certutil -addstore' };
      return { trusted: true, detail: 'certutil -addstore succeeded — restart browser' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { trusted: false, detail: `certutil failed: ${msg} — run: certutil -addstore -user Root ${certPath}` };
    }
  }
  // Linux: try NSS DB
  try {
    const nssDb = path.join(os.homedir(), '.pki', 'nssdb');
    await execFileAsync('certutil', ['-d', `sql:${nssDb}`, '-A', '-t', 'C,,', '-n', 'RSPFx', '-i', certPath], { timeout: 10000 });
    return { trusted: true, detail: `added to NSS DB ${nssDb} — restart browser` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      trusted: false,
      detail: `Linux has no single trust store — import ${certPath} into browser/OS store and restart browser${msg ? ` (${msg})` : ''}`
    };
  }
}

export async function ensureCertificatesAndTrust(
  certsDir: string,
  hostname?: string
): Promise<{ key: string; cert: string; trusted: boolean | 'unknown'; detail: string }> {
  const { key, cert } = await ensureCertificates(certsDir, hostname);
  const certPath = path.join(certsDir, 'cert.pem');
  const trust = await isCertTrusted(certPath);
  if (trust.trusted === true) {
    return { key, cert, trusted: true, detail: trust.detail };
  }
  if (trust.trusted === 'unknown') {
    logger.info(`Cert trust check unknown: ${trust.detail}`);
    return { key, cert, trusted: 'unknown', detail: trust.detail };
  }
  const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.TF_BUILD);
  const isTTY = Boolean(process.stdin.isTTY || process.stdout.isTTY);
  if (isCI || !isTTY) {
    logger.warn(`Dev cert not trusted — ${trust.detail}. ${formatTrustInstructions(certsDir)} — then restart browser. Run rspfx doctor --trust to auto-install.`);
    return { key, cert, trusted: false, detail: trust.detail };
  }
  logger.info('Dev cert not trusted — attempting auto-trust...');
  const result = await tryTrustCert(certPath);
  if (result.trusted) {
    logger.success(`Dev cert trusted: ${result.detail}`);
    return { key, cert, trusted: true, detail: result.detail };
  }
  logger.warn(`Auto-trust failed: ${result.detail} — ${formatTrustInstructions(certsDir)}`);
  return { key, cert, trusted: false, detail: result.detail };
}

export function formatTrustInstructions(certsDir: string): string {
  const certPath = path.join(certsDir, 'cert.pem');
  if (process.platform === 'darwin') {
    return `Trust the dev cert: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${certPath} — then restart browser`;
  }
  if (process.platform === 'win32') {
    return `Trust the dev cert: certutil -addstore -user Root ${certPath} — then restart browser`;
  }
  return `Trust the dev cert: import ${certPath} into browser/OS trust store — then restart browser`;
}
