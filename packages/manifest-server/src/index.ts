import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import { X509Certificate } from 'node:crypto';
import { createLogger } from '@mbsks/rspfx-diagnostics';

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
  generate(attrs: { name: string; value: string }[], options: SelfsignedOptions): SelfsignedPems;
};

const logger = createLogger('rspfx');

export async function ensureCertificates(certsDir: string, hostname?: string): Promise<{ key: string; cert: string }> {
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.pem');
  try {
    const [key, cert] = await Promise.all([readFile(keyPath, 'utf8'), readFile(certPath, 'utf8')]);
    let shouldRegenerate = false;
    try {
      const x509 = new X509Certificate(cert);
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
  const pems = selfsigned.generate(
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
  await Promise.all([
    writeFile(keyPath, pems.private, { mode: 0o600 }),
    writeFile(certPath, pems.cert),
    writeFile(path.join(certsDir, 'cert.pem.trust.txt'), TRUST_NOTES)
  ]);
  logger.info(
    `Generated self-signed dev certificate in ${certsDir}. See cert.pem.trust.txt for trust instructions.`
  );
  return { key: pems.private, cert: pems.cert };
}
