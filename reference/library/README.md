# Reference library fixtures — pending harvest

Ground truth for `componentType: Library` must be harvested from `yo @microsoft/generator-sharepoint@1.23.2` per `docs/plans/extensions-and-library-support.md:0.1-0.3`.

Expected fixtures (not yet harvested — official generator not run in this environment):

- `reference/library/src/libraries/<name>/<name>.manifest.json` source manifest (`componentType: Library`, `alias`, `version: "*"`, `manifestVersion: 2`, `https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json`, no `preconfiguredEntries`).
- `reference/library/release/manifests/<id>.manifest.json` built manifest with `loaderConfig` (`entryModuleId`, `internalModuleBaseUrls`, `scriptResources`).
- `reference/library/feature_<id>/Library_<id>.xml` Elements XML (`Type="Library"`, single-quoted `ComponentManifest`, no `<Module>`/`Location`/`Instance` — see `reference/FORMATS.md` §4 and `packages/sppkg-builder/src/xml.ts:181`).
- `reference/library/AppManifest.xml` + `feature_<id>.xml` + `ClientSideAssets/` when `includeClientSideAssets:true`.

Until harvested, `reference/FORMATS.md` §1 and §4 describe the schema with provenance line and XML snippet.

Placeholder manifest shape (do not use as ground truth):

```jsonc
{
  "$schema": "https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json",
  "id": "00000000-0000-0000-0000-000000000000",
  "alias": "ExampleLibrary",
  "componentType": "Library",
  "version": "*",
  "manifestVersion": 2
}
```
