import { writeFile, readFile } from 'node:fs/promises';
import { unzipSync, zipSync } from 'fflate';

export interface ZipFileEntry {
  name: string;
  buffer: Uint8Array;
}

export interface SppkgValidationResult {
  ok: boolean;
  errors: string[];
}

export async function writeZip(outputPath: string, entries: ZipFileEntry[]): Promise<void> {
  const record: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    if (entry.name in record) {
      throw new Error(`Duplicate zip entry name '${entry.name}' — the .sppkg would be corrupt.`);
    }
    record[entry.name] = entry.buffer;
  }
  await writeFile(outputPath, zipSync(record, { level: 9 }));
}

export async function readZipEntries(zipPath: string): Promise<Map<string, Buffer>> {
  const files = unzipSync(await readFile(zipPath));
  const result = new Map<string, Buffer>();
  for (const [name, data] of Object.entries(files)) {
    result.set(name, Buffer.from(data));
  }
  return result;
}

export async function validateSppkg(zipPath: string): Promise<SppkgValidationResult> {
  const errors: string[] = [];
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(await readFile(zipPath));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { ok: false, errors };
  }
  const names = new Set(Object.keys(files));
  for (const required of ['[Content_Types].xml', '_rels/.rels', 'AppManifest.xml']) {
    if (!names.has(required)) {
      errors.push(`Missing required entry '${required}'`);
    }
  }
  if (![...names].some((name) => /^feature_[0-9a-fA-F-]+\.xml$/.test(name))) {
    errors.push('Missing required feature manifest entry (feature_<id>.xml)');
  }
  if (![...names].some((name) => /(?:^|\/)WebPart_[0-9a-fA-F-]+\.xml$/.test(name))) {
    errors.push('Missing required web part element manifest entry (<featureId>/WebPart_<componentId>.xml)');
  }
  return { ok: errors.length === 0, errors };
}
