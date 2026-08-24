import { createRequire } from 'node:module';

let native: { parseResx?: (c: string) => Record<string, string> } | undefined;
try {
  const req = createRequire(import.meta.url);
  native = req('../../crates/rspfx-sppkg/index.node');
} catch {}

const RESX_DATA_ENTRY = /<data\s+name="([^"]+)"[^>]*>\s*<value>([\s\S]*?)<\/value>/g;

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
  '&quot;': '"'
};

export function parseResx(content: string): Record<string, string> {
  if (native?.parseResx) {
    try { return native.parseResx(content); } catch {}
  }
  const values: Record<string, string> = {};
  let match: RegExpExecArray | null;
  const regex = new RegExp(RESX_DATA_ENTRY.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    values[match[1]!] = decodeXmlEntities(match[2]!);
  }
  return values;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|apos|quot);/g, (match, entity: string) => XML_ENTITIES[`&${entity};`] ?? match);
}
