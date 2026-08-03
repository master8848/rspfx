console.warn(
  '[rspfx] fast-refresh plugin for solid is not installed in this project — HMR fast refresh is disabled; fallback to full reload. Install solid-refresh to enable it.'
);
export function $$registry(): Record<string, never> {
  return {};
}
export function $$component(_registry: unknown, _id: string, component: unknown): unknown {
  return component;
}
export function $$context(_registry: unknown, _id: string, context: unknown): unknown {
  return context;
}
export function $$refresh(): void {}
export function $$decline(): void {}
