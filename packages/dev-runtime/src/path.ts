import { fileURLToPath } from 'node:url';

export function decodeIfEncoded(p: string): string {
  if (p.startsWith('file://')) {
    try {
      return fileURLToPath(p);
    } catch {
      // fall through
    }
  }
  if (p.includes('%')) {
    try {
      let decoded = decodeURIComponent(p);
      // handle %2520 -> %20 stability loop
      let iterations = 0;
      while (decoded.includes('%') && iterations < 4) {
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
        } catch {
          break;
        }
        iterations++;
      }
      return decoded;
    } catch {
      return p;
    }
  }
  return p;
}
