export interface XmlAttributes {
  [name: string]: string;
}

export type XmlChild = XmlNode | string;

export interface XmlNode {
  name: string;
  attrs?: XmlAttributes;
  children?: XmlChild[];
  singleQuotedAttrs?: string[];
}

export interface Relationship {
  type: string;
  target: string;
}

export const XML_DECLARATION: string = '<?xml version="1.0" encoding="utf-8"?>';

const AMPERSAND = /&/g;
const LESS_THAN = /</g;
const GREATER_THAN = />/g;
const DOUBLE_QUOTE = /"/g;
const SINGLE_QUOTE = /'/g;

export function escapeXmlText(value: string): string {
  return value.replace(AMPERSAND, '&amp;').replace(LESS_THAN, '&lt;').replace(GREATER_THAN, '&gt;');
}

export function escapeXmlAttribute(value: string): string {
  return value
    .replace(AMPERSAND, '&amp;')
    .replace(LESS_THAN, '&lt;')
    .replace(GREATER_THAN, '&gt;')
    .replace(DOUBLE_QUOTE, '&quot;')
    .replace(SINGLE_QUOTE, '&apos;');
}

export function serializeXml(node: XmlNode, pretty: boolean, indentLevel: number = 0): string {
  const singleQuoted = new Set(node.singleQuotedAttrs ?? []);
  const attributePart = node.attrs
    ? Object.entries(node.attrs)
        .map(([name, value]) =>
          singleQuoted.has(name)
            ? ` ${name}='${escapeXmlAttribute(value)}'`
            : ` ${name}="${escapeXmlAttribute(value)}"`
        )
        .join('')
    : '';
  const children = node.children ?? [];
  const indent = pretty ? '  '.repeat(indentLevel) : '';
  if (children.length === 0) {
    return `${indent}<${node.name}${attributePart}/>`;
  }
  if (children.every((child) => typeof child === 'string')) {
    const text = children.map((child) => escapeXmlText(child as string)).join('');
    return `${indent}<${node.name}${attributePart}>${text}</${node.name}>`;
  }
  if (!pretty) {
    const inline = children
      .map((child) => (typeof child === 'string' ? escapeXmlText(child) : serializeXml(child, false, 0)))
      .join('');
    return `<${node.name}${attributePart}>${inline}</${node.name}>`;
  }
  const inner = children
    .map((child) => (typeof child === 'string' ? escapeXmlText(child) : serializeXml(child, true, indentLevel + 1)))
    .join('\n');
  return `${indent}<${node.name}${attributePart}>\n${inner}\n${indent}</${node.name}>`;
}

