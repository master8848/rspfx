import type { RspfxPlugin } from './types.js';

const registry = new Map<string, RspfxPlugin>();

export function definePlugin(plugin: RspfxPlugin): RspfxPlugin {
  return plugin;
}

export function registerPlugin(plugin: RspfxPlugin): void {
  registry.set(plugin.name, plugin);
}

export function getPlugins(): RspfxPlugin[] {
  return Array.from(registry.values());
}
