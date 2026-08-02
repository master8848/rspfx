# @mbsks/rspfx-manifest-server

Manifest server for [RSPFX](https://github.com/master8848/rspfx) — an SPFx-compatible build toolchain powered by Rspack.

Serves the SharePoint workbench exactly like official SPFx `gulp serve`: an HTTPS manifest server on port `:4321` with auto-generated self-signed certificates, debug manifests, and a `node_modules` proxy for `@microsoft/sp-*` packages.

## Install

```sh
npm i @mbsks/rspfx-manifest-server
```

## Usage

```ts
import { ensureCertificates, startManifestServer } from '@mbsks/rspfx-manifest-server';

const { key, cert } = await ensureCertificates('.rspfx/certs');
const handle = await startManifestServer({
  port: 4321,
  projectDir: process.cwd(),
  key,
  cert
});

await handle.stop();
```

## API

- `ensureCertificates(dir)` — generate/load self-signed key + cert
- `startManifestServer(opts)` — HTTPS manifest server
- `mimeTypeFor(filePath)` — content-type helper
- `ManifestServerOptions`, `ManifestServerHandle` — types

## Links

- [RSPFX documentation](https://github.com/master8848/rspfx/tree/main/docs)
- License: MIT
