import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { localeToCultureName } from './lcid.js';

let native: {
  serializeXml?: (n: unknown, p: boolean) => string;
  buildRelsXml?: (r: unknown, p: boolean) => string;
  buildContentTypesXml?: (e: string[], p: boolean) => string;
  buildFeatureXml?: (f: unknown, p: boolean) => string;
  buildElementsXml?: (n: string, m: unknown, p: boolean) => string;
  buildAppManifestXml?: (o: unknown) => string;
} | undefined;
try {
  const req = createRequire(import.meta.url);
  native = req('../../crates/rspfx-sppkg/index.node');
} catch {}

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
  return value
    .replace(AMPERSAND, '&amp;')
    .replace(LESS_THAN, '&lt;')
    .replace(GREATER_THAN, '&gt;')
    .replace(DOUBLE_QUOTE, '&quot;')
    .replace(SINGLE_QUOTE, '&apos;');
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
  if (native?.serializeXml && indentLevel === 0) {
    try { return native.serializeXml(node, pretty); } catch {}
  }
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
  if (native?.buildRelsXml) { try { return native.buildRelsXml(relationships, pretty); } catch {} }
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

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  css: 'text/css',
  txt: 'application/octet-stream',
  htm: 'text/html',
  html: 'text/html',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject'
};

