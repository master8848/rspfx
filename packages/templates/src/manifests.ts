import { spfxNpmVersion } from '@mbsks/rspfx-core';
import type { TemplateVars } from './types.js';

// Keep in sync with `packages/sppkg-builder/src/xml.ts:194` Location mapping
// (`ClientSideExtension.<extensionType>`) and `packages/dev-runtime/src/project.ts:794`
// pickEntrypoint candidates. Duplication is intentional — single-file template helper.

export function extensionSuffix(vars: TemplateVars): string {
  switch (vars.componentType) {
    case 'applicationcustomizer':
      return 'ApplicationCustomizer';
    case 'fieldcustomizer':
      return 'FieldCustomizer';
    case 'listviewcommandset':
      return 'CommandSet';
    case 'formcustomizer':
      return 'FormCustomizer';
    default:
      throw new Error(`Unexpected component type: ${vars.componentType}`);
  }
}

export function extensionType(vars: TemplateVars): string {
  switch (vars.componentType) {
    case 'applicationcustomizer':
      return 'ApplicationCustomizer';
    case 'fieldcustomizer':
      return 'FieldCustomizer';
    case 'listviewcommandset':
      return 'ListViewCommandSet';
    case 'formcustomizer':
      return 'FormCustomizer';
    default:
      throw new Error(`Unexpected component type: ${vars.componentType}`);
  }
}

export function extensionSpDeps(vars: TemplateVars): Record<string, string> {
  const spVersion = spfxNpmVersion(vars.spfxVersion);
  switch (vars.componentType) {
    case 'applicationcustomizer':
      return {
        '@microsoft/sp-core-library': spVersion,
        '@microsoft/sp-application-base': spVersion,
        '@microsoft/decorators': spVersion
      };
    case 'fieldcustomizer':
      return {
        '@microsoft/sp-core-library': spVersion,
        '@microsoft/sp-field-customizer-base': spVersion,
        '@microsoft/decorators': spVersion
      };
    case 'listviewcommandset':
      return {
        '@microsoft/sp-core-library': spVersion,
        '@microsoft/sp-listview-extensibility': spVersion,
        '@microsoft/decorators': spVersion
      };
    case 'formcustomizer':
      return {
        '@microsoft/sp-core-library': spVersion,
        '@microsoft/sp-listview-extensibility': spVersion,
        '@microsoft/decorators': spVersion
      };
    default:
      throw new Error(`Unexpected extension type: ${vars.componentType}`);
  }
}

export function packageSolution(vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/package-solution.schema.json',
      solution: {
        name: `${vars.name}-client-side-solution`,
        id: vars.solutionId,
        version: '1.0.0.0',
        includeClientSideAssets: true,
        isDomainIsolated: false,
        skipFeatureDeployment: true,
        developer: {
          name: '',
          websiteUrl: '',
          privacyUrl: '',
          termsOfUseUrl: '',
          mpnId: 'Undefined-0000'
        },
        metadata: {
          shortDescription: { default: `${vars.name} description` },
          longDescription: { default: `${vars.name} description` },
          categories: [],
          screenshotPaths: []
        },
        features: [
          {
            title: `${vars.namePascal} Feature`,
            description:
              vars.componentType === 'library'
                ? `A feature which activates the Client-Side Library named '${vars.namePascal}'`
                : (['applicationcustomizer', 'fieldcustomizer', 'listviewcommandset', 'formcustomizer'] as const).includes(
                      vars.componentType as never
                    )
                  ? `A feature which activates the Client-Side Extension named '${vars.namePascal}'`
                  : `A feature which activates the Client-Side WebPart named '${vars.namePascal}'`,
            id: vars.featureId,
            version: '1.0.0.0',
            assets: { elementManifests: [], elementFiles: [] }
          }
        ]
      },
      paths: { zippedPackage: `sharepoint/solution/${vars.name}.sppkg` }
    },
    null,
    2
  );
}

export function serveJson(_vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/spfx-serve.schema.json',
      initialPage: 'https://{tenantdomain}/_layouts/15/workbench.aspx',
      https: true,
      port: 4321,
      hostname: 'localhost'
    },
    null,
    2
  );
}

export function writeManifestsJson(): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/write-manifests.schema.json',
      cdnBasePath: ''
    },
    null,
    2
  );
}

