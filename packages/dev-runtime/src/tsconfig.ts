import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@mbsks/rspfx-diagnostics';

const logger = createLogger('rspfx');

function ensureRushStackStub(root: string, extendsStr: string, file: string): Record<string, unknown> | undefined {
  const basePaths = [
    path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json'),
    path.join(root, 'node_modules/@microsoft/rush-stack-compiler-3.9/includes/base.json'),
    path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.7/includes/base.json'),
  ];
  const hasBase = basePaths.some((p) => fs.existsSync(p));
  if (hasBase) return undefined;
  try {
    const stubPath = path.join(root, 'node_modules/@microsoft/rush-stack-compiler-4.1/includes/base.json');
    if (!fs.existsSync(stubPath)) {
      fs.mkdirSync(path.dirname(stubPath), { recursive: true });
      fs.writeFileSync(
        stubPath,
        JSON.stringify(
          {
            compilerOptions: {
              target: 'es2017',
              module: 'esnext',
              jsx: 'react',
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
              moduleResolution: 'node',
              strict: true,
            },
          },
          null,
          2,
        ),
      );
      logger.warn(
        `Created stub ${path.relative(root, stubPath)} to satisfy tsconfig extends — run "rspfx migrate" to rewrite tsconfig to plain config.`,
      );
    }
  } catch {}
  logger.warn(
    `tsconfig ${file} extends "${extendsStr}" but base not found — Vite will use fallback compilerOptions (jsx: react, esModuleInterop). Run "rspfx migrate" to rewrite tsconfig to plain config, or install @microsoft/rush-stack-compiler.`,
  );
  return {
    compilerOptions: {
      jsx: 'react',
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: 'node',
    },
  };
}

export function findTsconfigFile(root: string, explicit?: string): string | undefined {
  if (explicit) {
    const candidate = path.isAbsolute(explicit) ? explicit : path.join(root, explicit);
    if (fs.existsSync(candidate)) return candidate;
    logger.warn(`Explicit tsconfig "${explicit}" not found at ${candidate} — falling back to auto-detect.`);
  }

  const candidates: string[] = ['tsconfig.json', 'tsconfig.build.json', 'tsconfig.app.json'];
  try {
    const all = fs.readdirSync(root).filter((f) => f.startsWith('tsconfig') && f.endsWith('.json'));
    for (const f of all) if (!candidates.includes(f)) candidates.push(f);
  } catch {}

  for (const file of candidates) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

export function resolveTsconfigForVite(
  root: string,
  explicit?: string,
): { filePath?: string; tsconfigRaw?: Record<string, unknown> } {
  const filePath = findTsconfigFile(root, explicit);
  if (!filePath) return {};

  let parsed: Record<string, unknown> & { extends?: string | string[] } = {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return { filePath };
  }

  const file = path.basename(filePath);
  const ext = parsed.extends;
  const extendsStr = Array.isArray(ext) ? ext.join(' ') : typeof ext === 'string' ? ext : '';

  let rushFallback: Record<string, unknown> | undefined;
  if (extendsStr.includes('rush-stack-compiler') || extendsStr.includes('rush-stack')) {
    rushFallback = ensureRushStackStub(root, extendsStr, file);
    if (rushFallback) {
      if (file !== 'tsconfig.json') {
        return { filePath, tsconfigRaw: rushFallback };
      }
      return { filePath, tsconfigRaw: rushFallback };
    }
  }

  if (file !== 'tsconfig.json') {
    return { filePath, tsconfigRaw: parsed as Record<string, unknown> };
  }

  return { filePath };
}