const DEFAULT_CONTENT_TYPES_ORDERED: [string, string][] = [
  ['xml', 'text/xml'],
  ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
  ['webpart', 'text/xml'],
  ['htm', 'text/html'],
  ['html', 'text/html'],
  ['aspx', 'text/xml'],
  ['resx', 'text/xml'],
  ['js', 'application/javascript'],
  ['json', 'application/json'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['bmp', 'image/bmp'],
  ['gif', 'image/gif']
];

export function buildContentTypesXml(extensions: string[], pretty: boolean): string {
  if (native?.buildContentTypesXml) { try { return native.buildContentTypesXml(extensions, pretty); } catch {} }
  const defaultSet = new Set(DEFAULT_CONTENT_TYPES_ORDERED.map(([ext]) => ext));
  const extra = [...new Set(extensions.map((e) => e.toLowerCase()))]
    .filter((ext) => !defaultSet.has(ext) && ext !== 'xml' && ext !== 'rels')
    .sort();
  const ordered: [string, string][] = [...DEFAULT_CONTENT_TYPES_ORDERED];
  for (const ext of extra) {
    ordered.push([ext, CONTENT_TYPE_BY_EXTENSION[ext] ?? 'application/octet-stream']);
  }
  const children: XmlNode[] = ordered.map(([ext, ct]) => ({
    name: 'Default',
    attrs: { Extension: ext, ContentType: ct }
  }));
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
  if (native?.buildFeatureXml) { try { return native.buildFeatureXml(feature, pretty); } catch {} }
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

export function buildAppPartConfigXml(_featureId: string, pretty: boolean): string {
  const root: XmlNode = {
    name: 'AppPartConfig',
    attrs: { xmlns: 'http://schemas.microsoft.com/sharepoint/2012/app/partconfiguration' },
    children: [{ name: 'Id', children: [randomUUID()] }]
  };
  return `${XML_DECLARATION}\n${serializeXml(root, pretty)}`;
}

export function buildElementsXml(
  name: string,
  manifest: { id: string; componentType?: string; extensionType?: string },
  pretty: boolean
): string {
  if (native?.buildElementsXml) { try { return native.buildElementsXml(name, manifest, pretty); } catch {} }
  const componentType = manifest.componentType ?? 'WebPart';
  const attrs: XmlAttributes = {
    Name: name,
    Id: manifest.id,
    ComponentManifest: JSON.stringify(manifest),
    Type: componentType
  };
  const componentChildren: XmlNode[] = [];
  if (componentType === 'Extension') {
    const extensionType = manifest.extensionType;
    if (!extensionType) {
      throw new Error(`Extension manifest '${manifest.id}' is missing an 'extensionType'`);
    }
    attrs.ClientSideComponentProperties = 'null';
    attrs.Location = `ClientSideExtension.${extensionType}`;
    componentChildren.push({
      name: 'ClientSideComponentInstance',
      attrs: { Id: randomUUID(), Title: name, Description: name }
    });
  } else if (componentType === 'Library') {
    // Type=Library, no Module/Location/Instance — only ComponentManifest. No extra attrs/children.
  }
  const children: XmlNode[] = [
    {
      name: 'ClientSideComponent',
      singleQuotedAttrs: ['ComponentManifest'],
      attrs,
      ...(componentChildren.length > 0 ? { children: componentChildren } : {})
    }
  ];
  // Only WebPart/AdaptiveCardExtension get a Module; Library and Extension have no Module.
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
  title?: string;
  productId: string;
  version?: string;
  skipFeatureDeployment: boolean;
  isDomainIsolated?: boolean;
  /** SPFx target that produced this manifest — 1.24+ ignores IsDomainIsolated (deprecated). */
  spfxVersion?: string;
  developer?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  localizedStrings?: { locale: string; values: Record<string, string> }[];
  webApiPermissionRequests?: { resource: string; scope: string }[];
  pretty: boolean;
}

const DEVELOPER_PROPERTY_NAMES: string[] = ['name', 'websiteUrl', 'privacyUrl', 'termsOfUseUrl', 'mpnId'];

function isDomainIsolatedDeprecated(spfxVersion?: string): boolean {
  if (!spfxVersion) return false;
  const m = /^1\.(\d+)$/.exec(spfxVersion.trim());
  if (!m) return false;
  return Number(m[1]) >= 24;
}

export function buildAppManifestXml(options: AppManifestOptions): string {
  const effectiveIsDomainIsolated = isDomainIsolatedDeprecated(options.spfxVersion) ? undefined : options.isDomainIsolated;
  const effectiveOptions = effectiveIsDomainIsolated === options.isDomainIsolated ? options : { ...options, isDomainIsolated: effectiveIsDomainIsolated };
  if (native?.buildAppManifestXml) { try { return native.buildAppManifestXml(effectiveOptions); } catch {} }
  const rawProductId = options.productId.trim();
  const productId = rawProductId;
  const attrs: XmlAttributes = {
    xmlns: 'http://schemas.microsoft.com/sharepoint/2012/app/manifest',
    Name: options.name,
    ProductID: productId,
    SharePointMinVersion: '16.0.0.0',
    IsClientSideSolution: 'true'
  };
  if (options.version) {
    attrs.Version = options.version;
  }
  if (options.skipFeatureDeployment) {
    attrs.SkipFeatureDeployment = 'true';
  }
  if (effectiveIsDomainIsolated !== undefined) {
    attrs.IsDomainIsolated = String(effectiveIsDomainIsolated);
  }

  const title = options.title ? String(options.title) : options.name;
  const properties: XmlNode[] = [{ name: 'Title', children: [title] }];

  if (options.developer) {
    const developerProperties: Record<string, string> = {};
    for (const key of DEVELOPER_PROPERTY_NAMES) {
      const value = options.developer[key];
      if (value !== undefined && value !== null) {
        developerProperties[key] = String(value);
      }
    }
    properties.push({ name: 'DeveloperProperties', children: [JSON.stringify(developerProperties)] });
  }

  if (options.metadata) {
    const shortDescription = resolveMetadataValue('ShortDescription', options.metadata.shortDescription, options.localizedStrings);
    const longDescription = resolveMetadataValue('LongDescription', options.metadata.longDescription, options.localizedStrings);
    if (shortDescription) {
      properties.push(shortDescription);
    }
    if (longDescription) {
      properties.push(longDescription);
    }
    if (Array.isArray(options.metadata.categories)) {
      const categories = (options.metadata.categories as unknown[]).map((c) => String(c)).filter((c) => c.length > 0);
      if (categories.length > 0) {
        properties.push({ name: 'CategoryID', children: [categories.slice(0, 3).join(',')] });
      }
    }
    if (typeof options.metadata.videoUrl === 'string') {
      properties.push({ name: 'VideoUrl', children: [options.metadata.videoUrl] });
    }
    if (typeof options.metadata.appIconPath === 'string') {
      properties.push({ name: 'AppIconPath', children: [options.metadata.appIconPath] });
    }
    if (Array.isArray(options.metadata.screenshotPaths)) {
      const screenshots = options.metadata.screenshotPaths as unknown[];
      properties.push({
        name: 'Screenshots',
        children: screenshots.map((p) => ({
          name: 'Screenshot',
          children: [{ name: 'Filename', children: [String(p)] }]
        }))
      });
    }
  }

  const children: XmlNode[] = [{ name: 'Properties', children: properties }];

  if (options.webApiPermissionRequests && options.webApiPermissionRequests.length > 0) {
    children.push({
      name: 'WebApiPermissionRequests',
      children: options.webApiPermissionRequests.map((request) => ({
        name: 'WebApiPermissionRequest',
        attrs: { ResourceId: request.resource, Scope: request.scope }
      }))
    });
  }

  const root: XmlNode = { name: 'App', attrs, children };
  return `${XML_DECLARATION}\n${serializeXml(root, options.pretty)}`;
}

function localizedElement(name: string, locales: Record<string, unknown>): XmlNode {
  const children: XmlNode[] = [];
  for (const [rawLocale, value] of Object.entries(locales)) {
    const cultureName = localeToCultureName(rawLocale);
    children.push({
      name: 'LocalizedString',
      attrs: { CultureName: cultureName },
      children: [String(value)]
    });
  }
  return { name, children };
}

function resolveMetadataValue(
  name: string,
  value: unknown,
  localizedStrings?: { locale: string; values: Record<string, string> }[]
): XmlNode | undefined {
  if (typeof value === 'object' && value !== null) {
    return localizedElement(name, value as Record<string, unknown>);
  }
  if (typeof value !== 'string' || !value.startsWith('$Resources:')) {
    return undefined;
  }
  const key = value.slice('$Resources:'.length);
  const entries = (localizedStrings ?? [])
    .map(({ locale, values }) => ({ cultureName: localeToCultureName(locale), text: values[key] }))
    .filter((entry): entry is { cultureName: string; text: string } => entry.text !== undefined);
  if (entries.length === 0) {
    return { name, children: [value] };
  }
  return {
    name,
    children: entries.map((entry) => ({
      name: 'LocalizedString',
      attrs: { CultureName: entry.cultureName },
      children: [entry.text]
    }))
  };
}