export function configJson(vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx-build/config.1.0.schema.json',
      localizedResources: {
        [`${vars.namePascal}WebPartStrings`]: `src/webparts/${vars.name}/loc/{locale}.js`
      }
    },
    null,
    2
  );
}

export function teamsManifest(vars: TemplateVars): string {
  const componentId = vars.componentId;
  const tabUrl = `https://{teamSiteDomain}{teamSitePath}/_layouts/15/TeamsLogon.aspx?SPFX=true&dest={teamSitePath}/_layouts/15/teamshostedapp.aspx%3FopenPropertyPane=true%26teams%26componentId=${componentId}%26forceLocale={locale}`;
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/teams/v1.13/MicrosoftTeams.schema.json',
      manifestVersion: '1.13',
      version: '1.0.0',
      id: componentId,
      packageName: `com.contoso.${vars.name}`,
      developer: {
        name: 'SPFx + Teams Dev',
        websiteUrl: 'https://products.office.com/en-us/sharepoint/collaboration',
        privacyUrl: 'https://privacy.microsoft.com/en-us/privacystatement',
        termsOfUseUrl: 'https://www.microsoft.com/en-us/servicesagreement'
      },
      name: { short: vars.name, full: vars.name },
      description: { short: `${vars.name} description`, full: `${vars.name} description` },
      icons: { outline: `${componentId}_outline.png`, color: `${componentId}_color.png` },
      accentColor: '#FFFFFF',
      staticTabs: [
        {
          entityId: componentId,
          name: vars.name,
          contentUrl: tabUrl,
          websiteUrl: 'https://products.office.com/en-us/sharepoint/collaboration',
          scopes: ['personal']
        }
      ],
      configurableTabs: [
        {
          configurationUrl: tabUrl,
          canUpdateConfiguration: true,
          scopes: ['team']
        }
      ],
      validDomains: [
        '*.login.microsoftonline.com',
        '*.sharepoint.com',
        '*.sharepoint-df.com',
        'spoppe-a.akamaihd.net',
        'spoprod-a.akamaihd.net',
        '*.microsoftonline.com',
        '*.microsoftonline-p.com',
        '*.msauth.net',
        '*.msauthimages.net',
        '*.msftauth.net',
        '*.msftauthimages.net',
        '*.office.com',
        '*.officeapps.live.com',
        '*.secure.aadcdn.microsoftonline-p.com'
      ]
    },
    null,
    2
  );
}

export function webpartManifest(vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-web-part-manifest.schema.json',
      id: vars.componentId,
      alias: `${vars.namePascal}WebPart`,
      componentType: 'WebPart',
      version: '*',
      manifestVersion: 2,
      safeWithCustomScriptDisabled: true,
      supportedHosts: ['SharePointWebPart', 'TeamsPersonalApp', 'TeamsTab', 'SharePointFullPage'],
      preconfiguredEntries: [
        {
          groupId: '5c31a052-22b4-4f36-8f7d-4b4d8c7c2e7a',
          group: { default: 'Other' },
          title: { default: vars.namePascal },
          description: { default: `${vars.name} web part` },
          officeFabricIconFontName: 'Page',
          properties: { description: vars.name }
        }
      ]
    },
    null,
    2
  );
}

export function extensionManifest(vars: TemplateVars): string {
  const manifest = {
    $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-extension-manifest.schema.json',
    id: vars.componentId,
    alias: `${vars.namePascal}${extensionSuffix(vars)}`,
    componentType: 'Extension',
    extensionType: extensionType(vars),
    version: '*',
    manifestVersion: 2,
    requiresCustomScript: false
  };
  if (vars.componentType === 'listviewcommandset') {
    return JSON.stringify(
      {
        ...manifest,
        items: {
          [`${vars.namePascal.toUpperCase()}_1`]: { title: { default: 'Command One' }, type: 'command' },
          [`${vars.namePascal.toUpperCase()}_2`]: { title: { default: 'Command Two' }, type: 'command' }
        }
      },
      null,
      2
    );
  }
  return JSON.stringify(manifest, null, 2);
}

export function libraryManifest(vars: TemplateVars): string {
  return JSON.stringify(
    {
      $schema: 'https://developer.microsoft.com/json-schemas/spfx/client-side-library-manifest.schema.json',
      id: vars.componentId,
      alias: `${vars.namePascal}Library`,
      componentType: 'Library',
      version: '*',
      manifestVersion: 2
    },
    null,
    2
  );
}
