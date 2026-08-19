# Multi-webpart projects

One `rspfx` project can ship multiple web parts (and extensions) in a single `.sppkg`. `rspfx new` scaffolds the first web part; add more by duplicating the web part folder and its manifest (`packages/templates/src/index.ts:104`).

## Scaffold the first web part

`rspfx new my-app --framework react --spfx-version 1.23 --yes` creates `src/webparts/my-app/` with `my-app.manifest.json` (`id` = `componentId` `apps/cli/src/commands/new.ts:121` `randomUUID()`) and `my-appWebPart.ts` (`packages/templates/src/index.ts:680` `webpartEntry`).

## Add a second web part

Copy the folder `src/webparts/my-app/` → `src/webparts/todo/` and rename three identifiers:

1. Folder `src/webparts/todo/` (bundle name is the folder name `docs/building-packages.md:53`).

2. Inside `todo.manifest.json`: set `id` to a new UUID (`node -e "console.log(crypto.randomUUID())"`), `alias` to `TodoWebPart`, `preconfiguredEntries[0].title` to `Todo`.

3. Inside `todoWebPart.ts` + `components/Todo.tsx` (or `HelloWorld.ts` for vanilla): rename class `TodoWebPart`, import `Todo` from `./components/Todo`, and `styles.Todo` (`src/webparts/todo/styles/Todo.module.scss`).

`config/config.json` (`config/config.json:400` `localizedResources` `TodoWebPartStrings`) and `config/package-solution.json` `features[0].assets` are not needed per web part — web parts are auto-discovered from `src/webparts/*/*` (`packages/dev-runtime/src/project.ts:498` `discoverWebParts`) when `config.json` has no `bundles`. If `config/config.json` has explicit `bundles`, add a new bundle `todo` with its `entrypoint` + `manifest`.

## Third, fourth, …

Repeat: each `src/webparts/<folder>/` needs one `*.manifest.json` + one entrypoint (`<Name>WebPart.ts`, `index.ts`, or framework variant `VueWebPart` etc. `packages/dev-runtime/src/project.ts:498` picks the entrypoint). Keep `team`s and `sharepoint/assets` singletons at the project root.

## Build, dev, and package

`rspfx dev` discovers all web parts and serves `https://localhost:4321/dist/<bundle>.js` per folder (`packages/dev-runtime/src/serve.ts:160` `currentProject.webParts.entries`) and `/temp/manifests.js` concatenates every `id` (`packages/manifest-generator/src/manifests-js.ts:76`). The local preview at `http://localhost:4321/` (`packages/dev-runtime/src/local-page.ts:41`) renders a card per `componentType: WebPart` in `window.__RSPFX_COMPONENTS__`.

`rspfx package` emits one `.sppkg` containing every discovered component: `release/manifests/<id>.manifest.json` per id and `ClientSideAssets/<bundle>.js` per bundle (`docs/building-packages.md:62` `feature_<id>.xml` + `<featureId>/WebPart_<id>.xml`). Verify via `unzip -l sharepoint/solution/<name>.sppkg` — you should see `<featureId>/WebPart_<firstId>.xml`, `<featureId>/WebPart_<secondId>.xml`, and `ClientSideAssets/todo.js`.

Install once: upload the single `.sppkg` → `Deploy` → site `Add an app` → each web part appears separately in `Add to page` picker by its `preconfiguredEntries.title`.

## Extensions alongside web parts

Extensions live in `src/extensions/` `apps/cli/src/commands/new.ts:98` `rspfx new --component applicationcustomizer|fieldcustomizer|listviewcommandset` (vanilla, `packages/templates/src/index.ts:576`). A project can mix `src/webparts/*` + `src/extensions/*` — discovery merges both (`packages/dev-runtime/src/project.ts:498` `discoverWebParts` with `webpartsDir` + `extensionsDir`). Package embeds them as `<featureId>/Extension_<id>.xml` (`docs/building-packages.md:84`).

## Favicons and assets per web part

Each web part folder has `assets/.gitkeep` (`packages/templates/src/index.ts:109`). The project also scaffolds `assets/favicon.svg` (`packages/templates/src/index.ts:94` `faviconSvg()`) served at `/assets/favicon.svg` (`packages/dev-runtime/src/serve.ts:260`) and referenced by the local preview (`packages/dev-runtime/src/local-page.ts:47` `<link rel="icon" href=".../assets/favicon.svg">`). Per-webpart icons use the web part `assets/` folder; shared branding uses `assets/` or `sharepoint/assets/`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Second web part not found | Folder missing `*.manifest.json` or entrypoint — `discoverWebParts` requires both |
| Duplicate `id` error | Manifest `id` must be unique per component — generate a new `crypto.randomUUID()` |
| 404 for `dist/second.js` in workbench | Bundle name mismatch — `config.json` bundle key vs folder name vs emitted `<name>.js` must agree (`loaderConfig.entryModuleId` follows bundle name) |
| Only first web part in `.sppkg` | `config/config.json` `bundles` authoritative when present — add new `bundles.tod` entry, or delete `config.json` to use folder scan |
