# Reference extension fixtures — pending harvest

Ground truth for `componentType: Extension` (`ApplicationCustomizer`, `FieldCustomizer`, `ListViewCommandSet`) must be harvested from `yo @microsoft/generator-sharepoint@1.23.2` per `docs/plans/extensions-and-library-support.md:0.1-0.3`.

Expected fixtures (not yet harvested — official generator not run in this environment):

- `reference/extensions/src/extensions/<name>/<name>.manifest.json` source manifest (`componentType: Extension`, `extensionType`, `version: "*"`).
- `reference/extensions/release/manifests/<id>.manifest.json` built manifest with `loaderConfig`.
- `reference/extensions/feature_<id>/Extension_<id>.xml` Elements XML (`Type="Extension"`, `Location="ClientSideExtension.<extensionType>"`, `ClientSideComponentProperties="null"`, `ClientSideComponentInstance` UUID per build, no `<Module>` — see `reference/FORMATS.md` §4 and `packages/sppkg-builder/src/xml.ts:194`).
- `reference/extensions/AppManifest.xml` + `feature_<id>.xml` + `ClientSideAssets/` when `includeClientSideAssets:true`.

Until harvested, `reference/FORMATS.md` §4 describes the XML with provenance.
