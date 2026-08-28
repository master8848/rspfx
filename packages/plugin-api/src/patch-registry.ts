import { createRequire } from 'node:module';
import type { RspfxExtension } from './types.js';

let activePlugins: RspfxExtension[] = [];
const componentIdsOverlay = new Map<string, { id: string; version: string; preloadComponents?: string[] }>();

export function setActivePlugins(plugins: readonly RspfxExtension[]): void {
  activePlugins = [...plugins];
  for (const p of plugins) {
    const overlay = (p as unknown as { componentIds?: Record<string, { id: string; version: string; preloadComponents?: string[] }> }).componentIds;
    if (!overlay) continue;
    for (const [k, v] of Object.entries(overlay)) {
      if (v && typeof v.id === 'string' && typeof v.version === 'string') {
        componentIdsOverlay.set(k, { ...v });
      }
    }
  }
}

export function getActivePlugins(): readonly RspfxExtension[] {
  // Merge legacy registry (getPlugins) without importing at top to avoid cycle at load time
  try {
    const req = createRequire(import.meta.url);
    const reg = req('./registry.js') as { getPlugins?: () => RspfxExtension[] };
    if (reg?.getPlugins) {
      const legacy = reg.getPlugins();
      if (legacy.length > 0) {
        const map = new Map<string, RspfxExtension>();
        for (const p of legacy) map.set(p.name, p);
        for (const p of activePlugins) map.set(p.name, p);
        return [...map.values()];
      }
    }
  } catch {}
  return activePlugins;
}

export function getComponentIdsOverlay(): ReadonlyMap<string, { id: string; version: string; preloadComponents?: string[] }> {
  // Also lazily include overlays from legacy plugins that weren't set via setActivePlugins
  try {
    const req = createRequire(import.meta.url);
    const reg = req('./registry.js') as { getPlugins?: () => RspfxExtension[] };
    if (reg?.getPlugins) {
      for (const p of reg.getPlugins()) {
        const overlay = (p as unknown as { componentIds?: Record<string, { id: string; version: string }> }).componentIds;
        if (!overlay) continue;
        for (const [k, v] of Object.entries(overlay)) {
          if (!componentIdsOverlay.has(k) && v && typeof v.id === 'string') componentIdsOverlay.set(k, { ...v } as { id: string; version: string });
        }
      }
    }
  } catch {}
  return componentIdsOverlay;
}

export function clearPatchRegistryForTests(): void {
  activePlugins = [];
  componentIdsOverlay.clear();
}