export function buildRelsXml(relationships: Relationship[], pretty: boolean): string {
  const children: XmlNode[] = relationships.map((relationship, index) => ({
    name: 'Relationship',
    attrs: { Id: `rId${index + 1}`, Type: relationship.type, Target: relationship.target }
  }));
  const root: XmlNode = {
    name: 'Relationships',
    attrs: { xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships' },
    children
  };
  return `${XML_DECLARATION}\n${serializeXml(root, pretty)}`;
}

export function buildContentTypesXml(extensions: string[], pretty: boolean): string {
  const children: XmlNode[] = [
    {
      name: 'Default',
      attrs: { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }
    },
    { name: 'Default', attrs: { Extension: 'xml', ContentType: 'application/xml' } },
    ...extensions.map((extension) => ({
      name: 'Default',
      attrs: { Extension: extension, ContentType: 'application/octet-stream' }
    }))
  ];
  const root: XmlNode = {
    name: 'Types',
    attrs: { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' },
    children
  };
  return `${XML_DECLARATION}\n${serializeXml(root, pretty)}`;
}

export interface FeatureXmlInfo {
  title: string;
  description: string;
  id: string;
  version: string;
}

export function buildFeatureXml(feature: FeatureXmlInfo, pretty: boolean): string {
  const root: XmlNode = {
    name: 'Feature',
    attrs: {
      xmlns: 'http://schemas.microsoft.com/sharepoint/',
      Title: feature.title,
      Description: feature.description,
      Id: feature.id,
      Version: feature.version,
      Scope: 'Web',
      Hidden: 'FALSE'
    }
  };
  return `${XML_DECLARATION}\n${serializeXml(root, pretty)}`;
}

export function buildAppPartConfigXml(featureId: string, pretty: boolean): string {
  const root: XmlNode = {
    name: 'AppPartConfig',
    attrs: { xmlns: 'http://schemas.microsoft.com/sharepoint/2012/app/partconfiguration' },
    children: [{ name: 'Id', children: [featureId] }]
  };
  return `${XML_DECLARATION}\n${serializeXml(root, pretty)}`;
}

export function buildElementsXml(
  name: string,
  manifest: { id: string; componentType?: string },
  pretty: boolean
): string {
  const componentType = manifest.componentType ?? 'WebPart';
  const children: XmlNode[] = [
    {
      name: 'ClientSideComponent',
      singleQuotedAttrs: ['ComponentManifest'],
      attrs: {
        Name: name,
        Id: manifest.id,
        ComponentManifest: JSON.stringify(manifest),
        Type: componentType
      }
    }
  ];
  if (componentType === 'WebPart' || componentType === 'AdaptiveCardExtension') {
    children.push({ name: 'Module', attrs: { Name: name, Url: '_catalogs/wp', List: '113' } });
  }
  const root: XmlNode = {
    name: 'Elements',
    attrs: { xmlns: 'http://schemas.microsoft.com/sharepoint/' },
    children
  };
  return `${XML_DECLARATION}\n${serializeXml(root, pretty)}`;
}

export interface AppManifestOptions {
  name: string;
  productId: string;
  version?: string;
  skipFeatureDeployment: boolean;
  isDomainIsolated: boolean;
  developer?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  webApiPermissionRequests?: { resource: string; scope: string }[];
  pretty: boolean;
}

const DEVELOPER_PROPERTY_NAMES: string[] = ['name', 'websiteUrl', 'privacyUrl', 'termsOfUseUrl', 'mpnId'];

export function buildAppManifestXml(options: AppManifestOptions): string {
  const attrs: XmlAttributes = {
    xmlns: 'http://schemas.microsoft.com/sharepoint/2012/app/manifest',
    Name: options.name,
    ProductID: options.productId,
    SharePointMinVersion: '16.0.0.0',
    IsClientSideSolution: 'true'
  };
  if (options.version) {
    attrs.Version = options.version;
  }
  if (options.skipFeatureDeployment) {
    attrs.SkipFeatureDeployment = 'true';
  }
  if (options.isDomainIsolated) {
    attrs.IsDomainIsolated = 'true';
  }

  const properties: XmlNode[] = [{ name: 'Title', children: [options.name] }];

  if (options.developer) {
    const developerProperties: Record<string, string> = {};
    for (const key of DEVELOPER_PROPERTY_NAMES) {
      if (options.developer[key] !== undefined) {
        developerProperties[key] = String(options.developer[key]);
      }
    }
    if (Object.keys(developerProperties).length > 0) {
      properties.push({ name: 'DeveloperProperties', children: [JSON.stringify(developerProperties)] });
    }
  }

  if (options.metadata) {
    const shortDescription = options.metadata.shortDescription;
    const longDescription = options.metadata.longDescription;
    if (typeof shortDescription === 'object' && shortDescription !== null) {
      properties.push(localizedElement('ShortDescription', shortDescription as Record<string, unknown>));
    }
    if (typeof longDescription === 'object' && longDescription !== null) {
      properties.push(localizedElement('LongDescription', longDescription as Record<string, unknown>));
    }
    if (Array.isArray(options.metadata.categories)) {
      for (const category of options.metadata.categories) {
        properties.push({ name: 'Category', children: [String(category)] });
      }
    }
    if (typeof options.metadata.videoUrl === 'string') {
      properties.push({ name: 'VideoUrl', children: [options.metadata.videoUrl] });
    }
    if (typeof options.metadata.appIconPath === 'string') {
      properties.push({ name: 'AppIconPath', children: [options.metadata.appIconPath] });
    }
  }

  const children: XmlNode[] = [{ name: 'Properties', children: properties }];

  if (options.webApiPermissionRequests && options.webApiPermissionRequests.length > 0) {
    children.push({
      name: 'WebApiPermissionRequests',
      children: options.webApiPermissionRequests.map((request) => ({
        name: 'RequestedWebApiPermission',
        attrs: { Resource: request.resource, Scope: request.scope }
      }))
    });
  }

  const root: XmlNode = { name: 'App', attrs, children };
  return `${XML_DECLARATION}\n${serializeXml(root, options.pretty)}`;
}

function localizedElement(name: string, locales: Record<string, unknown>): XmlNode {
  const children: XmlNode[] = [];
  for (const [lcid, value] of Object.entries(locales)) {
    children.push({
      name: 'LocalizedString',
      attrs: { LCID: lcid === 'default' ? '1033' : lcid, Value: String(value) }
    });
  }
  return { name, children };
}
