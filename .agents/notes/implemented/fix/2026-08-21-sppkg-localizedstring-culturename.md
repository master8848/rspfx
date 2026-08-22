# Agent Note: Fix AppManifest LocalizedString to CultureName

Status: implemented

## Context

Validating an `.sppkg` in the SharePoint app catalog failed with `Xml Validation Exception: 'The LCID attribute is not declared'`, `'The Value attribute is not declared'`, `'The required attribute CultureName is missing'` on the `LocalizedString` elements inside `ShortDescription`/`LongDescription` at lines 6 and 9 (`packages/sppkg-builder/src/xml.ts:296` `localizedElement` and `packages/sppkg-builder/src/xml.ts:317` `resolveMetadataValue` emitted `<LocalizedString LCID="..." Value="..."/>`, while the SharePoint `http://schemas.microsoft.com/sharepoint/2012/app/manifest` schema requires `<LocalizedString CultureName="...">value</LocalizedString>`; reference official `AppManifest.xml` from `pnp-modern-search` shows `CultureName="default"` with inner text).

## Decision

Emit `CultureName` with inner text in `packages/sppkg-builder/src/xml.ts:296` `localizedElement` and `packages/sppkg-builder/src/xml.ts:317` `resolveMetadataValue` via new helpers `localeToCultureName` and `lcidToCultureName` in `packages/sppkg-builder/src/lcid.ts:68` (reverse `LOCALE_TO_LCID` to `LCID_TO_CULTURE`, normalize `default` and `ll-CC` to `ll-CC` with uppercased region, handle numeric LCID fallbacks); change `packages/sppkg-builder/src/sppkg-builder.ts:484` `collectResx` to map `Resources.resx` to locale `default` so `$Resources:` resx entries produce `CultureName="default"` and `Resources.<lang>.resx` produce their `CultureName` (e.g. `fr-FR`); update localized tests in `packages/sppkg-builder/tests/localization.test.ts:91` to expect `CultureName` with inner text and entity escaping via `escapeXmlText`; update reference docs `docs/project-structure.md:43`, `docs/commands.md:132`, `docs/building-packages.md:89`, `docs/internal-api.md:375` from `LCID 1033` to `CultureName="default"`.

## Consequences

`bunx vitest run packages/sppkg-builder/tests/localization.test.ts` passes 12/12 and `packages/sppkg-builder/tests/sppkg-builder.test.ts` passes 8/8; `bun run build` succeeds; `buildAppManifestXml({metadata:{shortDescription:{default:'x'}}})` now yields `<LocalizedString CultureName="default">x</LocalizedString>` and `$Resources:` resx entries yield `<LocalizedString CultureName="default">` and `<LocalizedString CultureName="fr-FR">`; packaged `.sppkg` `AppManifest.xml` validates against the SharePoint manifest XSD without `LCID`/`Value` errors and installs in the app catalog.
