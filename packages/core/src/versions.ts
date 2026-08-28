export type SpfxToolchain = 'gulp' | 'heft';
export type SpfxReleaseStatus = 'ga' | 'preview';

export interface SpfxVersionInfo {
  readonly target: string;
  readonly npmVersion: string;
  readonly toolchain: SpfxToolchain;
  readonly status: SpfxReleaseStatus;
  readonly notes?: string;
}

export const SPFX_VERSIONS = [
  { target: '1.20', npmVersion: '1.20.0', toolchain: 'gulp', status: 'ga' },
  { target: '1.21', npmVersion: '1.21.0', toolchain: 'gulp', status: 'ga' },
  { target: '1.22', npmVersion: '1.22.0', toolchain: 'gulp', status: 'ga' },
  { target: '1.23', npmVersion: '1.23.0', toolchain: 'heft', status: 'ga' },
  { target: '1.24', npmVersion: '1.24.0', toolchain: 'heft', status: 'preview' }
] as const satisfies readonly SpfxVersionInfo[];

export type SpfxTarget = (typeof SPFX_VERSIONS)[number]['target'];

export const SPFX_DEFAULT_TARGET: SpfxTarget = '1.23';

export function isSpfxTarget(value: string): value is SpfxTarget {
  return (SPFX_VERSIONS as readonly SpfxVersionInfo[]).some((v) => v.target === value);
}

export function spfxNpmVersion(target: SpfxTarget): string {
  return (SPFX_VERSIONS as readonly SpfxVersionInfo[]).find((v) => v.target === target)!.npmVersion;
}

export const SPFX_TARGETS: readonly string[] = SPFX_VERSIONS.map((v) => v.target);
