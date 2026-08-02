import type { RspfxExtension } from './types.js';

const registry = new Map<string, RspfxExtension>();

export function definePlugin(plugin: RspfxExtension): RspfxExtension {
  return plugin;
}

export function registerPlugin(plugin: RspfxExtension): void {
  registry.set(plugin.name, plugin);
}

export function getPlugins(): RspfxExtension[] {
  return Array.from(registry.values());
}
