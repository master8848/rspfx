# @mbsks/rspfx-manifest-server

Development certificates for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

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

- `ensureCertificates(dir)` — generate/load self-signed key + cert (writes `key.pem`, `cert.pem`, and `cert.pem.trust.txt` with trust instructions)

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
