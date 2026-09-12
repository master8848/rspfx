# Multi web part

TL;DR: Ship several web parts, extensions, and libraries in one package. Duplicate a web part folder, give it a new ID, and rebuild.

`rspfx new` scaffolds the first web part. You add more by copying the folder and manifest.

<Steps>

## Step 1: Scaffold the first web part

Create a project with one web part:

```sh
rspfx new my-app --framework react --spfx-version 1.23 --yes
```

This creates `src/webparts/my-app/` with `my-app.manifest.json` and `my-appWebPart.ts`.

## Step 2: Add a second web part

Copy `src/webparts/my-app/` to `src/webparts/todo/` and rename three things:

1. Folder `src/webparts/todo/` - bundle name is the folder name.
2. Inside `todo.manifest.json` - new `id` with `node -e "console.log(crypto.randomUUID())"`, `alias: TodoWebPart`, and `preconfiguredEntries[0].title: Todo`.
3. Inside `todoWebPart.ts` and `components/Todo.tsx` - rename class `TodoWebPart`, import `Todo`, and style key `styles.Todo`.

`config/config.json` bundles and `config/package-solution.json` features are not needed per web part. Auto discovery scans `src/webparts/*` when `bundles` is absent.

If `config.json` has explicit `bundles`, add a new entry `todo` with its `entrypoint` and `manifest`.

Delete `config.json` to use folder scan. That is the simplest mode for many web parts.

## Step 3: Add a third, fourth, and more

Repeat the copy and rename. Each `src/webparts/<folder>/` needs one `*.manifest.json` and one entrypoint like `<Name>WebPart.ts` or `index.ts`.

Keep `teams/` and `sharepoint/assets` as singletons for the project.

Generate each manifest `id` with `crypto.randomUUID()`. Never copy the first ID.

</Steps>

## Build, dev, and package

- `rspfx dev` - finds all web parts and serves `https://localhost:4321/dist/<bundle>.js` per folder. `/temp/manifests.js` concatenates every `id`. Local preview at `http://localhost:4321/` shows a card per web part.
- `rspfx package` - one `.sppkg` for all parts: `release/manifests/<id>.manifest.json` per id and `ClientSideAssets/<bundle>.js` per bundle.

Verify the package:

```sh
unzip -l sharepoint/solution/<name>.sppkg
```

Expect `WebPart_<firstId>.xml`, `WebPart_<secondId>.xml`, and files like `ClientSideAssets/todo.js`.

Install once - upload the single `.sppkg` then Deploy. Each web part shows up by its `preconfiguredEntries.title` in the add picker.

Use `rspfx analyze` to see per bundle sizes before you pack.

## Extensions alongside web parts

Add extensions with:

```sh
rspfx new --component applicationcustomizer
```

Extensions live in `src/extensions/`. You can mix `src/webparts/*` and `src/extensions/*`. Package embeds them as `<featureId>/Extension_<id>.xml`.

## Libraries alongside web parts

Add libraries with:

```sh
rspfx new --component library
```

Libraries live in `src/libraries/`. You can mix `src/webparts/*`, `src/extensions/*`, and `src/libraries/*`. Package embeds them as `<featureId>/Library_<id>.xml` with `Type="Library"`.

Local preview lists libraries as non mountable. `window.__RSPFX_COMPONENTS__` still exposes them for `import('<alias>')`.

## Favicons and assets per web part

- Each web part folder has `assets/.gitkeep`.
- Project `assets/favicon.svg` is served at `/assets/favicon.svg` and shown in local preview.

Use per web part icons in `src/webparts/<name>/assets/`. Use shared branding in `assets/` or `sharepoint/assets/`.

See [Favicon and assets](./favicon-and-assets.md).

## Comparison

| Area | Official | RSPFx |
|---|---|---|
| Discovery | `config.json` bundles only | `bundles` or folder scan `src/webparts/*` |
| Add a web part | `yo @microsoft/sharepoint` or manual `config.json` | duplicate folder plus new `id` |
| Packaging | one `.sppkg` with all bundles | same |
| Dev server | all bundles on port 4321 | same at `https://localhost:4321/dist/<bundle>.js` |

## Troubleshoot

| Symptom | Fix |
|---|---|
| Second web part not found | folder needs `*.manifest.json` and entrypoint |
| Duplicate `id` error | manifest `id` must be unique |
| 404 for `dist/second.js` | bundle name must match `entryModuleId` |
| Only first web part in `.sppkg` | `config.json` bundles is authoritative - add entry or delete file for scan |

For file rules, see [../../reference/project-structure.md](../../reference/project-structure.md).
