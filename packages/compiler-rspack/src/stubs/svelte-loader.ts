console.warn(
  '[rspfx] svelte-loader is not installed in this project — HMR fast refresh is disabled; fallback to full reload. Install svelte-loader to enable it.'
);
export default function svelteLoader(source: string): string {
  return source;
}
