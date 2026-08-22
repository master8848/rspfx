import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import * as crypto from 'node:crypto';
import { createLogger } from '@mbsks/rspfx-diagnostics';

// Node 20+ provides X509Certificate; guard for older runtimes so the module
// still loads and falls back to regeneration instead of throwing at import.
const X509CertificateCtor: typeof crypto.X509Certificate | undefined = (
  crypto as unknown as { X509Certificate?: typeof crypto.X509Certificate }
).X509Certificate;

const TRUST_NOTES = [
  'RSPFX development certificate (self-signed, 825 days)',
  '',
  'key.pem / cert.pem are used by the local HTTPS dev server for localhost and 127.0.0.1.',
  '',
  'To make browsers and SharePoint trust this certificate, import cert.pem into the',
  'trusted root store of your OS or browser, then restart the browser:',
  '',
  '  macOS:    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem',
  '  Windows:  certutil -addstore -user Root cert.pem',
  '  Linux:    import cert.pem into the browser or system trust store',
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

const require = createRequire(import.meta.url);

const selfsigned = require('selfsigned') as {
  generate(attrs: { name: string; value: string }[], options: SelfsignedOptions): Promise<SelfsignedPems>;
};

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

export async function ensureCertificates(certsDir: string, hostname?: string): Promise<{ key: string; cert: string }> {
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
  return { key: pems.private, cert: pems.cert };
}
