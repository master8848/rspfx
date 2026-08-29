# Dev server

TL;DR: Run `rspfx dev` to preview your web parts on port 4321. Use local preview for UI work and workbench mode for SharePoint APIs.

RSPFx serves your bundles on one port. You get hot rebuilds on save. You pick the mode with your tenant setting.

<Steps>

## Step 1: Start the server

Run the dev server from your project root:

```sh
rspfx dev
```

Add `--refresh` to preserve component state where your framework supports it. See [Fast refresh](../styling/fast-refresh.md).

## Step 2: Pick your mode

RSPFx chooses the mode based on whether you set a tenant:

| Mode | When | URL | Cert |
|---|---|---|---|
| Local preview | no tenant | `http://localhost:4321/` | none |
| SharePoint workbench | tenant set | `https://localhost:4321` | self-signed in `~/.rspfx/certs` |

Set the tenant in your config, in an env var, or on the command line:

- In `vite.config.ts`: `dev: { tenantUrl: 'https://contoso.sharepoint.com' }`
- Env var: `SPFX_SERVE_TENANT_DOMAIN=contoso.sharepoint.com`
- Flag: `rspfx dev --tenant https://contoso.sharepoint.com`

Local preview needs no cert. Workbench mode needs HTTPS with a trusted cert.

## Step 3: Open the right URL

**Local preview:**

Open `http://localhost:4321/`. You see a card for each web part. Bundles load from `/dist/*`. Manifests load from `/temp/manifests.js`. Mock `/_api` data comes from `local/data.json`.

Use this mode for rapid UI work. It needs no tenant and no cert.

**Workbench:**

Copy the URL printed by `rspfx dev`. It looks like `https://<tenant>/_layouts/15/workbench.aspx?debug=true&debugManifestsFile=https://localhost:4321/temp/manifests.js`.

SharePoint loads your bundles from `https://localhost:4321/dist/*`. Use this mode for property pane, theme, and real APIs.

## Step 4: Trust the cert for workbench mode

`rspfx dev` creates a cert in `~/.rspfx/certs` on first run. Trust it once per machine:

```sh
# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.rspfx/certs/cert.pem
# Windows
certutil -addstore -user Root %USERPROFILE%\.rspfx\certs\cert.pem
# Linux: import ~/.rspfx/certs/cert.pem into your browser
```

Restart your browser after trust. If you use Chrome 142 or later, allow Local Network Access when prompted.

Run `rspfx doctor` to check cert status. Run `rspfx doctor --fix` to try a fix. See [../../reference/commands.md](../../reference/commands.md).

## Step 5: Edit and refresh

Save a file to rebuild. The server updates manifests and reloads the browser.

With `--refresh`, React, Preact, Vue, Svelte, and Solid preserve state. Vanilla falls back to full reload. Any HMR failure falls back to reload.

Dev builds are unminified. `rspfx build` minifies for production.

</Steps>

## Troubleshoot

| Symptom | Fix |
|---|---|
| Blank page or `NET::ERR_CERT_AUTHORITY_INVALID` | cert not trusted - run trust step and restart browser |
| `Load debug scripts` shows on every reload | cert or network access not allowed - trust cert and allow access |
| Bundle 404 at `https://localhost:4321/dist/*` | bundle name does not match `entryModuleId` - check folder and `config/config.json` |
| Port in use | stop other dev servers or change port in config |

For flag and env var details, see [../../reference/commands.md](../../reference/commands.md). For pipeline details, see [../../reference/architecture.md](../../reference/architecture.md).
