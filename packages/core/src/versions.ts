export type SpfxToolchain = 'gulp' | 'heft';
export type SpfxReleaseStatus = 'ga' | 'preview';

export interface SpfxVersionInfo {
  readonly target: string;
  readonly npmVersion: string;
  readonly toolchain: SpfxToolchain;
  readonly status: SpfxReleaseStatus;
  readonly notes?: string;
  /** When true, IsDomainIsolated is suppressed in AppManifest for this target; when false, it is preserved. Defaults to >=1.24. */
  readonly isDomainIsolatedDeprecated?: boolean;
}

const _SPFX_VERSIONS_BASE = [
  { target: '1.20', npmVersion: '1.20.0', toolchain: 'gulp', status: 'ga' },
  { target: '1.21', npmVersion: '1.21.0', toolchain: 'gulp', status: 'ga' },
  { target: '1.22', npmVersion: '1.22.0', toolchain: 'gulp', status: 'ga' },
  { target: '1.23', npmVersion: '1.23.0', toolchain: 'heft', status: 'ga' },
  { target: '1.24', npmVersion: '1.24.0', toolchain: 'heft', status: 'preview' }
] as const satisfies readonly SpfxVersionInfo[];

export const SPFX_VERSIONS: SpfxVersionInfo[] = [..._SPFX_VERSIONS_BASE] as SpfxVersionInfo[];

export type SpfxTarget = (typeof _SPFX_VERSIONS_BASE)[number]['target'] | (string & { __spfxTarget?: never });

export const SPFX_DEFAULT_TARGET: SpfxTarget = '1.23';

export const SPFX_TARGETS: string[] = _SPFX_VERSIONS_BASE.map((v) => v.target);

const _extraVersions: SpfxVersionInfo[] = [];

export function getSpfxVersions(): readonly SpfxVersionInfo[] {
  const seen = new Set<string>();
  const result: SpfxVersionInfo[] = [];
  for (const v of [...(SPFX_VERSIONS as readonly SpfxVersionInfo[]), ..._extraVersions]) {
    if (!seen.has(v.target)) {
      seen.add(v.target);
      result.push(v);
    }
  }
  return result;
}

export function registerSpfxVersion(info: SpfxVersionInfo): void {
  if (!info || typeof info.target !== 'string') {
    throw new Error('SpfxVersion target must be a non-empty string');
  }
  const target = info.target.trim();
  if (!/^1\.\d+$/.test(target)) {
    throw new Error(`Invalid SpfxVersion target "${info.target}": must match /^1\\.\\d+$/`);
  }
  if (getSpfxVersions().some((v) => v.target === target)) {
    throw new Error(`SpfxVersion "${target}" already registered`);
  }
  if (typeof info.npmVersion !== 'string' || info.npmVersion.trim() === '') {
    throw new Error(`SpfxVersion "${target}" requires a non-empty npmVersion`);
  }
  if (info.toolchain !== 'gulp' && info.toolchain !== 'heft') {
    throw new Error(`SpfxVersion "${target}" toolchain must be 'gulp' or 'heft'`);
  }
  if (info.status !== 'ga' && info.status !== 'preview') {
    throw new Error(`SpfxVersion "${target}" status must be 'ga' or 'preview'`);
  }
  const frozen = Object.freeze({ ...info, target }) as SpfxVersionInfo;
  _extraVersions.push(frozen);
  if (!SPFX_VERSIONS.some((v) => v.target === target)) {
    SPFX_VERSIONS.push(frozen);
  }
  if (!SPFX_TARGETS.includes(target)) SPFX_TARGETS.push(target);
}

/** Reset registry — intended for tests only. */
export function __clearRegisteredSpfxVersionsForTests(): void {
  for (const v of [..._extraVersions]) {
    const idx = SPFX_VERSIONS.findIndex((x) => x.target === v.target);
    if (idx !== -1) SPFX_VERSIONS.splice(idx, 1);
    const idx2 = SPFX_TARGETS.indexOf(v.target);
    if (idx2 !== -1) SPFX_TARGETS.splice(idx2, 1);
  }
  _extraVersions.length = 0;
}

export function installSpfxVersionExtensions(
  plugins: readonly { spfxVersions?: readonly SpfxVersionInfo[] }[]
): void {
  for (const p of plugins) {
    const versions = (p as { spfxVersions?: readonly SpfxVersionInfo[] }).spfxVersions;
    if (!versions) continue;
    for (const v of versions) registerSpfxVersion(v);
  }
}

export function isSpfxTarget(value: string): value is SpfxTarget {
  return getSpfxVersions().some((v) => v.target === value);
}

export function spfxNpmVersion(target: string): string {
  const found = getSpfxVersions().find((v) => v.target === target);
  if (!found) throw new Error(`Unknown SPFx target "${target}"`);
  return found.npmVersion;
}
