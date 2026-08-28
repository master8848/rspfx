# Multi-webpart projects

One RSPFX project can ship multiple web parts, extensions, and libraries in a single `.sppkg`. See Microsoft docs: [Working with web part manifests](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/web-parts/basics/working-with-web-part-manifests).

`rspfx new` scaffolds the first web part; add more by duplicating the folder and manifest.

## Scaffold first web part

```sh
rspfx new my-app --framework react --spfx-version 1.23 --yes
```

Creates `src/webparts/my-app/` with `my-app.manifest.json` and `my-appWebPart.ts`.

## Add a second web part

Copy `src/webparts/my-app/` → `src/webparts/todo/` and rename three things:

1. Folder `src/webparts/todo/` — bundle name is the folder name.

2. Inside `todo.manifest.json` — new `id` (`node -e "console.log(crypto.randomUUID())"`), `alias: TodoWebPart`, `preconfiguredEntries[0].title: Todo`.

3. Inside `todoWebPart.ts` + `components/Todo.tsx` — rename class `TodoWebPart`, import `Todo`, styles `styles.Todo`.

`config/config.json` `bundles` and `config/package-solution.json` `features` are not needed per web part — auto-discovery scans `src/webparts/*` when `bundles` is absent.

If `config.json` has explicit `bundles`, add a new bundle `todo` with its `entrypoint` + `manifest`.

> **Tip:** Delete `config.json` to use folder-scan mode (simplest for multi-webpart) — or keep it and add one `bundles.tod` entry per web part.

## Third, fourth, …

Repeat — each `src/webparts/<folder>/` needs one `*.manifest.json` + one entrypoint (`<Name>WebPart.ts`, `index.ts`, or framework variant).

Keep `teams/` and `sharepoint/assets` as project singletons.

> **Tip:** Generate each manifest `id` with `crypto.randomUUID()` — never copy the first web part's `id`.

## Build, dev, and package

- `rspfx dev` — discovers all web parts and serves `https://localhost:4321/dist/<bundle>.js` per folder; `/temp/manifests.js` concatenates every `id`; local preview at `http://localhost:4321/` renders a card per web part.
- `rspfx package` — one `.sppkg` with every component: `release/manifests/<id>.manifest.json` per id and `ClientSideAssets/<bundle>.js` per bundle.

Verify:

```sh
unzip -l sharepoint/solution/<name>.sppkg
# expect: <featureId>/WebPart_<firstId>.xml, <featureId>/WebPart_<secondId>.xml, ClientSideAssets/todo.js, etc.
```

Install once — upload single `.sppkg` → **Deploy** → each web part appears separately in the `Add to page` picker by its `preconfiguredEntries.title`.

> **Tip:** Use `rspfx analyze` to see per-bundle sizes before packaging.

## Extensions alongside web parts

```sh
rspfx new --component applicationcustomizer   # or fieldcustomizer | listviewcommandset | formcustomizer
```

Extensions live in `src/extensions/` — a project can mix `src/webparts/*` + `src/extensions/*`.

Package embeds them as `<featureId>/Extension_<id>.xml`.

See [real-tenant-validation.md](real-tenant-validation.md).

## Libraries alongside web parts

```sh
rspfx new --component library
```

Libraries live in `src/libraries/` — mix `src/webparts/*` + `src/extensions/*` + `src/libraries/*`.

Package embeds them as `<featureId>/Library_<id>.xml` (`Type="Library"`).

The local preview lists libraries as non-mountable; `window.__RSPFX_COMPONENTS__` still exposes them for `import('<alias>')`.

## Favicons and assets per web part

- Each web part folder has `assets/.gitkeep`.
- Project root `assets/favicon.svg` is served at `/assets/favicon.svg` and shown in the local preview.

Per-webpart icons use the web part `assets/` folder; shared branding uses `assets/` or `sharepoint/assets/`.

## Comparison vs official

| Area | Official | RSPFX |
|---|---|---|
| Discovery | `config.json` `bundles` only | `bundles` or folder scan (`src/webparts/*`) |
| Adding a web part | `yo @microsoft/sharepoint` or manual `config.json` | Duplicate folder + new `id` — no generator needed |
| Packaging | One `.sppkg` with all bundles | Same — `WebPart_<id>.xml` + `Extension_<id>.xml` + `Library_<id>.xml` |
| Dev server | All bundles on `:4321` | Same — `https://localhost:4321/dist/<bundle>.js` |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Second web part not found | Folder missing `*.manifest.json` or entrypoint — both required |
| Duplicate `id` error | Manifest `id` must be unique — `crypto.randomUUID()` |
| 404 for `dist/second.js` in workbench (`https://localhost:4321/dist/...`) | Bundle name vs `entryModuleId` mismatch — `config.json` key vs folder vs emitted file must agree |
| Only first web part in `.sppkg` | `config.json` `bundles` is authoritative when present — add new entry or delete `config.json` for folder scan |
