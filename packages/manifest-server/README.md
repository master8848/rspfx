# @mbsks/rspfx-manifest-server

Development certificates for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.

Generates and caches the self-signed TLS key/cert pair used by the local HTTPS dev server (the compiler-rspack dev server; serving itself is handled there, not here). Certificates live in `~/.rspfx/certs` and are reused across runs.

## Install

```sh
npm i @mbsks/rspfx-manifest-server
```

## Usage

```ts
import { ensureCertificates } from '@mbsks/rspfx-manifest-server';

const { key, cert } = await ensureCertificates('.rspfx/certs');
```

## API

- `ensureCertificates(dir, hostname?)` — generate/load self-signed key + cert (writes `key.pem`, `cert.pem`, and `cert.pem.trust.txt` with trust instructions; warns about CORS / `NET::ERR_CERT_AUTHORITY_INVALID` if untrusted)
- `validateCustomHostname(hostname)` — allowlist check for custom SAN hostname
- `getCertsDir()` — default `~/.rspfx/certs`
- `getCertStatus(dir, hostname?)` — `CertStatus` (exists, valid, expiry, SAN mismatch via `X509Certificate`)
- `isCertTrusted(certPath)` — best-effort OS trust check (`security verify-cert` on macOS, `certutil -verify` on Windows)
- `formatTrustInstructions(dir)` — per-OS trust command string

See `docs/getting-started.md#cert-trust` for user-facing trust steps and `rspfx doctor` for automated checks.

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
