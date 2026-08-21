# Agent Note: Brace ProductID and fix Content-Types for SharePoint OPC validation

Status: implemented

## Context

SharePoint tenant app catalog rejected uploaded `.sppkg` with `IsValidAppPackage:false, AppProductID:null, Title:null` because `AppManifest.xml` `ProductID` was emitted as a bare GUID and `[Content_Types].xml` used `application/octet-stream` for `.js`/`.json`/`.png`, causing the OPC parser to fail before reading solution metadata (`packages/sppkg-builder/src/xml.ts:220,88`, `apps/playground/sharepoint/solution/rspfx-playground.sppkg`).

## Decision

Normalize `ProductID` to `"{<guid>}"` in `packages/sppkg-builder/src/xml.ts:220` `buildAppManifestXml()` (wraps bare GUID with braces, idempotent if already braced); map embedded extensions to proper MIME types via `packages/sppkg-builder/src/xml.ts:88` `CONTENT_TYPE_BY_EXTENSION` (`js` → `application/javascript`, `json` → `application/json`, `png` → `image/png`, etc., fallback `application/octet-stream`); document OPC constraints in `reference/FORMATS.md:128` and add the validation symptom to `docs/deployment.md:232` troubleshooting, with expectations updated in `packages/sppkg-builder/tests/sppkg-builder.test.ts:100` (`ProductID="{solutionId}"`).

## Consequences

`pnpm vitest run packages/sppkg-builder/tests/sppkg-builder.test.ts` passes (8/8); rebuilt `apps/playground/sharepoint/solution/rspfx-playground.sppkg` contains `ProductID="{22222222-2222-4222-8222-222222222200}"` and `[Content_Types].xml` with `application/javascript`/`application/json`/`image/png`; `_rels/.rels` correctly points to `AppManifest.xml`; zip root holds `[Content_Types].xml` and `_rels/.rels` per OPC; re-upload to the app catalog validates (`IsValidAppPackage:true`).
