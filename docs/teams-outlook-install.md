# Teams and Outlook install

Teams and Outlook share the same Teams app manifest. See Microsoft docs: [Integrate with Microsoft Teams](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/integrate-with-teams-introduction) and [Build SharePoint Teams apps](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/sharepoint-teams-apps).

RSPFX scaffolds `teams/manifest.json` + `teams/<id>_color.png` (192×192) + `teams/<id>_outline.png` (32×32); `rspfx package` bundles them under `ClientSideAssets/teams/` in the `.sppkg`.

SharePoint's app catalog syncs the app to Teams and, with `personal` scope, to new Outlook.

## What scaffold generates

`teams/manifest.json` — Teams schema 1.13 ([MicrosoftTeams.schema.json](https://developer.microsoft.com/json-schemas/teams/v1.13/MicrosoftTeams.schema.json)):

- `id` equals the SharePoint component `id`.
- `packageName` like `com.contoso.<name>`.
- `staticTabs` (`personal`, `entityId` = component `id`, `contentUrl` = `TeamsLogon.aspx?SPFX=true&dest=teamshostedapp.aspx%3F...%26componentId=<id>`) and `configurableTabs` (`team`, `canUpdateConfiguration: true`).
- `validDomains` includes `*.sharepoint.com`, `*.office.com`, `*.secure.aadcdn.microsoftonline-p.com`, `*.login.microsoftonline.com`, `spoprod-a.akamaihd.net`.

> **Tip:** For reliable Outlook surfacing add `*.outlook.office.com` to `validDomains` manually — scaffold omits it.

> **Tip:** `id` and `staticTabs[0].entityId` must stay equal to the SharePoint web part `id` — regenerating the web part `id` without updating `teams/manifest.json` breaks install.

## Install to SharePoint + Teams

Build first:

```sh
rspfx package   # → sharepoint/solution/<name>.sppkg
```

SharePoint — upload `.sppkg` to the tenant app catalog (`SharePoint Admin Center → App Catalog → Apps for SharePoint`) → **Deploy** (or `skipFeatureDeployment: true` in `config/package-solution.json`).

On any site: `Add an app` → your solution → **Add**.

Teams — in the same catalog entry click **Sync to Teams** (or Teams Admin Center → Manage apps → Upload).

The app appears in `Teams → Apps → Built for your org`.

The scaffolded `package-solution.json` `supportedHosts` already includes `TeamsPersonalApp` and `TeamsTab`.

If **Sync to Teams** is missing, verify `includeClientSideAssets: true` and that `teams/` existed at `rspfx package` time.

## Install to Outlook (new Outlook)

New Outlook surfaces Teams personal apps (`personal` scope) automatically — no separate manifest.

Prerequisites:

- Teams app synced and admin-approved.
- User **Allowed** in `Teams Admin Center → Permission policies`.
- Client is **new Outlook** (Monarch), not classic.

After sync wait 10–120 minutes for Microsoft 365 app sync, then `Outlook → Apps → Apps built for your org` → your app → **Add**.

The same `contentUrl` with `SPFX=true&teams&componentId=` loads the web part inside Outlook's Teams host.

If it does not appear, confirm `staticTabs[0].scopes` includes `personal` and `validDomains` includes `*.office.com` plus `*.outlook.office.com` (add manually and repack).

## Update and uninstall

- **Update:** bump `package.json` `version` + `config/package-solution.json` `solution.version`, `rspfx package`, re-upload → **Replace** → **Deploy**; Teams/Outlook pull new `ClientSideAssets/` on next load.
- **Uninstall:** `Teams Admin Center → Manage apps → <app> → Block` or catalog → **Remove** (also clear Recycle Bin).

Outlook follows Teams block.

## Comparison vs official

| Area | Official SPFx + Teams | RSPFX |
|---|---|---|
| Teams manifest | Manual `manifest.json` or `yo @microsoft/sharepoint` | Scaffolded — `id`/`entityId` auto-synced to web part |
| Packaging | `gulp package-solution` embeds `teams/` | `rspfx package` — same, auto-detected |
| Sync | Catalog **Sync to Teams** | Same |
| Outlook | `personal` scope surfaces in new Outlook | Same — no extra steps |

## Troubleshooting

| Symptom | Fix |
|---|---|
| App not in Teams Apps | **Sync to Teams** not clicked, or `teams/` missing at package time — check `unzip -l` shows `ClientSideAssets/teams/` |
| `Invalid Teams manifest` | `teams/manifest.json` `id` must match SharePoint component `id`; `validDomains` must contain `*.sharepoint.com`; `manifestVersion` `1.13` |
| App in Teams but not Outlook | Wait for sync, check `scopes` has `personal`, use new Outlook, add `*.outlook.office.com` |
| White screen in Teams/Outlook | `contentUrl` encoding — must use `%26` not `&` — check Teams manifest |
