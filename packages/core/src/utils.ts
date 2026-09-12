import { createHash } from 'node:crypto';

/** Convert kebab/snake to PascalCase — e.g. `hello-world` → `HelloWorld`. */
export function toPascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Deterministic v4 UUID from seed (sha256 → UUID with v4/variant bits set). */
export function deterministicGuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const chars = uuid.split('');
  chars[14] = '4';
  const variantPos = 19;
  const variantVal = parseInt(chars[variantPos]!, 16);
  chars[variantPos] = ((variantVal & 0x3) | 0x8).toString(16);
  return chars.join('');
}
