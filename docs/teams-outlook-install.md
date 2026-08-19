# Teams and Outlook install

Teams and Outlook share the same Teams app manifest. RSPFX scaffolds `teams/manifest.json` + `teams/<id>_color.png` (192x192) + `teams/<id>_outline.png` (32x32) and `rspfx package` bundles them under `ClientSideAssets/` in the `.sppkg`. SharePoint app catalog syncs the app to Teams and, when the manifest has `personal` scope, to Outlook (new Outlook).

## What the scaffold generates

`teams/manifest.json` is Teams schema 1.13: `id` equals the SharePoint component `id` (`packages/templates/src/index.ts:112` `solidPng(192,192,[0,120,212])`), `packageName` `com.contoso.<name>`, `staticTabs` (`personal`, `entityId` = component `id`, `contentUrl` = `https://{teamSiteDomain}{teamSitePath}/_layouts/15/TeamsLogon.aspx?SPFX=true&dest={teamSitePath}/_layouts/15/teamshostedapp.aspx%3FopenPropertyPane=true%26teams%26componentId=<id>%26forceLocale={locale}`) and `configurableTabs` (`team`, `canUpdateConfiguration: true`), `validDomains` includes `*.sharepoint.com`, `*.office.com`, `*.secure.aadcdn.microsoftonline-p.com`, `*.login.microsoftonline.com`, `spoprod-a.akamaihd.net` (`packages/templates/src/index.ts:468`).

## Install to SharePoint + Teams

Build and package: `rspfx package` → `sharepoint/solution/<name>.sppkg` (`docs/building-packages.md:10`).

SharePoint: upload the `.sppkg` to the tenant app catalog (`SharePoint Admin Center → App Catalog → Apps for SharePoint`) → `Deploy` or `skipFeatureDeployment: true` (`config/package-solution.json:355`). On any site: `Add an app` → your solution → `Add`.

Teams: in the same app catalog entry, `Sync to Teams` (or `Teams Admin Center → Manage apps → Upload`). The app appears in `Teams → Apps → Built for your org`. The `package-solution.json` `supportedHosts` already includes `TeamsPersonalApp` and `TeamsTab` (`packages/templates/src/index.ts:500`). If `Sync to Teams` is missing, verify `includeClientSideAssets: true` and that `teams/` was present at `rspfx package` time (`packages/sppkg-builder/src/sppkg-builder.ts:86` auto-detects `teams/`).

## Install to Outlook (new Outlook)

Outlook (new) surfaces Teams personal apps (`personal` scope) automatically — no separate Outlook manifest.

Prerequisites: Teams app synced and approved by admin, user has the app `Allowed` in `Teams Admin Center → Permission policies`, and `Outlook` is `new Outlook` (Monarch) not classic. After sync, wait 10–120 minutes for the Microsoft 365 app sync, then `Outlook → Apps → Apps built for your org` → your app → `Add`. The single Teams `contentUrl` with `SPFX=true&teams&componentId=` loads the web part inside Outlook's Teams host (same `TeamsLogon.aspx` + `teamshostedapp.aspx` path). If the app does not appear in Outlook, confirm `manifest.json` `staticTabs[0].scopes` contains `personal` (`teamsManifest:458`) and `validDomains` includes `*.office.com` and `*.outlook.office.com` (add if missing; current scaffold does not include `*.outlook.office.com` — add manually and repack).

## Update and uninstall

Update: bump `package.json` `version` + `config/package-solution.json` `solution.version`, `rspfx package`, re-upload the `.sppkg` to the catalog → `Replace` → `Deploy`; Teams/Outlook pull the new `ClientSideAssets/` on next load (manifest `version` `*` → `1.0.0` mapping in `release/manifests`).

Uninstall: `Teams Admin Center → Manage apps → <app> → Block` or catalog → `Remove` (also remove from `Recycle Bin`). Outlook follows Teams block.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| App not in Teams Apps | Catalog `Sync to Teams` not clicked, or `teams/` missing at `rspfx package` time — verify `ClientSideAssets/teams/` in the `.sppkg` unzip |
| `Invalid Teams manifest` on upload | `teams/manifest.json` `id` must match SharePoint `componentId`; `validDomains` must contain `*.sharepoint.com`; `manifestVersion` must be `1.13` |
| App in Teams but not Outlook | Not yet synced (wait, sign out/in), `scopes` missing `personal`, or Outlook is classic — use new Outlook |
| White screen in Teams/Outlook | `contentUrl` `forceLocale={locale}` requires `TeamsLogon.aspx` reachable — check `contentUrl` encoding (`%26` not `&`) in `teamsManifest:425` |
