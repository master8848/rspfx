# Teams and Outlook install

TL;DR: Teams and Outlook share one Teams manifest. RSPFx scaffolds it, bundles it in the `.sppkg`, and you sync it from the app catalog to Teams.

RSPFx scaffolds `teams/manifest.json` plus two icons. `rspfx package` puts them under `ClientSideAssets/teams/` in the zip. SharePoint syncs the app to Teams and, with `personal` scope, to new Outlook.

## What scaffold creates

`teams/manifest.json` uses Teams schema 1.13:

- `id` equals the SharePoint component `id`.
- `packageName` like `com.contoso.<name>`.
- `staticTabs` with `personal` scope, `entityId` equals component `id`, and `contentUrl` with `TeamsLogon.aspx?SPFX=true&dest=teamshostedapp.aspx%3F...%26componentId=<id>`.
- `configurableTabs` with `team` scope and `canUpdateConfiguration: true`.
- `validDomains` includes `*.sharepoint.com`, `*.office.com`, `*.secure.aadcdn.microsoftonline-p.com`, `*.login.microsoftonline.com`, `spoprod-a.akamaihd.net`.

Icons: `teams/<id>_color.png` at 192 by 192 and `teams/<id>_outline.png` at 32 by 32. Schema is at `https://developer.microsoft.com/json-schemas/teams/v1.13/MicrosoftTeams.schema.json`.

Keep `id` and `staticTabs[0].entityId` equal to your web part `id`. If you regenerate the web part `id`, update `teams/manifest.json`.

For reliable Outlook, add `*.outlook.office.com` to `validDomains` by hand. Scaffold omits it.

<Steps>

## Step 1: Build

Create the package:

```sh
rspfx package
```

Check that `unzip -l sharepoint/solution/<name>.sppkg` shows `ClientSideAssets/teams/`.

## Step 2: Install to SharePoint

Upload the `.sppkg` to the tenant app catalog at `SharePoint Admin Center` then `App Catalog` then `Apps for SharePoint`. Click Deploy. Or set `skipFeatureDeployment: true` in `config/package-solution.json`.

On any site, add the app with `Add an app` then your solution.

Your `package-solution.json` `supportedHosts` should include `TeamsPersonalApp` and `TeamsTab`. Scaffold sets this.

If Sync to Teams is missing, check `includeClientSideAssets: true` and that `teams/` existed when you ran `rspfx package`.

## Step 3: Install to Teams

In the same catalog entry click Sync to Teams. Or open Teams Admin Center then `Manage apps` then Upload.

The app appears in `Teams` then `Apps` then `Built for your org`.

## Step 4: Install to Outlook

New Outlook shows Teams personal apps with `personal` scope. No extra manifest is needed.

You need:

- Teams app synced and approved by an admin.
- User set to Allowed in `Teams Admin Center` then `Permission policies`.
- New Outlook client, not classic.

Wait 10 to 120 minutes after sync. Then open `Outlook` then `Apps` then `Apps built for your org`. Click Add.

The same `contentUrl` with `SPFX=true&teams&componentId=` loads the web part inside Outlook.

If it does not appear, check `staticTabs[0].scopes` has `personal`, check `validDomains` has `*.office.com` plus `*.outlook.office.com`, and use new Outlook.

## Step 5: Update and uninstall

To update, bump `package.json` `version` and `config/package-solution.json` `solution.version`, run `rspfx package`, and re-upload then Replace then Deploy. Teams and Outlook load new assets on next open.

To remove, block in `Teams Admin Center` then `Manage apps` then `<app>` then Block, or Remove from the catalog and clear the Recycle Bin. Outlook follows Teams block.

</Steps>

## Comparison

| Area | Official SPFx plus Teams | RSPFx |
|---|---|---|
| Teams manifest | manual or `yo` | scaffolded - `id` and `entityId` synced |
| Packaging | `gulp package-solution` | `rspfx package` - same |
| Sync | catalog Sync to Teams | same |
| Outlook | `personal` scope | same |

## Troubleshoot

| Symptom | Fix |
|---|---|
| App not in Teams | Sync to Teams not clicked or `teams/` missing at package time |
| `Invalid Teams manifest` | check `id` equals component `id` and `validDomains` has `*.sharepoint.com` |
| App in Teams but not Outlook | wait for sync, check `personal` scope, add `*.outlook.office.com` |
| White screen in Teams or Outlook | `contentUrl` must use `%26` not `&` |

For pipeline details, see [../../reference/architecture.md](../../reference/architecture.md).
