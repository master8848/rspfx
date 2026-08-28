# Roadblocks

What keeps RSPFX pre-1.0. For current behavior see [architecture.md](architecture.md), [compatibility.md](compatibility.md), [commands.md](commands.md).

## Real-tenant gate

Gate: scaffold → `rspfx package` → upload `.sppkg` to Microsoft 365 app catalog → install → render in workbench — passed 2026-08-22 for web parts, extensions, and libraries (see [real-tenant-validation.md](real-tenant-validation.md)). Correctness rests on parity checks plus the gate. Remaining is automated CI across SPFx 1.20–1.23 (needs `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL`).

## Security

| Area | Detail |
|---|---|
| Mock API | `local/data.json` seed is trusted-local only; do not expose preview beyond localhost |
| CORS | Allowlist is narrow (`localhost`, `127.0.0.1`, `::1`, `*.sharepoint.com`); keep preview on localhost |
| Cert | `~/.rspfx/certs/cert.pem` (825-day self-signed, machine-wide if trusted) — dev machines only; remove via OS keychain tools |

Only `RSPFX_ACCESS_TOKEN` + `RSPFX_APP_CATALOG_URL` are implemented for deploy; no username/password vars.

## Compatibility / bundler

| Limit | Mitigation |
|---|---|
| Turbopack not possible | Use `RspfxPlugin` (Rspack), `rspfxVite`, or `rspfxRsbuild` |
| Local preview (`/_api` + `/`) only on Rspack | For Vite/Rsbuild validate via workbench; see [commands.md#rspfx-dev](commands.md#rspfx-dev) |
| Other frameworks | No built-in preset — bring a `FrameworkPreset` — see [custom-framework.md](custom-framework.md) |

## Support

| Gap | Detail |
|---|---|
| Performance baseline single machine | `examples/shadcn` cold 633 ms on M1 Pro; validate on your hardware via `bench/` |
| No long-term support / no build-plugin ecosystem | Scope to web-parts on SPFx 1.20–1.23, port CI via `rspfx doctor` + `rspfx build` |

## When to adopt

| Project | Verdict |
|---|---|
| 1 web part, React, SharePoint Online | Adopt — `rspfx new --framework react --yes` → `rspfx doctor` → `rspfx dev` → `rspfx package` |
| Multiple web parts + localization | Adopt — `localizedPath` + `?locale=` preview works |
| Extension / Library | Adopt — compile, preview, and tenant install verified |
| Other framework without a preset, 2019/on-prem, risk-averse | Wait — see [why-not-to-migrate.md](why-not-to-migrate.md) |
| Need Turbopack or Vite-only `/_api` | Wait |

Revisit after tenant CI and official-toolchain bench validation — tracked in [roadmap.md](roadmap.md).
