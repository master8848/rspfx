import type { RspfxExtension } from './types.js';

const registry = new Map<string, RspfxExtension>();
let warned = false;
function warnOnce(msg: string): void {
  if (!warned) {
    warned = true;
    console.warn(`[rspfx] deprecated: ${msg}`);
  }
}

export function definePlugin(plugin: RspfxExtension): RspfxExtension {
  return plugin;
}

/** @deprecated since 0.1.0 — use createRSPFX(). Use registerPlugin only for legacy singletons. */
export function registerPlugin(plugin: RspfxExtension): void {
  warnOnce('registerPlugin is deprecated — use createRSPFX().use() instead');
  registry.set(plugin.name, plugin);
}

/** @deprecated since 0.1.0 — use createRSPFX(). */
export function getPlugins(): RspfxExtension[] {
  warnOnce('getPlugins is deprecated — use createRSPFX().plugins instead');
  return Array.from(registry.values());
}

// internal global instance for shim
export function __clearRegistryForTests(): void {
  registry.clear();
  warned = false;
}
